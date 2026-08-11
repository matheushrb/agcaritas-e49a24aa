/* ===========================================================
   Motor de análise financeira da agência
   - Custo real de mão de obra por tarefa / tipo de serviço
   - DRE mensal (competência)
   - Fluxo de caixa projetado
   - Reservas (emergência, lucro, impostos, pró-labore)
   Tudo determinístico, sem IA — custo zero.
   =========================================================== */

export type FinMember = {
  id: string;
  user_id?: string | null;
  name: string;
  cost_mode: string | null;
  monthly_salary: number | string | null;
  monthly_hours: number | string | null;
  hourly_rate: number | string | null;
  default_task_rate: number | string | null;
  task_rate_overrides: any;
};

export type FinTask = {
  id: string;
  title: string;
  status: string | null;
  task_type_id: string | null;
  assignee_id: string | null;
  project_id: string | null;
  estimated_hours: number | string | null;
  billing_value: number | string | null;
  billing_base_value: number | string | null;
  billing_enabled: boolean | null;
  created_at: string;
};

export type FinTimeEntry = { id: string; task_id: string | null; user_id: string | null; duration_seconds: number | null };
export type FinProjectCost = { id: string; task_id: string | null; project_id: string | null; amount: number | string; kind: string; status: string; occurred_on: string };
export type FinTaskType = { id: string; name: string; color?: string | null; default_price?: number | string | null };
export type FinCharge = {
  id: string;
  description: string | null;
  amount: number | string;
  status: string;
  type?: string | null;
  nature?: string | null;
  category?: string | null;
  due_date: string | null;
  paid_at: string | null;
  competence_month?: string | null;
  accounting_nature?: string | null;
  client_id: string | null;
  project_id: string | null;
};

/* --------- naturezas contábeis --------- */
export type AccountingNature =
  | "recebimento_cliente" | "servico_avulso"
  | "imposto" | "custo_fixo" | "custo_variavel" | "midia_paga" | "reembolso_pago"
  | "pro_labore" | "saque" | "investimento";

export const ACCOUNTING_NATURES: { value: AccountingNature; label: string; side: "revenue" | "expense"; hint: string }[] = [
  { value: "recebimento_cliente", label: "Recebimento de cliente", side: "revenue", hint: "Receita operacional de fatura/contrato" },
  { value: "servico_avulso", label: "Serviço avulso", side: "revenue", hint: "Receita pontual fora de projeto" },
  { value: "imposto", label: "Imposto", side: "expense", hint: "Tributo sobre faturamento — deduz da receita bruta" },
  { value: "custo_fixo", label: "Custo fixo", side: "expense", hint: "Estrutura: aluguel, software, salários" },
  { value: "custo_variavel", label: "Custo variável", side: "expense", hint: "Ligado à entrega" },
  { value: "midia_paga", label: "Mídia paga", side: "expense", hint: "Verba de mídia repassada" },
  { value: "reembolso_pago", label: "Reembolso pago", side: "expense", hint: "Reembolso a colaborador/fornecedor" },
  { value: "pro_labore", label: "Pró-labore", side: "expense", hint: "Remuneração de sócios — abaixo do resultado operacional" },
  { value: "saque", label: "Saque de capital", side: "expense", hint: "Retirada — NÃO é despesa, fica fora do DRE" },
  { value: "investimento", label: "Investimento", side: "expense", hint: "Aquisição de ativo — NÃO é despesa, fica fora do DRE" },
];

export const natureLabel = (v?: string | null) =>
  ACCOUNTING_NATURES.find(n => n.value === v)?.label ?? "—";

/** Natureza contábil efetiva, com fallback pelo lado receita/despesa. */
export const accNature = (c: FinCharge): AccountingNature => {
  const v = c.accounting_nature as AccountingNature | null | undefined;
  if (v && ACCOUNTING_NATURES.some(n => n.value === v)) return v;
  const isExpense = (c.nature ?? c.type ?? "income") === "expense" || num(c.amount) < 0;
  return isExpense ? "custo_variavel" : "recebimento_cliente";
};

export const isReceitaOperacional = (c: FinCharge) => ["recebimento_cliente", "servico_avulso"].includes(accNature(c));
export const isDespesaOperacional = (c: FinCharge) => ["custo_fixo", "custo_variavel", "midia_paga", "reembolso_pago"].includes(accNature(c));
export const isForaDoDre = (c: FinCharge) => ["saque", "investimento"].includes(accNature(c));

export type ReserveSettings = {
  emergency_pct: number;      // % da receita destinada ao caixa de emergência
  emergency_target_months: number; // meses de operação a cobrir
  profit_pct: number;         // % de lucro (distribuição/reinvestimento)
  tax_pct: number;            // % impostos
  prolabore_pct: number;      // % pró-labore
  investment_pct: number;     // % capital de investimento
};

