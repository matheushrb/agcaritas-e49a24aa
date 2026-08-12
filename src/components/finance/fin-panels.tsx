import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, ShieldCheck, PiggyBank, Sparkles, Lightbulb,
  ArrowRight, AlertTriangle, CheckCircle2, Percent, Wallet, Target,
} from "lucide-react";
import {
  analyzeByType, brl, brl0, buildCashflow, buildDre, computeTaskCosts, lastMonths, monthKey,
  nextMonths, num, pct, planReserves, computeBreakEven, computeCostBase, isReceitaOperacional, DEFAULT_RESERVES,
  type FinCharge, type FinMember, type FinProjectCost, type FinTask, type FinTaskType,
  type FinTimeEntry, type ReserveSettings, type TypeAnalysis,
} from "@/lib/finance-analytics";
import type { PricingSettings } from "@/components/settings/agency-pricing";
import { computeAgencyRate } from "@/components/settings/agency-pricing";

export type FinDataset = {
  charges: FinCharge[];
  costs: FinProjectCost[];
  tasks: FinTask[];
  taskTypes: FinTaskType[];
  members: FinMember[];
  entries: FinTimeEntry[];
  pricing: PricingSettings;
  reserves: ReserveSettings;
  currentUserId?: string | null;
};

const Section = ({ title, hint, right, children }: { title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode }) => (
  <Card className="rounded-2xl p-5 space-y-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        {hint && <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">{hint}</p>}
      </div>
      {right}
    </div>
    {children}
  </Card>
);

