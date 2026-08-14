import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDownLeft, ArrowUpRight, Banknote, Check, CreditCard, Landmark,
  Pencil, PiggyBank, Plus, Trash2, Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACCOUNT_KINDS, accountBalance, deleteAccount, deleteEntry, fetchAccounts, fetchEntries,
  saveAccount, saveEntry, setReconciled, settleCharge, type FinAccount, type FinEntry,
} from "@/lib/finance-accounts";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR");

const KIND_ICON: Record<string, typeof Wallet> = {
  checking: Landmark, savings: PiggyBank, cash: Banknote, card: CreditCard, investment: Wallet,
};

type ChargeRow = {
  id: string; description: string | null; amount: number; status: string;
  due_date: string | null; nature: string | null; category: string | null;
};

export function AccountsPanel() {
  const qc = useQueryClient();
  const [accOpen, setAccOpen] = useState(false);
  const [accDraft, setAccDraft] = useState<Partial<FinAccount>>({});
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryDraft, setEntryDraft] = useState<Partial<FinEntry>>({});
  const [filter, setFilter] = useState<string>("all");
  const [settleId, setSettleId] = useState<string | null>(null);
  const [settleAcc, setSettleAcc] = useState<string>("");

  const { data: accounts = [] } = useQuery({ queryKey: ["fin-accounts"], queryFn: fetchAccounts });
  const { data: entries = [] } = useQuery({ queryKey: ["fin-account-entries"], queryFn: () => fetchEntries() });
  const { data: openCharges = [] } = useQuery<ChargeRow[]>({
    queryKey: ["fin-open-charges"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("charges")
        .select("id,description,amount,status,due_date,nature,category")
        .in("status", ["pending", "overdue"])
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(60);
      if (error) throw error;
      return (data ?? []) as ChargeRow[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["fin-accounts"] });
    qc.invalidateQueries({ queryKey: ["fin-account-entries"] });
    qc.invalidateQueries({ queryKey: ["fin-open-charges"] });
    qc.invalidateQueries({ queryKey: ["charges"] });
  };

  const mAccount = useMutation({
    mutationFn: (a: Partial<FinAccount> & { name: string }) => saveAccount(a),
    onSuccess: () => { invalidate(); setAccOpen(false); toast.success("Conta salva"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelAccount = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => { invalidate(); toast.success("Conta excluída"); },
    onError: () => toast.error("Não foi possível excluir (há movimentos vinculados)"),
  });
  const mEntry = useMutation({
    mutationFn: (e: Partial<FinEntry> & { account_id: string; amount: number }) => saveEntry(e),
    onSuccess: () => { invalidate(); setEntryOpen(false); toast.success("Movimento salvo"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const mDelEntry = useMutation({ mutationFn: deleteEntry, onSuccess: invalidate });
  const mReconcile = useMutation({
    mutationFn: ({ id, v }: { id: string; v: boolean }) => setReconciled(id, v),
    onSuccess: invalidate,
  });
  const mSettle = useMutation({
    mutationFn: async ({ charge, accountId }: { charge: ChargeRow; accountId: string }) =>
      settleCharge({
        chargeId: charge.id,
        accountId,
        amount: Number(charge.amount ?? 0),
        direction: charge.nature === "expense" || charge.nature === "cost" ? "out" : "in",
        date: today(),
        description: charge.description ?? "Baixa de cobrança",
        category: charge.category,
      }),
    onSuccess: () => { invalidate(); setSettleId(null); toast.success("Cobrança baixada e movimento lançado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    const cur = accounts.reduce((s, a) => s + accountBalance(a, entries).current, 0);
    const rec = accounts.reduce((s, a) => s + accountBalance(a, entries).reconciled, 0);
    const unrec = entries.filter(e => !e.reconciled).length;
    return { cur, rec, unrec };
  }, [accounts, entries]);

  const shown = filter === "all" ? entries : entries.filter(e => e.account_id === filter);

  return (
    <div className="space-y-5">
      {/* resumo */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Saldo atual" value={brl(totals.cur)} hint="Todas as contas" />
        <SummaryCard label="Saldo conciliado" value={brl(totals.rec)} hint="Apenas movimentos confirmados" />
        <SummaryCard label="A conciliar" value={String(totals.unrec)} hint="Movimentos pendentes de conferência" />
      </div>

      {/* contas */}
      <section className="rounded-2xl border bg-card p-4">
        <header className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">Contas bancárias</h3>
            <p className="text-[11px] text-muted-foreground">Bancos, caixa e cartões da agência</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => { setAccDraft({ kind: "checking", opening_date: today(), opening_balance: 0 }); setAccOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova conta
          </Button>
        </header>

        {!accounts.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada. Crie a primeira para controlar o caixa real.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {accounts.map(a => {
              const Icon = KIND_ICON[a.kind] ?? Wallet;
              const b = accountBalance(a, entries);
              return (
                <div key={a.id} className="rounded-xl border bg-background p-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 text-primary grid place-items-center">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{a.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {a.bank_name || ACCOUNT_KINDS.find(k => k.value === a.kind)?.label}
                      </div>
                    </div>
                    <button className="p-1 text-muted-foreground hover:text-foreground" onClick={() => { setAccDraft(a); setAccOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button className="p-1 text-muted-foreground hover:text-destructive" onClick={() => mDelAccount.mutate(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Saldo</div>
                      <div className={`text-lg font-bold ${b.current < 0 ? "text-destructive" : ""}`}>{brl(b.current)}</div>
                    </div>
                    <div className="text-right text-[11px] text-muted-foreground">
                      <div>{b.count} movimentos</div>
                      {b.pending > 0 && <div className="text-amber-600 dark:text-amber-400">{b.pending} a conciliar</div>}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1"
                      onClick={() => { setEntryDraft({ account_id: a.id, direction: "in", entry_date: today() }); setEntryOpen(true); }}>
                      <ArrowDownLeft className="h-3.5 w-3.5 mr-1" /> Entrada
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1"
                      onClick={() => { setEntryDraft({ account_id: a.id, direction: "out", entry_date: today() }); setEntryOpen(true); }}>
                      <ArrowUpRight className="h-3.5 w-3.5 mr-1" /> Saída
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* baixa de cobranças */}
      {accounts.length > 0 && openCharges.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <header className="mb-3">
            <h3 className="text-sm font-semibold">Baixar cobranças em aberto</h3>
            <p className="text-[11px] text-muted-foreground">Marca como paga e gera o movimento na conta escolhida</p>
          </header>
          <div className="divide-y">
            {openCharges.slice(0, 10).map(c => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{c.description || "Cobrança"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {c.due_date ? `Vence ${fmtDate(c.due_date)}` : "Sem vencimento"} · {brl(Number(c.amount ?? 0))}
                  </div>
                </div>
                {settleId === c.id ? (
                  <div className="flex items-center gap-2">
                    <select className="h-8 rounded-md border bg-background px-2 text-xs" value={settleAcc}
                      onChange={e => setSettleAcc(e.target.value)}>
                      <option value="">Conta…</option>
                      {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                    <Button size="sm" disabled={!settleAcc} onClick={() => mSettle.mutate({ charge: c, accountId: settleAcc })}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Confirmar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSettleId(null)}>Cancelar</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => { setSettleId(c.id); setSettleAcc(accounts[0]?.id ?? ""); }}>
                    Dar baixa
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* extrato */}
      <section className="rounded-2xl border bg-card p-4">
        <header className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <h3 className="text-sm font-semibold">Extrato e conciliação</h3>
            <p className="text-[11px] text-muted-foreground">Confira cada movimento contra o extrato do banco</p>
          </div>
          <div className="flex items-center gap-2">
            <select className="h-8 rounded-md border bg-background px-2 text-xs" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">Todas as contas</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <Button size="sm" variant="outline" disabled={!accounts.length}
              onClick={() => { setEntryDraft({ account_id: accounts[0]?.id, direction: "in", entry_date: today() }); setEntryOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Movimento
            </Button>
          </div>
        </header>

        {!shown.length ? (
          <p className="text-sm text-muted-foreground">Nenhum movimento registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 font-medium">Data</th>
                  <th className="py-2 font-medium">Descrição</th>
                  <th className="py-2 font-medium">Conta</th>
                  <th className="py-2 font-medium text-right">Valor</th>
                  <th className="py-2 font-medium text-center">Conciliado</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.slice(0, 100).map(e => {
                  const acc = accounts.find(a => a.id === e.account_id);
                  const inflow = e.direction === "in";
                  return (
                    <tr key={e.id}>
                      <td className="py-2 whitespace-nowrap text-muted-foreground">{fmtDate(e.entry_date)}</td>
                      <td className="py-2">
                        <div className="font-medium">{e.description || "—"}</div>
                        {e.category && <div className="text-[11px] text-muted-foreground">{e.category}</div>}
                      </td>
                      <td className="py-2 text-muted-foreground">{acc?.name ?? "—"}</td>
                      <td className={`py-2 text-right font-semibold ${inflow ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                        {inflow ? "+" : "−"} {brl(Number(e.amount))}
                      </td>
                      <td className="py-2 text-center">
                        <button
                          onClick={() => mReconcile.mutate({ id: e.id, v: !e.reconciled })}
                          className={`h-6 w-6 rounded-md border grid place-items-center ${e.reconciled ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
                          title={e.reconciled ? "Conciliado" : "Marcar como conciliado"}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </td>
                      <td className="py-2 text-right">
                        <button className="p-1 text-muted-foreground hover:text-foreground" onClick={() => { setEntryDraft(e); setEntryOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button className="p-1 text-muted-foreground hover:text-destructive" onClick={() => mDelEntry.mutate(e.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* dialog conta */}
      <Dialog open={accOpen} onOpenChange={setAccOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{accDraft.id ? "Editar conta" : "Nova conta"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Field label="Nome">
              <Input value={accDraft.name ?? ""} onChange={e => setAccDraft(d => ({ ...d, name: e.target.value }))} placeholder="Conta principal" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                  value={accDraft.kind ?? "checking"} onChange={e => setAccDraft(d => ({ ...d, kind: e.target.value }))}>
                  {ACCOUNT_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
              </Field>
              <Field label="Banco">
                <Input value={accDraft.bank_name ?? ""} onChange={e => setAccDraft(d => ({ ...d, bank_name: e.target.value }))} placeholder="Itaú, Nubank…" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Saldo inicial">
                <Input type="number" step="0.01" value={accDraft.opening_balance ?? 0}
                  onChange={e => setAccDraft(d => ({ ...d, opening_balance: Number(e.target.value) }))} />
              </Field>
              <Field label="Data do saldo">
                <Input type="date" value={accDraft.opening_date ?? today()}
                  onChange={e => setAccDraft(d => ({ ...d, opening_date: e.target.value }))} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAccOpen(false)}>Cancelar</Button>
            <Button disabled={!accDraft.name?.trim()} onClick={() => mAccount.mutate(accDraft as FinAccount)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* dialog movimento */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{entryDraft.id ? "Editar movimento" : "Novo movimento"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              {(["in", "out"] as const).map(dir => (
                <button key={dir} type="button"
                  onClick={() => setEntryDraft(d => ({ ...d, direction: dir }))}
                  className={`h-9 rounded-md border text-sm font-medium ${entryDraft.direction === dir ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                  {dir === "in" ? "Entrada" : "Saída"}
                </button>
              ))}
            </div>
            <Field label="Conta">
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={entryDraft.account_id ?? ""} onChange={e => setEntryDraft(d => ({ ...d, account_id: e.target.value }))}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
            <Field label="Descrição">
              <Input value={entryDraft.description ?? ""} onChange={e => setEntryDraft(d => ({ ...d, description: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor">
                <Input type="number" step="0.01" value={entryDraft.amount ?? ""}
                  onChange={e => setEntryDraft(d => ({ ...d, amount: Number(e.target.value) }))} />
              </Field>
              <Field label="Data">
                <Input type="date" value={entryDraft.entry_date ?? today()}
                  onChange={e => setEntryDraft(d => ({ ...d, entry_date: e.target.value }))} />
              </Field>
            </div>
            <Field label="Categoria">
              <Input value={entryDraft.category ?? ""} onChange={e => setEntryDraft(d => ({ ...d, category: e.target.value }))} placeholder="Serviços, software, impostos…" />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEntryOpen(false)}>Cancelar</Button>
            <Button
              disabled={!entryDraft.account_id || !Number(entryDraft.amount)}
              onClick={() => mEntry.mutate(entryDraft as FinEntry)}
            >Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