export const DEFAULT_RESERVES: ReserveSettings = {
  emergency_pct: 10,
  emergency_target_months: 3,
  profit_pct: 15,
  tax_pct: 6,
  prolabore_pct: 20,
  investment_pct: 10,
};

export const num = (v: unknown) => Number(v ?? 0) || 0;
export const brl = (v: number) =>
  `R$ ${(Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const brl0 = (v: number) =>
  `R$ ${(Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
export const pct = (v: number) => `${(Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export const monthKey = (d: Date | string) => {
  const dt = typeof d === "string" ? new Date(`${d.slice(0, 10)}T12:00:00`) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};
const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`;
};
export const lastMonths = (count: number, endsAt = new Date()) => {
  const out: string[] = [];
  const d = new Date(endsAt.getFullYear(), endsAt.getMonth(), 1);
  for (let i = count - 1; i >= 0; i--) out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  return out;
};
export const nextMonths = (count: number, startsAt = new Date()) => {
  const out: string[] = [];
  const d = new Date(startsAt.getFullYear(), startsAt.getMonth(), 1);
  for (let i = 0; i < count; i++) out.push(monthKey(new Date(d.getFullYear(), d.getMonth() + i, 1)));
  return out;
};

/* --------- custo/hora de cada pessoa --------- */
export function memberHourCost(m: FinMember): number {
  const mode = m.cost_mode ?? "internal_fixed";
  if (mode === "freelancer_per_hour") return num(m.hourly_rate);
  if (mode === "internal_fixed") {
    const hours = num(m.monthly_hours) || 160;
    const salary = num(m.monthly_salary);
    if (salary > 0) return salary / hours;
  }
  return num(m.hourly_rate);
}

export function memberTaskCost(m: FinMember, taskTypeId: string | null): number {
  const overrides = (m.task_rate_overrides ?? {}) as Record<string, unknown>;
  if (taskTypeId && overrides && num(overrides[taskTypeId]) > 0) return num(overrides[taskTypeId]);
  return num(m.default_task_rate);
}

/* --------- custo de mão de obra por tarefa --------- */
export type TaskCostRow = {
  task: FinTask;
  hours: number;
  hoursSource: "apontado" | "estimado" | "sem-dado";
  laborCost: number;
  directCost: number;
  totalCost: number;
  revenue: number;
  margin: number;      // R$
  marginPct: number;   // %
};

export function computeTaskCosts(input: {
  tasks: FinTask[];
  members: FinMember[];
  entries: FinTimeEntry[];
  costs: FinProjectCost[];
  agencyHourCost: number; // custo/hora estrutural da agência (rateio)
}): TaskCostRow[] {
  const { tasks, members, entries, costs, agencyHourCost } = input;
  const byUser = new Map(members.map(m => [m.user_id ?? m.id, m] as const));
  const byId = new Map(members.map(m => [m.id, m] as const));

  const hoursByTask = new Map<string, { hours: number; cost: number }>();
  for (const e of entries) {
    if (!e.task_id) continue;
    const h = (e.duration_seconds ?? 0) / 3600;
    const m = (e.user_id && byUser.get(e.user_id)) || null;
    const rate = m ? memberHourCost(m) || agencyHourCost : agencyHourCost;
    const cur = hoursByTask.get(e.task_id) ?? { hours: 0, cost: 0 };
    cur.hours += h;
    cur.cost += h * rate;
    hoursByTask.set(e.task_id, cur);
  }

  const directByTask = new Map<string, number>();
  for (const c of costs) {
    if (!c.task_id || c.status === "cancelled") continue;
    directByTask.set(c.task_id, (directByTask.get(c.task_id) ?? 0) + num(c.amount));
  }

  return tasks.map(t => {
    const tracked = hoursByTask.get(t.id);
    const assignee = t.assignee_id ? byId.get(t.assignee_id) ?? byUser.get(t.assignee_id) ?? null : null;
    const perTask = assignee ? memberTaskCost(assignee, t.task_type_id) : 0;

    let hours = 0;
    let hoursSource: TaskCostRow["hoursSource"] = "sem-dado";
    let laborCost = 0;

    if (tracked && tracked.hours > 0) {
      hours = tracked.hours;
      hoursSource = "apontado";
      laborCost = tracked.cost;
    } else if (num(t.estimated_hours) > 0) {
      hours = num(t.estimated_hours);
      hoursSource = "estimado";
      const rate = assignee ? memberHourCost(assignee) || agencyHourCost : agencyHourCost;
      laborCost = hours * rate;
    } else if (perTask > 0) {
      laborCost = perTask;
    }

    // freelancer por tarefa: custo fixo por entrega prevalece se maior
    if (perTask > 0 && assignee?.cost_mode === "freelancer_per_task") laborCost = perTask;

    const directCost = directByTask.get(t.id) ?? 0;
    const totalCost = laborCost + directCost;
    const revenue = num(t.billing_base_value) || num(t.billing_value);
    const margin = revenue - totalCost;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

    return { task: t, hours, hoursSource, laborCost, directCost, totalCost, revenue, margin, marginPct };
  });
}

/* --------- consolidação por tipo de serviço --------- */
export type TypeAnalysis = {
  typeId: string;
  name: string;
  count: number;
  billedCount: number;
  hours: number;
  avgHours: number;
  cost: number;
  avgCost: number;
  revenue: number;
  avgRevenue: number;
  margin: number;
  marginPct: number;
  suggestedPrice: number;
  verdict: "lucrativo" | "no-limite" | "prejuizo" | "sem-preco";
};

export function analyzeByType(
  rows: TaskCostRow[],
  types: FinTaskType[],
  opts: { targetMarginPct: number; taxPct: number },
): TypeAnalysis[] {
  const margin = Math.min(0.95, Math.max(0, opts.targetMarginPct / 100));
  const tax = Math.min(0.95, Math.max(0, opts.taxPct / 100));
  const byType = new Map<string, TaskCostRow[]>();
  for (const r of rows) {
    const key = r.task.task_type_id ?? "sem-tipo";
    const arr = byType.get(key) ?? [];
    arr.push(r);
    byType.set(key, arr);
  }
  const nameOf = (id: string) => types.find(t => t.id === id)?.name ?? "Sem tipo definido";

  const out: TypeAnalysis[] = [];
  for (const [typeId, list] of byType) {
    const count = list.length;
    const hours = list.reduce((a, r) => a + r.hours, 0);
    const cost = list.reduce((a, r) => a + r.totalCost, 0);
    const revenue = list.reduce((a, r) => a + r.revenue, 0);
    const billedCount = list.filter(r => r.revenue > 0).length;
    const avgCost = count ? cost / count : 0;
    const avgRevenue = billedCount ? revenue / billedCount : 0;
    const m = revenue - cost;
    const marginPct = revenue > 0 ? (m / revenue) * 100 : 0;
    const suggestedPrice = avgCost > 0 ? avgCost / (1 - margin) / (1 - tax) : 0;
    const verdict: TypeAnalysis["verdict"] =
      revenue <= 0 ? "sem-preco" : marginPct >= opts.targetMarginPct ? "lucrativo" : marginPct >= 0 ? "no-limite" : "prejuizo";
    out.push({
      typeId, name: nameOf(typeId), count, billedCount, hours,
      avgHours: count ? hours / count : 0,
      cost, avgCost, revenue, avgRevenue, margin: m, marginPct, suggestedPrice, verdict,
    });
  }
  return out.sort((a, b) => b.cost - a.cost);
}

/* --------- DRE mensal (por natureza contábil) --------- */
export type DreMonth = {
  key: string;
  label: string;
  grossRevenue: number;
  taxes: number;
  netRevenue: number;
  fixedCosts: number;      // custo_fixo lançado + estrutura da precificação
  variableCosts: number;   // custo_variavel + mídia paga + custos de projeto
  reimbursements: number;
  operatingResult: number;
  prolabore: number;
  periodResult: number;
  withdrawals: number;     // saque — fora do DRE, só informativo
  investments: number;     // investimento — fora do DRE, só informativo
  marginPct: number;
};

export function buildDre(input: {
  charges: FinCharge[];
  costs: FinProjectCost[];
  months: string[];
  fixedMonthly: number;
  taxPct: number;
}): DreMonth[] {
  const { charges, costs, months, fixedMonthly, taxPct } = input;
  const acc = new Map<string, Record<string, number>>();
  const bucket = (k: string) => {
    let b = acc.get(k);
    if (!b) { b = {}; acc.set(k, b); }
    return b;
  };
  const add = (k: string, field: string, v: number) => {
    const b = bucket(k);
    b[field] = (b[field] ?? 0) + v;
  };

  for (const c of charges) {
    if (c.status === "cancelled" || c.status === "draft") continue;
    const ref = c.competence_month ?? c.paid_at ?? c.due_date;
    if (!ref) continue;
    const k = monthKey(ref);
    add(k, accNature(c), Math.abs(num(c.amount)));
  }
  for (const c of costs) {
    if (c.status === "cancelled") continue;
    add(monthKey(c.occurred_on), "custo_variavel", num(c.amount));
  }

  return months.map(k => {
    const b = acc.get(k) ?? {};
    const grossRevenue = (b["recebimento_cliente"] ?? 0) + (b["servico_avulso"] ?? 0);
    // imposto lançado tem precedência; sem lançamento, estima pelo percentual do planejador
    const taxes = (b["imposto"] ?? 0) > 0 ? b["imposto"] : grossRevenue * (taxPct / 100);
    const netRevenue = grossRevenue - taxes;
    const fixedCosts = (b["custo_fixo"] ?? 0) + fixedMonthly;
    const variableCosts = (b["custo_variavel"] ?? 0) + (b["midia_paga"] ?? 0);
    const reimbursements = b["reembolso_pago"] ?? 0;
    const operatingResult = netRevenue - fixedCosts - variableCosts - reimbursements;
    const prolabore = b["pro_labore"] ?? 0;
    const periodResult = operatingResult - prolabore;
    return {
      key: k,
      label: monthLabel(k),
      grossRevenue, taxes, netRevenue, fixedCosts, variableCosts, reimbursements,
      operatingResult, prolabore, periodResult,
      withdrawals: b["saque"] ?? 0,
      investments: b["investimento"] ?? 0,
      marginPct: grossRevenue > 0 ? (periodResult / grossRevenue) * 100 : 0,
    };
  });
}

/* --------- break-even e meta de faturamento --------- */
export type BreakEven = { operatingCost: number; breakEven: number; targetRevenue: number };

export function computeBreakEven(input: {
  operatingCost: number;   // folha + custos fixos + variáveis previstos do mês
  taxPct: number;
  profitPct: number;
  emergencyPct: number;
  investmentPct: number;
}): BreakEven {
  const tax = Math.min(0.95, Math.max(0, input.taxPct / 100));
  const breakEven = input.operatingCost / (1 - tax);
  const targetRevenue = breakEven * (1 + input.profitPct / 100 + input.emergencyPct / 100 + input.investmentPct / 100);
  return { operatingCost: input.operatingCost, breakEven, targetRevenue };
}

/* --------- fluxo de caixa (realizado + previsto) --------- */
export type CashMonth = {
  key: string; label: string;
  inflow: number; outflow: number; net: number; balance: number;
  projected: boolean;
};

export function buildCashflow(input: {
  charges: FinCharge[];
  costs: FinProjectCost[];
  months: string[];
  fixedMonthly: number;
  openingBalance: number;
}): CashMonth[] {
  const { charges, costs, months, fixedMonthly, openingBalance } = input;
  const nowKey = monthKey(new Date());
  const inc = new Map<string, number>();
  const exp = new Map<string, number>();

  for (const c of charges) {
    if (c.status === "cancelled" || c.status === "draft") continue;
    const ref = c.paid_at ?? c.due_date ?? c.competence_month;
    if (!ref) continue;
    const k = monthKey(ref);
    const amount = Math.abs(num(c.amount));
    const isExpense = !isReceitaOperacional(c);
    (isExpense ? exp : inc).set(k, ((isExpense ? exp : inc).get(k) ?? 0) + amount);
  }
  for (const c of costs) {
    if (c.status === "cancelled") continue;
    const k = monthKey(c.occurred_on);
    exp.set(k, (exp.get(k) ?? 0) + num(c.amount));
  }

  let balance = openingBalance;
  return months.map(k => {
    const inflow = inc.get(k) ?? 0;
    const outflow = (exp.get(k) ?? 0) + fixedMonthly;
    const net = inflow - outflow;
    balance += net;
    return { key: k, label: monthLabel(k), inflow, outflow, net, balance, projected: k > nowKey };
  });
}

/* --------- planejador de reservas --------- */
export type ReservePlan = {
  base: number;
  taxes: number;
  prolabore: number;
  profit: number;
  emergency: number;
  operation: number;
  emergencyTarget: number;
  emergencyCoverageMonths: number;
  healthy: boolean;
};

export function planReserves(input: {
  monthlyRevenue: number;
  monthlyFixedCosts: number;
  monthlyDirectCosts: number;
  reserves: ReserveSettings;
  accumulatedEmergency: number;
}): ReservePlan {
  const { monthlyRevenue, monthlyFixedCosts, monthlyDirectCosts, reserves, accumulatedEmergency } = input;
  const base = monthlyRevenue;
  const taxes = base * (reserves.tax_pct / 100);
  const prolabore = base * (reserves.prolabore_pct / 100);
  const profit = base * (reserves.profit_pct / 100);
  const emergency = base * (reserves.emergency_pct / 100);
  const operation = base - taxes - prolabore - profit - emergency;
  const monthlyBurn = monthlyFixedCosts + monthlyDirectCosts;
  const emergencyTarget = monthlyBurn * reserves.emergency_target_months;
  return {
    base, taxes, prolabore, profit, emergency, operation,
    emergencyTarget,
    emergencyCoverageMonths: monthlyBurn > 0 ? accumulatedEmergency / monthlyBurn : 0,
    healthy: operation >= monthlyBurn,
  };
}
