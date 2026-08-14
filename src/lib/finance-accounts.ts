import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export type FinAccount = {
  id: string;
  name: string;
  kind: string;                 // checking | savings | cash | card | investment
  bank_name: string | null;
  color: string | null;
  opening_balance: number;
  opening_date: string;
  active: boolean;
};

export type FinEntry = {
  id: string;
  account_id: string;
  charge_id: string | null;
  direction: "in" | "out";
  amount: number;
  entry_date: string;
  description: string;
  category: string | null;
  payment_method: string | null;
  reconciled: boolean;
  notes: string | null;
};

export const ACCOUNT_KINDS: { value: string; label: string }[] = [
  { value: "checking", label: "Conta corrente" },
  { value: "savings", label: "Poupança" },
  { value: "cash", label: "Caixa / dinheiro" },
  { value: "card", label: "Cartão de crédito" },
  { value: "investment", label: "Investimento" },
];

async function orgId(): Promise<string> {
  const { data } = await sb.from("profiles").select("organization_id").maybeSingle();
  if (!data?.organization_id) throw new Error("Sem organização");
  return data.organization_id as string;
}

export async function fetchAccounts(): Promise<FinAccount[]> {
  const { data, error } = await sb
    .from("financial_accounts")
    .select("id,name,kind,bank_name,color,opening_balance,opening_date,active")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as FinAccount[];
}

export async function saveAccount(a: Partial<FinAccount> & { name: string }): Promise<FinAccount> {
  const payload = {
    name: a.name,
    kind: a.kind ?? "checking",
    bank_name: a.bank_name ?? null,
    color: a.color ?? null,
    opening_balance: Number(a.opening_balance ?? 0),
    opening_date: a.opening_date ?? new Date().toISOString().slice(0, 10),
    active: a.active ?? true,
  };
  if (a.id) {
    const { data, error } = await sb.from("financial_accounts").update(payload).eq("id", a.id).select().single();
    if (error) throw error;
    return data as FinAccount;
  }
  const { data, error } = await sb
    .from("financial_accounts")
    .insert({ ...payload, organization_id: await orgId() })
    .select()
    .single();
  if (error) throw error;
  return data as FinAccount;
}

export async function deleteAccount(id: string) {
  const { error } = await sb.from("financial_accounts").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchEntries(accountId?: string): Promise<FinEntry[]> {
  let q = sb
    .from("financial_entries")
    .select("id,account_id,charge_id,direction,amount,entry_date,description,category,payment_method,reconciled,notes")
    .order("entry_date", { ascending: false });
  if (accountId) q = q.eq("account_id", accountId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as FinEntry[];
}

export async function saveEntry(e: Partial<FinEntry> & { account_id: string; amount: number }): Promise<FinEntry> {
  const payload = {
    account_id: e.account_id,
    charge_id: e.charge_id ?? null,
    direction: e.direction ?? "in",
    amount: Number(e.amount ?? 0),
    entry_date: e.entry_date ?? new Date().toISOString().slice(0, 10),
    description: e.description ?? "",
    category: e.category ?? null,
    payment_method: e.payment_method ?? null,
    reconciled: e.reconciled ?? false,
    notes: e.notes ?? null,
  };
  if (e.id) {
    const { data, error } = await sb.from("financial_entries").update(payload).eq("id", e.id).select().single();
    if (error) throw error;
    return data as FinEntry;
  }
  const { data, error } = await sb
    .from("financial_entries")
    .insert({ ...payload, organization_id: await orgId() })
    .select()
    .single();
  if (error) throw error;
  return data as FinEntry;
}

export async function deleteEntry(id: string) {
  const { error } = await sb.from("financial_entries").delete().eq("id", id);
  if (error) throw error;
}

export async function setReconciled(id: string, reconciled: boolean) {
  const { error } = await sb.from("financial_entries").update({ reconciled }).eq("id", id);
  if (error) throw error;
}

/** Baixa de uma cobrança: marca como paga e cria o movimento na conta escolhida. */
export async function settleCharge(opts: {
  chargeId: string;
  accountId: string;
  amount: number;
  direction: "in" | "out";
  date: string;
  description: string;
  category?: string | null;
  payment_method?: string | null;
}) {
  const { error } = await sb
    .from("charges")
    .update({ status: "paid", paid_at: opts.date })
    .eq("id", opts.chargeId);
  if (error) throw error;
  return saveEntry({
    account_id: opts.accountId,
    charge_id: opts.chargeId,
    amount: opts.amount,
    direction: opts.direction,
    entry_date: opts.date,
    description: opts.description,
    category: opts.category ?? null,
    payment_method: opts.payment_method ?? null,
    reconciled: true,
  });
}

export function accountBalance(acc: FinAccount, entries: FinEntry[]) {
  const mine = entries.filter(e => e.account_id === acc.id);
  const moves = mine.reduce((s, e) => s + (e.direction === "in" ? Number(e.amount) : -Number(e.amount)), 0);
  const reconciled = mine
    .filter(e => e.reconciled)
    .reduce((s, e) => s + (e.direction === "in" ? Number(e.amount) : -Number(e.amount)), 0);
  return {
    current: Number(acc.opening_balance ?? 0) + moves,
    reconciled: Number(acc.opening_balance ?? 0) + reconciled,
    pending: mine.filter(e => !e.reconciled).length,
    count: mine.length,
  };
}