const Kpi = ({ label, value, tone, sub }: { label: string; value: string; tone?: "good" | "bad" | "warn"; sub?: string }) => (
  <div className="rounded-xl border bg-card px-4 py-3">
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={`text-lg font-semibold mt-1 ${tone === "good" ? "text-emerald-600 dark:text-emerald-400" : tone === "bad" ? "text-red-600 dark:text-red-400" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : ""}`}>{value}</div>
    {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
  </div>
);

/* ================= Fluxo de caixa ================= */
export function CashflowPanel({ data }: { data: FinDataset }) {
  const [horizon, setHorizon] = useState(6);
  const rate = computeAgencyRate(data.pricing);
  const openingBalance = useMemo(
    () => data.charges
      .filter(c => c.status === "paid")
      .reduce((a, c) => a + ((c.nature ?? c.type ?? "income") === "expense" ? -Math.abs(num(c.amount)) : Math.abs(num(c.amount))), 0),
    [data.charges],
  );
  const months = useMemo(() => [...lastMonths(3), ...nextMonths(horizon + 1).slice(1)], [horizon]);
  const rows = useMemo(
    () => buildCashflow({ charges: data.charges, costs: data.costs, months, fixedMonthly: rate.totalMonthly, openingBalance: 0 }),
    [data.charges, data.costs, months, rate.totalMonthly],
  );
  const max = Math.max(1, ...rows.map(r => Math.max(r.inflow, r.outflow)));
  const worst = rows.reduce((a, r) => (r.net < a.net ? r : a), rows[0]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Saldo realizado" value={brl0(openingBalance)} tone={openingBalance >= 0 ? "good" : "bad"} sub="Entradas pagas − saídas pagas" />
        <Kpi label="Entradas previstas" value={brl0(rows.filter(r => r.projected).reduce((a, r) => a + r.inflow, 0))} sub={`Próximos ${horizon} meses`} />
        <Kpi label="Saídas previstas" value={brl0(rows.filter(r => r.projected).reduce((a, r) => a + r.outflow, 0))} sub="Inclui custo fixo da estrutura" />
        <Kpi label="Pior mês" value={worst ? `${worst.label} · ${brl0(worst.net)}` : "—"} tone={worst && worst.net < 0 ? "bad" : "good"} />
      </div>

      <Section
        title="Projeção mês a mês"
        hint="Entradas e saídas por vencimento, somando o custo fixo mensal cadastrado na precificação da agência."
        right={
          <div className="flex gap-1">
            {[3, 6, 12].map(h => (
              <button key={h} onClick={() => setHorizon(h)}
                className={`h-7 rounded-lg px-2.5 text-xs border ${horizon === h ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}>
                {h}m
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm [&_th]:px-2 [&_td]:px-2 whitespace-nowrap">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted-foreground text-left">
                <th className="py-2">Mês</th>
                <th className="py-2 text-right">Entradas</th>
                <th className="py-2 text-right">Saídas</th>
                <th className="py-2 text-right">Resultado</th>
                <th className="py-2 text-right">Acumulado</th>
                <th className="py-2 w-40">Comparativo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} className="border-t">
                  <td className="py-2 font-medium">
                    {r.label} {r.projected && <span className="ml-1 text-[10px] rounded px-1.5 py-0.5 bg-muted text-muted-foreground">previsto</span>}
                  </td>
                  <td className="py-2 text-right text-emerald-600 dark:text-emerald-400">{brl0(r.inflow)}</td>
                  <td className="py-2 text-right text-red-600 dark:text-red-400">{brl0(r.outflow)}</td>
                  <td className={`py-2 text-right font-medium ${r.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{brl0(r.net)}</td>
                  <td className={`py-2 text-right ${r.balance >= 0 ? "" : "text-red-600 dark:text-red-400"}`}>{brl0(r.balance)}</td>
                  <td className="py-2">
                    <div className="flex flex-col gap-1">
                      <div className="h-1.5 rounded bg-emerald-500/80" style={{ width: `${(r.inflow / max) * 100}%` }} />
                      <div className="h-1.5 rounded bg-red-500/70" style={{ width: `${(r.outflow / max) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

/* ================= DRE ================= */
export function DrePanel({ data }: { data: FinDataset }) {
  const [range, setRange] = useState(6);
  const rate = computeAgencyRate(data.pricing);
  const months = useMemo(() => lastMonths(range), [range]);
  const rows = useMemo(
    () => buildDre({ charges: data.charges, costs: data.costs, months, fixedMonthly: rate.totalMonthly, taxPct: data.reserves.tax_pct }),
    [data.charges, data.costs, months, rate.totalMonthly, data.reserves.tax_pct],
  );
  const tot = rows.reduce((a, r) => ({
    grossRevenue: a.grossRevenue + r.grossRevenue,
    taxes: a.taxes + r.taxes,
    netRevenue: a.netRevenue + r.netRevenue,
    fixedCosts: a.fixedCosts + r.fixedCosts,
    variableCosts: a.variableCosts + r.variableCosts,
    reimbursements: a.reimbursements + r.reimbursements,
    operatingResult: a.operatingResult + r.operatingResult,
    prolabore: a.prolabore + r.prolabore,
    periodResult: a.periodResult + r.periodResult,
    withdrawals: a.withdrawals + r.withdrawals,
    investments: a.investments + r.investments,
  }), {
    grossRevenue: 0, taxes: 0, netRevenue: 0, fixedCosts: 0, variableCosts: 0,
    reimbursements: 0, operatingResult: 0, prolabore: 0, periodResult: 0, withdrawals: 0, investments: 0,
  });

  const lines: { label: string; get: (r: typeof rows[number]) => number; total: number; strong?: boolean; muted?: boolean }[] = [
    { label: "Receita bruta de serviços", get: r => r.grossRevenue, total: tot.grossRevenue, strong: true },
    { label: "(−) Impostos", get: r => -r.taxes, total: -tot.taxes },
    { label: "= Receita líquida", get: r => r.netRevenue, total: tot.netRevenue, strong: true },
    { label: "(−) Custos fixos", get: r => -r.fixedCosts, total: -tot.fixedCosts },
    { label: "(−) Custos variáveis e mídia", get: r => -r.variableCosts, total: -tot.variableCosts },
    { label: "(−) Reembolsos pagos", get: r => -r.reimbursements, total: -tot.reimbursements },
    { label: "= Resultado operacional", get: r => r.operatingResult, total: tot.operatingResult, strong: true },
    { label: "(−) Pró-labore", get: r => -r.prolabore, total: -tot.prolabore },
    { label: "= Resultado do período", get: r => r.periodResult, total: tot.periodResult, strong: true },
    { label: "Saques (fora do DRE)", get: r => r.withdrawals, total: tot.withdrawals, muted: true },
    { label: "Investimentos (fora do DRE)", get: r => r.investments, total: tot.investments, muted: true },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Receita do período" value={brl0(tot.grossRevenue)} />
        <Kpi label="Custos totais" value={brl0(tot.fixedCosts + tot.variableCosts + tot.reimbursements + tot.taxes)} />
        <Kpi label="Resultado do período" value={brl0(tot.periodResult)} tone={tot.periodResult >= 0 ? "good" : "bad"} sub="Depois do pró-labore" />
        <Kpi label="Margem do período" value={pct(tot.grossRevenue > 0 ? (tot.periodResult / tot.grossRevenue) * 100 : 0)} tone={tot.periodResult >= 0 ? "good" : "bad"} />
      </div>

      <Section
        title="DRE gerencial por competência"
        hint="Estruturado pela natureza contábil de cada lançamento. Saque e investimento são movimentação de capital: aparecem só como informação e nunca reduzem o resultado."
        right={
          <div className="flex gap-1">
            {[3, 6, 12].map(h => (
              <button key={h} onClick={() => setRange(h)}
                className={`h-7 rounded-lg px-2.5 text-xs border ${range === h ? "bg-primary text-primary-foreground border-primary" : "bg-card"}`}>
                {h}m
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm [&_th]:px-2 [&_td]:px-2 whitespace-nowrap">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 text-left">Linha</th>
                {rows.map(r => <th key={r.key} className="py-2 text-right">{r.label}</th>)}
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(l => (
                <tr key={l.label} className={`border-t ${l.strong ? "font-medium" : ""} ${l.muted ? "text-muted-foreground text-xs" : ""}`}>
                  <td className="py-2 text-left">{l.label}</td>
                  {rows.map(r => {
                    const v = l.get(r);
                    return <td key={r.key} className={`py-2 text-right ${v < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{brl0(v)}</td>;
                  })}
                  <td className={`py-2 text-right ${l.total < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{brl0(l.total)}</td>
                </tr>
              ))}
              <tr className="border-t">
                <td className="py-2 text-left text-muted-foreground text-xs">Margem do período %</td>
                {rows.map(r => (
                  <td key={r.key} className={`py-2 text-right text-xs ${r.marginPct < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>{pct(r.marginPct)}</td>
                ))}
                <td className="py-2 text-right text-xs">{pct(tot.grossRevenue > 0 ? (tot.periodResult / tot.grossRevenue) * 100 : 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

/* ================= Planejador ================= */
export function PlannerPanel({ data }: { data: FinDataset }) {
  const qc = useQueryClient();
  const [state, setState] = useState<ReserveSettings>(data.reserves);
  const rate = computeAgencyRate(data.pricing);

  const thisMonth = monthKey(new Date());
  const monthlyRevenue = useMemo(
    () => data.charges
      .filter(c => (c.nature ?? c.type ?? "income") !== "expense" && c.status !== "cancelled" && c.status !== "draft")
      .filter(c => monthKey(c.competence_month ?? c.paid_at ?? c.due_date ?? new Date().toISOString()) === thisMonth)
      .reduce((a, c) => a + Math.abs(num(c.amount)), 0),
    [data.charges, thisMonth],
  );
  const monthlyDirect = useMemo(
    () => data.costs.filter(c => c.status !== "cancelled" && monthKey(c.occurred_on) === thisMonth).reduce((a, c) => a + num(c.amount), 0),
    [data.costs, thisMonth],
  );
  const accumulated = useMemo(
    () => data.charges.filter(c => c.status === "paid")
      .reduce((a, c) => a + ((c.nature ?? c.type ?? "income") === "expense" ? -Math.abs(num(c.amount)) : Math.abs(num(c.amount))), 0),
    [data.charges],
  );

  const plan = planReserves({
    monthlyRevenue,
    monthlyFixedCosts: rate.totalMonthly,
    monthlyDirectCosts: monthlyDirect,
    reserves: state,
    accumulatedEmergency: Math.max(0, accumulated) * (state.emergency_pct / 100),
  });

  const costBase = useMemo(() => computeCostBase({
    pricingFixed: rate.fixed,
    pricingVariable: rate.variable,
    members: data.members,
    charges: data.charges,
    costs: data.costs,
    reserves: state,
    currentUserId: data.currentUserId,
  }), [rate.fixed, rate.variable, data.members, data.charges, data.costs, state, data.currentUserId]);

  const be = computeBreakEven({
    operatingCost: costBase.total,
    taxPct: state.tax_pct,
    profitPct: state.profit_pct,
    emergencyPct: state.emergency_pct,
    investmentPct: state.investment_pct,
  });

  const save = useMutation({
    mutationFn: async () => {
      const { data: p } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!p?.organization_id) throw new Error("Organização não encontrada");
      const merged = { ...(data.pricing as any), reserves: state, profit_margin_pct: state.profit_pct, tax_pct: state.tax_pct };
      const { error } = await supabase.from("organizations").update({ pricing_settings: merged as any }).eq("id", p.organization_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parâmetros do planejador salvos");
      qc.invalidateQueries({ queryKey: ["agency-pricing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fields: { key: keyof ReserveSettings; label: string; hint: string; suffix: string }[] = [
    { key: "tax_pct", label: "Impostos", hint: "Percentual médio sobre o faturamento", suffix: "%" },
    { key: "prolabore_pct", label: "Retirada extra dos sócios", hint: "Distribuição sobre o faturamento depois de cobrir custos, impostos e reservas. Seu salário fixo já entra como pró-labore no custo.", suffix: "%" },
    { key: "profit_pct", label: "Lucro", hint: "Reserva de lucro / reinvestimento", suffix: "%" },
    { key: "emergency_pct", label: "Reserva de emergência", hint: "Percentual guardado todo mês", suffix: "%" },
    { key: "investment_pct", label: "Capital de investimento", hint: "Percentual reservado para crescer a agência", suffix: "%" },
    { key: "emergency_target_months", label: "Meta da reserva", hint: "Meses de operação cobertos", suffix: "meses" },
  ];

  const alloc = [
    { label: "Impostos", value: plan.taxes, color: "bg-amber-500" },
    { label: "Retirada extra", value: plan.prolabore, color: "bg-violet-500" },
    { label: "Lucro", value: plan.profit, color: "bg-emerald-500" },
    { label: "Emergência", value: plan.emergency, color: "bg-sky-500" },
    { label: "Operação", value: Math.max(0, plan.operation), color: "bg-slate-400" },
  ];
  const total = Math.max(1, alloc.reduce((a, x) => a + x.value, 0));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px] items-start">
      <div className="space-y-4">
        <Section title="Parâmetros do planejamento" hint="Defina como cada real que entra é repartido. O sistema usa esses percentuais no DRE, na sugestão de preços e nos alertas de saúde financeira.">
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(f => (
              <div key={f.key} className="rounded-xl border p-3">
                <div className="text-xs font-medium">{f.label}</div>
                <div className="text-[11px] text-muted-foreground mb-2">{f.hint}</div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number" min={0} className="h-9"
                    value={Number(state[f.key] ?? 0)}
                    onChange={e => setState(s => ({ ...s, [f.key]: Number(e.target.value) || 0 }))}
                  />
                  <span className="text-xs text-muted-foreground w-12">{f.suffix}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-3">
              <div className="text-xs font-medium">Pró-labore mensal — seu salário (R$)</div>
              <div className="text-[11px] text-muted-foreground mb-2">Deixe 0 para o sistema usar o seu salário cadastrado no RH; se não houver, usa a média dos lançamentos de pró-labore.</div>
              <Input type="number" min={0} className="h-9" value={state.prolabore_monthly}
                onChange={e => setState(s => ({ ...s, prolabore_monthly: Number(e.target.value) || 0 }))} />
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs font-medium">Folha da equipe interna</div>
              <div className="text-[11px] text-muted-foreground mb-2">Somar os salários cadastrados no RH ao custo fixo. Desligue se já lançou os salários na precificação.</div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={state.include_payroll}
                  onChange={e => setState(s => ({ ...s, include_payroll: e.target.checked }))} />
                Incluir folha ({brl0(costBase.payroll)})
              </label>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar parâmetros</Button>
          </div>
        </Section>

        <Section title={`Distribuição da receita de ${monthLabelNow()}`} hint="Aplicação dos percentuais sobre o que entrou neste mês.">
          <div className="flex h-3 w-full overflow-hidden rounded-full">
            {alloc.map(a => <div key={a.label} className={a.color} style={{ width: `${(a.value / total) * 100}%` }} />)}
          </div>
          <div className="grid gap-2 sm:grid-cols-5 mt-3">
            {alloc.map(a => (
              <div key={a.label} className="rounded-lg border px-3 py-2">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={`h-2 w-2 rounded-full ${a.color}`} />{a.label}
                </div>
                <div className="text-sm font-semibold mt-0.5">{brl0(a.value)}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Break-even e meta de faturamento"
          hint="Quanto a agência precisa faturar para empatar (o imposto incide sobre a receita, por isso o custo é dividido por 1 − imposto) e quanto precisa faturar para pagar tudo e ainda cumprir lucro, reserva e investimento."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Custo operacional do mês" value={brl0(be.operatingCost)} sub="Folha + custos fixos + variáveis" />
            <Kpi label="Break-even" value={brl0(be.breakEven)} tone={monthlyRevenue >= be.breakEven ? "good" : "bad"}
              sub={monthlyRevenue >= be.breakEven ? "Já coberto neste mês" : `Faltam ${brl0(be.breakEven - monthlyRevenue)}`} />
            <Kpi label="Meta de faturamento" value={brl0(be.targetRevenue)} tone={monthlyRevenue >= be.targetRevenue ? "good" : "warn"}
              sub={`Lucro ${state.profit_pct}% + reserva ${state.emergency_pct}% + investimento ${state.investment_pct}%`} />
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary" style={{ width: `${Math.min(100, be.targetRevenue > 0 ? (monthlyRevenue / be.targetRevenue) * 100 : 0)}%` }} />
          </div>
          <div className="text-[11px] text-muted-foreground">
            Faturado no mês: {brl0(monthlyRevenue)} · {pct(be.targetRevenue > 0 ? (monthlyRevenue / be.targetRevenue) * 100 : 0)} da meta
          </div>
          <div className="grid gap-2 sm:grid-cols-4 pt-1">
            {[
              { l: "Custos fixos (precificação)", v: costBase.pricingFixed },
              { l: "Lançamentos marcados como custo fixo (média 3 meses)", v: costBase.fixedFromCharges },
              { l: "Folha da equipe interna", v: costBase.payroll },
              { l: costBase.prolaboreSource === "salario" ? "Pró-labore (seu salário no RH)" : "Pró-labore", v: costBase.prolabore },
              { l: "Variáveis (média 3 meses)", v: costBase.variableAvg },
            ].map(x => (
              <div key={x.l} className="rounded-lg border px-3 py-2">
                <div className="text-[11px] text-muted-foreground">{x.l}</div>
                <div className="text-sm font-semibold mt-0.5">{brl0(x.v)}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            O custo é montado pela estrutura cadastrada, não só pelos lançamentos do mês — por isso a meta existe mesmo em um mês ainda sem movimento.
          </p>
        </Section>
      </div>

      <div className="space-y-4">
        <Card className="rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />Reserva de emergência</div>
          <div className="text-2xl font-semibold">{brl0(plan.emergencyTarget)}</div>
          <p className="text-xs text-muted-foreground">
            Meta para cobrir {state.emergency_target_months} {state.emergency_target_months === 1 ? "mês" : "meses"} de operação
            ({brl0(rate.totalMonthly + monthlyDirect)} por mês).
          </p>
          <div className="h-2 rounded bg-muted overflow-hidden">
            <div className="h-full bg-sky-500" style={{ width: `${Math.min(100, plan.emergencyTarget > 0 ? (Math.max(0, accumulated) * (state.emergency_pct / 100) / plan.emergencyTarget) * 100 : 0)}%` }} />
          </div>
          <div className="text-[11px] text-muted-foreground">
            Cobertura atual estimada: {plan.emergencyCoverageMonths.toFixed(1)} meses
          </div>
        </Card>

        <Card className="rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold"><PiggyBank className="h-4 w-4 text-primary" />Saúde do mês</div>
          <div className="flex items-center gap-2 text-sm">
            {plan.healthy
              ? <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Sobra operacional suficiente</>
              : <><AlertTriangle className="h-4 w-4 text-amber-500" /> Operação acima do que sobra</>}
          </div>
          <div className="text-xs text-muted-foreground">
            Sobra para operar: <strong>{brl0(plan.operation)}</strong> · custo de operar: <strong>{brl0(rate.totalMonthly + monthlyDirect)}</strong>
          </div>
          <div className="text-xs text-muted-foreground">Custo/hora atual da agência: <strong>{brl(rate.costPerHour)}</strong></div>
        </Card>
      </div>
    </div>
  );
}

function monthLabelNow() {
  return new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/* ================= Análise inteligente ================= */
export function IntelligencePanel({ data }: { data: FinDataset }) {
  const rate = computeAgencyRate(data.pricing);
  const rows = useMemo(
    () => computeTaskCosts({
      tasks: data.tasks, members: data.members, entries: data.entries, costs: data.costs,
      agencyHourCost: rate.costPerHour,
    }),
    [data.tasks, data.members, data.entries, data.costs, rate.costPerHour],
  );
  const analysis = useMemo(
    () => analyzeByType(rows, data.taskTypes, { targetMarginPct: data.reserves.profit_pct, taxPct: data.reserves.tax_pct }),
    [rows, data.taskTypes, data.reserves],
  );
  const [openType, setOpenType] = useState<string | null>(null);

  const totalCost = analysis.reduce((a, t) => a + t.cost, 0);
  const totalRevenue = analysis.reduce((a, t) => a + t.revenue, 0);
  const losing = analysis.filter(t => t.verdict === "prejuizo");
  const unpriced = analysis.filter(t => t.verdict === "sem-preco");

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Kpi label="Custo de mão de obra" value={brl0(totalCost)} sub="Horas apontadas/estimadas × custo da pessoa" />
        <Kpi label="Receita das tarefas" value={brl0(totalRevenue)} />
        <Kpi label="Margem" value={pct(totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0)} tone={totalRevenue - totalCost >= 0 ? "good" : "bad"} />
        <Kpi label="Serviços no prejuízo" value={String(losing.length)} tone={losing.length ? "bad" : "good"} sub={unpriced.length ? `${unpriced.length} sem preço definido` : undefined} />
      </div>

      {(losing.length > 0 || unpriced.length > 0) && (
        <Card className="rounded-2xl p-5 space-y-2 border-amber-500/40">
          <div className="flex items-center gap-2 text-sm font-semibold"><Lightbulb className="h-4 w-4 text-amber-500" />Recomendações</div>
          <ul className="space-y-1.5 text-sm">
            {losing.map(t => (
              <li key={t.typeId} className="flex items-start gap-2">
                <TrendingDown className="h-4 w-4 mt-0.5 text-red-500 shrink-0" />
                <span>
                  <strong>{t.name}</strong> está custando {brl(t.avgCost)} por entrega e sendo cobrado {brl(t.avgRevenue)}.
                  Preço mínimo sugerido: <strong>{brl(t.suggestedPrice)}</strong> ({pct(t.suggestedPrice > 0 ? ((t.suggestedPrice / Math.max(1, t.avgRevenue)) - 1) * 100 : 0)} de reajuste).
                </span>
              </li>
            ))}
            {unpriced.map(t => (
              <li key={t.typeId} className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span>
                  <strong>{t.name}</strong> não tem valor de faturamento registrado. Com o custo médio de {brl(t.avgCost)},
                  o valor sugerido é <strong>{brl(t.suggestedPrice)}</strong>.
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Section
        title="Rentabilidade por tipo de serviço"
        hint={`Preço sugerido = custo médio ÷ (1 − ${data.reserves.profit_pct}% de lucro) ÷ (1 − ${data.reserves.tax_pct}% de impostos). Ajuste os percentuais no Planejador.`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm [&_th]:px-2 [&_td]:px-2 whitespace-nowrap">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted-foreground text-left">
                <th className="py-2">Serviço</th>
                <th className="py-2 text-right">Tarefas</th>
                <th className="py-2 text-right">Horas médias</th>
                <th className="py-2 text-right">Custo médio</th>
                <th className="py-2 text-right">Preço médio</th>
                <th className="py-2 text-right">Margem</th>
                <th className="py-2 text-right">Preço sugerido</th>
                <th className="py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {analysis.map(t => (
                <TypeRow key={t.typeId} t={t} rows={rows} open={openType === t.typeId} onToggle={() => setOpenType(openType === t.typeId ? null : t.typeId)} />
              ))}
              {analysis.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-sm text-muted-foreground">Sem tarefas para analisar ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function TypeRow({ t, rows, open, onToggle }: { t: TypeAnalysis; rows: ReturnType<typeof computeTaskCosts>; open: boolean; onToggle: () => void }) {
  const badge = {
    lucrativo: { label: "Lucrativo", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: TrendingUp },
    "no-limite": { label: "No limite", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Percent },
    prejuizo: { label: "Prejuízo", cls: "bg-red-500/15 text-red-600 dark:text-red-400", icon: TrendingDown },
    "sem-preco": { label: "Sem preço", cls: "bg-muted text-muted-foreground", icon: Wallet },
  }[t.verdict];
  const Icon = badge.icon;
  const detail = rows.filter(r => (r.task.task_type_id ?? "sem-tipo") === t.typeId).slice(0, 8);

  return (
    <>
      <tr className="border-t cursor-pointer hover:bg-muted/40" onClick={onToggle}>
        <td className="py-2 font-medium">{t.name}</td>
        <td className="py-2 text-right">{t.count}</td>
        <td className="py-2 text-right">{t.avgHours.toFixed(1)}h</td>
        <td className="py-2 text-right">{brl(t.avgCost)}</td>
        <td className="py-2 text-right">{t.avgRevenue > 0 ? brl(t.avgRevenue) : "—"}</td>
        <td className={`py-2 text-right ${t.marginPct < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
          {t.revenue > 0 ? pct(t.marginPct) : "—"}
        </td>
        <td className="py-2 text-right font-semibold text-primary">{t.suggestedPrice > 0 ? brl(t.suggestedPrice) : "—"}</td>
        <td className="py-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${badge.cls}`}>
            <Icon className="h-3 w-3" />{badge.label}
          </span>
        </td>
      </tr>
      {open && (
        <tr className="border-t bg-muted/30">
          <td colSpan={8} className="p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Últimas tarefas deste serviço</div>
            <div className="space-y-1">
              {detail.map(r => (
                <div key={r.task.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate flex-1">{r.task.title}</span>
                  <span className="text-muted-foreground">{r.hours.toFixed(1)}h ({r.hoursSource})</span>
                  <span>custo {brl(r.totalCost)}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className={r.margin >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {r.revenue > 0 ? `${brl(r.revenue)} · ${pct(r.marginPct)}` : "sem faturamento"}
                  </span>
                </div>
              ))}
              {detail.length === 0 && <div className="text-xs text-muted-foreground">Sem tarefas.</div>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export const DEFAULT_RESERVE_SETTINGS = DEFAULT_RESERVES;


/* ================= Meta do mês (banner da visão geral) ================= */
export function MonthGoalBanner({ data, onOpenPlanner }: { data: FinDataset; onOpenPlanner?: () => void }) {
  const rate = computeAgencyRate(data.pricing);
  const thisMonth = monthKey(new Date());

  const costBase = useMemo(() => computeCostBase({
    pricingFixed: rate.fixed,
    pricingVariable: rate.variable,
    members: data.members,
    charges: data.charges,
    costs: data.costs,
    reserves: data.reserves,
    currentUserId: data.currentUserId,
  }), [rate.fixed, rate.variable, data.members, data.charges, data.costs, data.reserves, data.currentUserId]);

  const be = computeBreakEven({
    operatingCost: costBase.total,
    taxPct: data.reserves.tax_pct,
    profitPct: data.reserves.profit_pct,
    emergencyPct: data.reserves.emergency_pct,
    investmentPct: data.reserves.investment_pct,
  });

  const billed = useMemo(
    () => data.charges
      .filter(c => c.status !== "cancelled" && c.status !== "draft" && isReceitaOperacional(c))
      .filter(c => monthKey(c.competence_month ?? c.paid_at ?? c.due_date ?? new Date().toISOString()) === thisMonth)
      .reduce((a, c) => a + Math.abs(num(c.amount)), 0),
    [data.charges, thisMonth],
  );

  const bePct = be.breakEven > 0 ? (billed / be.breakEven) * 100 : 0;
  const goalPct = be.targetRevenue > 0 ? (billed / be.targetRevenue) * 100 : 0;
  const missing = Math.max(0, be.breakEven - billed);
  const missingGoal = Math.max(0, be.targetRevenue - billed);

  return (
    <Card className="rounded-2xl p-5 mb-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold"><Target className="h-4 w-4 text-primary" />Quanto preciso faturar neste mês</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Custo para manter a agência de pé: {brl0(costBase.total)} por mês (fixos {brl0(costBase.fixedTotal)} · folha {brl0(costBase.payroll)} · pró-labore {brl0(costBase.prolabore)}{costBase.prolaboreSource === "salario" ? " (seu salário)" : ""} · variáveis {brl0(costBase.variableAvg)}).
          </p>
        </div>
        {onOpenPlanner && (
          <button onClick={onOpenPlanner} className="h-8 shrink-0 rounded-lg border px-3 text-xs hover:bg-muted">Ajustar parâmetros</button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Faturado no mês" value={brl0(billed)} sub="Receita operacional na competência" />
        <Kpi label="Ponto de equilíbrio" value={brl0(be.breakEven)} tone={billed >= be.breakEven ? "good" : "bad"}
          sub={billed >= be.breakEven ? "Contas do mês cobertas" : `Faltam ${brl0(missing)}`} />
        <Kpi label="Meta saudável" value={brl0(be.targetRevenue)} tone={billed >= be.targetRevenue ? "good" : "warn"}
          sub={billed >= be.targetRevenue ? "Lucro e reservas garantidos" : `Faltam ${brl0(missingGoal)}`} />
      </div>

      <div className="space-y-1">
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: `${Math.min(100, Math.max(0, goalPct))}%` }} />
          <div className="absolute inset-y-0 w-0.5 bg-foreground/50"
            style={{ left: `${be.targetRevenue > 0 ? Math.min(100, (be.breakEven / be.targetRevenue) * 100) : 0}%` }} />
        </div>
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{pct(bePct)} do ponto de equilíbrio</span>
          <span>{pct(goalPct)} da meta saudável</span>
        </div>
      </div>
    </Card>
  );
}
