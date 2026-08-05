import type { CostMode } from "@/components/team-cost-fields";

export type HrContractType = "internal" | "freelancer_task" | "freelancer_hour" | "contractor" | "company";
export type TeamLevel = "junior" | "mid" | "senior" | "lead";
export type TeamStatus = "active" | "inactive" | "away" | "vacation";

export type HrMember = {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  specialty: string | null;
  level: TeamLevel | null;
  status: TeamStatus | null;
  hourly_rate: number | null;
  avatar_url: string | null;
  cost_mode: CostMode;
  monthly_salary: number | null;
  monthly_hours: number | null;
  default_task_rate: number | null;
  task_rate_overrides: Record<string, number>;
  cost_notes: string | null;
  contract_type: HrContractType;
  area: string | null;
  admitted_on: string | null;
  birth_date: string | null;
  work_location: string | null;
  hr_notes: string | null;
  company_legal_name: string | null;
  company_tax_id: string | null;
  company_contact: string | null;
};

export const MEMBER_COLUMNS =
  "id,user_id,name,email,phone,role,specialty,level,status,hourly_rate,avatar_url,cost_mode,monthly_salary,monthly_hours,default_task_rate,task_rate_overrides,cost_notes,contract_type,area,admitted_on,birth_date,work_location,hr_notes,company_legal_name,company_tax_id,company_contact";

export const CONTRACT_TYPES: Record<HrContractType, { label: string; short: string; tone: string; dot: string; note: string }> = {
  internal: {
    label: "Interno", short: "Internos",
    tone: "bg-blue-500/12 text-blue-700 dark:text-blue-300 border-blue-500/30",
    dot: "bg-blue-500",
    note: "Salário fixo, jornada, férias e custo-hora.",
  },
  freelancer_task: {
    label: "Freelancer por tarefa", short: "Freela · tarefa",
    tone: "bg-purple-500/12 text-purple-700 dark:text-purple-300 border-purple-500/30",
    dot: "bg-purple-500",
    note: "Valor por tarefa/tipo e pagamento por entrega.",
  },
  freelancer_hour: {
    label: "Freelancer por hora", short: "Freela · hora",
    tone: "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30",
    dot: "bg-amber-500",
    note: "Valor-hora, timesheet e custo automático.",
  },
  contractor: {
    label: "Terceirizado", short: "Terceirizados",
    tone: "bg-teal-500/12 text-teal-700 dark:text-teal-300 border-teal-500/30",
    dot: "bg-teal-500",
    note: "Contrato, valor e documentos.",
  },
  company: {
    label: "Empresa terceirizada", short: "Empresas",
    tone: "bg-slate-500/14 text-slate-700 dark:text-slate-300 border-slate-500/30",
    dot: "bg-slate-500",
    note: "Dados empresariais, contatos, contrato e pagamentos.",
  },
};

export const LEVEL_LABEL: Record<string, string> = { junior: "Júnior", mid: "Pleno", senior: "Sênior", lead: "Lead" };

export const STATUS_META: Record<string, { label: string; tone: string }> = {
  active: { label: "Ativo", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  inactive: { label: "Inativo", tone: "bg-muted text-muted-foreground" },
  away: { label: "Ausente", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  vacation: { label: "Férias", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
};

export function initialsOf(name: string) {
  return (name || "?").split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const brl2 = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Custo mensal estimado (0 quando é variável e não há base fixa). */
export function monthlyCost(m: HrMember): number {
  switch (m.cost_mode) {
    case "internal_fixed":
      return Number(m.monthly_salary ?? 0);
    case "freelancer_per_hour":
      return Number(m.hourly_rate ?? 0) * Number(m.monthly_hours ?? 0);
    case "freelancer_per_task":
      return 0;
    default:
      return 0;
  }
}

export function hourCost(m: HrMember): number | null {
  if (m.cost_mode === "freelancer_per_hour") return Number(m.hourly_rate ?? 0) || null;
  const hours = Number(m.monthly_hours ?? 0);
  const salary = Number(m.monthly_salary ?? 0);
  if (!hours || !salary) return null;
  return salary / hours;
}

export function costSummary(m: HrMember): string {
  switch (m.cost_mode) {
    case "internal_fixed":
      return m.monthly_salary ? `${brl(Number(m.monthly_salary))}/mês` : "sem salário";
    case "freelancer_per_hour":
      return m.hourly_rate ? `${brl2(Number(m.hourly_rate))}/h` : "sem valor/h";
    case "freelancer_per_task":
      return m.default_task_rate ? `${brl2(Number(m.default_task_rate))}/tarefa` : "sem valor/tarefa";
    default:
      return "custo manual";
  }
}

/** Aniversário nos próximos N dias (ignora o ano). */
export function birthdayInDays(birth: string | null, days = 45): number | null {
  if (!birth) return null;
  const d = new Date(birth + "T12:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  const diff = Math.round((next.getTime() - today.getTime()) / 86400000);
  return diff <= days ? diff : null;
}

export function fmtDay(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function fmtFull(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? iso + "T12:00:00" : iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}
