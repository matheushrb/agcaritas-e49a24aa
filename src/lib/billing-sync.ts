import { supabase } from "@/integrations/supabase/client";

/**
 * Sincronização de valores entre Tarefas <-> Faturas.
 *
 * Regra: o valor da tarefa (billing_base_value) e o valor de cada entregável
 * são a fonte da verdade. As cobranças (charges) vinculadas a elas espelham
 * esses valores. Faturas pagas ou canceladas nunca são alteradas.
 */

const num = (v: unknown) => Number(v ?? 0) || 0;

type Deliverable = { id: string; billing_value?: number | null };

/** Recalcula subtotal/total de uma fatura a partir das suas cobranças. */
export async function recalcInvoiceTotals(invoiceId: string) {
  const { data: charges } = await supabase
    .from("charges").select("amount").eq("invoice_id", invoiceId);
  const subtotal = (charges ?? []).reduce((a, c) => a + num((c as { amount: unknown }).amount), 0);
  const { data: inv } = await supabase
    .from("invoices").select("discount").eq("id", invoiceId).maybeSingle();
  const discount = num((inv as { discount?: unknown } | null)?.discount);
  await supabase.from("invoices")
    .update({ amount: subtotal, total: Math.max(0, subtotal - discount) } as never)
    .eq("id", invoiceId);
}

/**
 * Após salvar uma tarefa: atualiza as cobranças/faturas que já usam essa
 * tarefa ou seus entregáveis. Retorna os números das faturas atualizadas.
 */
export async function syncChargesFromTask(taskId: string): Promise<string[]> {
  const { data: task } = await supabase
    .from("tasks").select("billing_base_value,billing_value,deliverables")
    .eq("id", taskId).maybeSingle();
  if (!task) return [];

  const base = num((task as { billing_base_value?: unknown; billing_value?: unknown }).billing_base_value
    ?? (task as { billing_value?: unknown }).billing_value);
  const deliverables = ((task as { deliverables?: unknown }).deliverables ?? []) as Deliverable[];
  const byId = new Map(deliverables.map(d => [d.id, num(d.billing_value)]));

  const { data: charges } = await supabase
    .from("charges").select("id,amount,deliverable_id,invoice_id,status")
    .eq("task_id", taskId);
  if (!charges?.length) return [];

  const invoiceIds = Array.from(new Set(
    (charges as { invoice_id: string | null }[]).map(c => c.invoice_id).filter(Boolean),
  )) as string[];

  // faturas bloqueadas (pagas/canceladas) não são tocadas
  const locked = new Set<string>();
  const numbers = new Map<string, string>();
  if (invoiceIds.length) {
    const { data: invs } = await supabase
      .from("invoices").select("id,number,status").in("id", invoiceIds);
    for (const i of (invs ?? []) as { id: string; number: string | null; status: string }[]) {
      numbers.set(i.id, i.number ?? "");
      if (i.status === "paid" || i.status === "canceled" || i.status === "cancelled") locked.add(i.id);
    }
  }

  const touched = new Set<string>();
  for (const c of charges as { id: string; amount: unknown; deliverable_id: string | null; invoice_id: string | null; status: string }[]) {
    if (c.status === "cancelled") continue;
    if (c.invoice_id && locked.has(c.invoice_id)) continue;
    const target = c.deliverable_id ? byId.get(c.deliverable_id) : base;
    if (target === undefined) continue;
    if (num(c.amount) === target) continue;
    await supabase.from("charges").update({ amount: target } as never).eq("id", c.id);
    if (c.invoice_id) touched.add(c.invoice_id);
  }

  for (const id of touched) await recalcInvoiceTotals(id);
  return [...touched].map(id => numbers.get(id) || "").filter(Boolean);
}

/**
 * Após editar itens de uma fatura: devolve os valores para a tarefa
 * (valor-base) e para os entregáveis correspondentes.
 */
export async function syncTasksFromCharges(
  rows: Array<{ task_id?: string | null; deliverable_id?: string | null; amount: number }>,
) {
  const byTask = new Map<string, { base?: number; deliv: Map<string, number> }>();
  for (const r of rows) {
    if (!r.task_id) continue;
    if (!byTask.has(r.task_id)) byTask.set(r.task_id, { deliv: new Map() });
    const entry = byTask.get(r.task_id)!;
    if (r.deliverable_id) entry.deliv.set(r.deliverable_id, num(r.amount));
    else entry.base = num(r.amount);
  }
  if (!byTask.size) return;

  for (const [taskId, entry] of byTask) {
    const { data: task } = await supabase
      .from("tasks").select("billing_base_value,deliverables").eq("id", taskId).maybeSingle();
    if (!task) continue;
    const patch: Record<string, unknown> = {};

    if (entry.base !== undefined && num((task as { billing_base_value?: unknown }).billing_base_value) !== entry.base) {
      patch.billing_base_value = entry.base;
      patch.billing_value = entry.base;
    }

    if (entry.deliv.size) {
      const list = ((task as { deliverables?: unknown }).deliverables ?? []) as Deliverable[];
      let changed = false;
      const next = list.map(d => {
        const v = entry.deliv.get(d.id);
        if (v === undefined || num(d.billing_value) === v) return d;
        changed = true;
        return { ...d, billing_value: v };
      });
      if (changed) patch.deliverables = next;
    }

    if (Object.keys(patch).length) {
      await supabase.from("tasks").update(patch as never).eq("id", taskId);
    }
  }
}
