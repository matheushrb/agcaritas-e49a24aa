import { monthlyCost, type CompEvent, type HrMember } from "@/lib/hr";

export type PayrollLine = {
  key: string;
  memberId: string;
  memberName: string;
  kind: "salary" | "bonus";
  description: string;
  amount: number;
  dueDate: string; // yyyy-mm-dd
  category: string;
};

export const PAYROLL_CATEGORY = "Folha de pagamento";
export const BONUS_CATEGORY = "Bônus";

export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function dueOn(ym: string, day: number | null | undefined) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  const d = Math.min(Math.max(Number(day ?? last), 1), last);
  return `${ym}-${String(d).padStart(2, "0")}`;
}

/** Linhas da folha do mês: salários fixos + bônus com vigência no mês. */
export function buildPayrollLines(members: HrMember[], events: CompEvent[], ym: string): PayrollLine[] {
  const lines: PayrollLine[] = [];

  for (const m of members) {
    if (m.status === "inactive") continue;
    const amount = monthlyCost(m);
    if (!amount) continue;
    lines.push({
      key: `salary:${m.id}`,
      memberId: m.id,
      memberName: m.name,
      kind: "salary",
      description: `Folha · ${m.name}`,
      amount,
      dueDate: dueOn(ym, m.payment_day),
      category: PAYROLL_CATEGORY,
    });
  }

  const byId = new Map(members.map(m => [m.id, m]));
  for (const e of events) {
    if (e.kind !== "bonus" || e.status === "cancelled") continue;
    const amount = Number(e.amount ?? 0);
    if (!amount) continue;
    if (!String(e.effective_date ?? "").startsWith(ym)) continue;
    const m = byId.get(e.member_id);
    lines.push({
      key: `bonus:${e.id}`,
      memberId: e.member_id,
      memberName: m?.name ?? "—",
      kind: "bonus",
      description: `Bônus · ${m?.name ?? "colaborador"}`,
      amount,
      dueDate: dueOn(ym, m?.payment_day),
      category: BONUS_CATEGORY,
    });
  }

  return lines.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.memberName.localeCompare(b.memberName));
}

/** Provisão mensal de 13º salário (1/12 da folha fixa). */
export function thirteenthProvision(members: HrMember[]) {
  return members
    .filter(m => m.status !== "inactive" && m.contract_type === "internal")
    .reduce((s, m) => s + monthlyCost(m) / 12, 0);
}
