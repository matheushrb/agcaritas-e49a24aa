import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, Gift, Wallet, TrendingUp, AlertTriangle, PiggyBank, Check, ArrowRightLeft } from "lucide-react";
import { useCompensationEvents } from "@/components/hr-compensation";
import {
  BONUS_CATEGORY, PAYROLL_CATEGORY, buildPayrollLines, monthKey, monthLabel, thirteenthProvision,
} from "@/lib/payroll";
import {
  COMP_KIND_META, COMP_STATUS_META, brl, brl2, fmtFull, initialsOf, monthlyCost,
  nextPaymentDate, daysUntil, monthsSinceReview, reviewOverdue, type HrMember,
} from "@/lib/hr";


export function Rh04Payroll({ members }: { members: HrMember[] }) {
  const { data: events = [] } = useCompensationEvents();
  const memberById = useMemo(() => new Map(members.map(m => [m.id, m])), [members]);

  const schedule = useMemo(() => {
    return members
      .filter(m => m.status !== "inactive")
      .map(m => ({ m, date: nextPaymentDate(m.payment_day), cost: monthlyCost(m) }))
      .sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.getTime() - b.date.getTime();
      });
  }, [members]);

  const totals = useMemo(() => {
    const payroll = schedule.reduce((s, r) => s + r.cost, 0);
    const next7 = schedule.filter(r => {
      const d = daysUntil(r.date);
      return d !== null && d <= 7;
    });
    const pendingBonus = events
      .filter(e => e.kind === "bonus" && (e.status === "planned" || e.status === "approved"))
      .reduce((s, e) => s + Number(e.amount ?? 0), 0);
    const year = new Date().getFullYear();
    const raisesYear = events.filter(e =>
      (e.kind === "raise" || e.kind === "promotion") && e.status !== "cancelled" &&
      new Date(e.effective_date).getFullYear() === year).length;
    return { payroll, next7, pendingBonus, raisesYear };
  }, [schedule, events]);

  const overdueReviews = useMemo(
    () => members.filter(m => m.status !== "inactive" && reviewOverdue(m)),
    [members],
  );

  const pendingBonuses = useMemo(
    () => events.filter(e => e.kind === "bonus" && (e.status === "planned" || e.status === "approved")),
    [events],
  );

  const recent = useMemo(() => events.slice(0, 8), [events]);

  const [ym, setYm] = useState(monthKey());
  const lines = useMemo(() => buildPayrollLines(members, events, ym), [members, events, ym]);
  const provision = useMemo(() => thirteenthProvision(members), [members]);

  const qc = useQueryClient();
  const { data: posted = [] } = useQuery({
    queryKey: ["payroll-charges", ym],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("charges")
        .select("id,description,amount,collaborator_id,category,status")
        .eq("competence_month", `${ym}-01`)
        .in("category", [PAYROLL_CATEGORY, BONUS_CATEGORY]);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; description: string; amount: number; status: string }>;
    },
  });

  const postedByDesc = useMemo(
    () => new Map(posted.map(c => [c.description, c])),
    [posted],
  );
  const missing = useMemo(() => lines.filter(l => !postedByDesc.has(l.description)), [lines, postedByDesc]);

  const post = useMutation({
    mutationFn: async () => {
      if (missing.length === 0) return 0;
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const rows = missing.map(l => ({
        organization_id: profile.organization_id,
        description: l.description,
        amount: l.amount,
        nature: "expense",
        category: l.category,
        status: "pending",
        due_date: l.dueDate,
        competence_month: `${ym}-01`,
        collaborator_id: l.memberId,
      }));
      const { error } = await (supabase as any).from("charges").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["payroll-charges", ym] });
      qc.invalidateQueries({ queryKey: ["charges"] });
      toast.success(n ? `${n} lançamento(s) enviados ao Financeiro` : "Nada a lançar");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalMonth = lines.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi icon={Wallet} label="Folha mensal" value={brl(totals.payroll)} hint="custo fixo de pessoas ativas" />
        <Kpi icon={CalendarClock} label="Pagamentos em 7 dias" value={String(totals.next7.length)} hint={brl(totals.next7.reduce((s, r) => s + r.cost, 0))} />
        <Kpi icon={Gift} label="Bônus a pagar" value={brl(totals.pendingBonus)} hint={`${pendingBonuses.length} registro(s)`} />
        <Kpi icon={TrendingUp} label="Aumentos no ano" value={String(totals.raisesYear)} hint="aumentos e promoções" />
        <Kpi icon={PiggyBank} label="Provisão de 13º" value={brl(provision)} hint="1/12 da folha dos internos" />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <ArrowRightLeft className="size-4" />Fechamento da folha no Financeiro
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {monthLabel(ym)} · {lines.length} linha(s) · total {brl(totalMonth)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input type="month" value={ym} onChange={e => setYm(e.target.value || monthKey())} className="cw-input h-9 text-[13px]" />
            <Button size="sm" disabled={missing.length === 0 || post.isPending} onClick={() => post.mutate()}>
              {missing.length === 0 ? "Folha lançada" : `Lançar ${missing.length} no Financeiro`}
            </Button>
          </div>
        </div>
        <div className="space-y-1.5">
          {lines.map(l => {
            const done = postedByDesc.get(l.description);
            return (
              <div key={l.key} className="flex items-center gap-3 text-[13px]">
                <span className={`size-2 rounded-full ${l.kind === "bonus" ? "bg-amber-500" : "bg-blue-500"}`} />
                <span className="truncate flex-1">{l.description}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{fmtFull(l.dueDate)}</span>
                <span className="tabular-nums shrink-0 w-28 text-right">{brl2(l.amount)}</span>
                <span className="shrink-0 w-24 text-right text-[11px]">
                  {done
                    ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Check className="size-3" />lançado</span>
                    : <span className="text-muted-foreground">pendente</span>}
                </span>
              </div>
            );
          })}
          {lines.length === 0 && <p className="text-[13px] text-muted-foreground">Nenhum custo fixo ou bônus neste mês.</p>}
        </div>
      </Card>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Calendário de pagamentos</h3>
            <span className="text-[11px] text-muted-foreground">próxima data por pessoa</span>
          </div>
          <div className="space-y-1.5">
            {schedule.map(({ m, date, cost }) => {
              const d = daysUntil(date);
              const soon = d !== null && d <= 5;
              return (
                <Link
                  key={m.id} to="/team/$memberId" params={{ memberId: m.id }}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                >
                  <div className="size-8 rounded-full bg-muted flex items-center justify-center text-[11px] font-medium overflow-hidden">
                    {m.avatar_url ? <img src={m.avatar_url} alt={m.name} className="size-full object-cover" /> : initialsOf(m.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] truncate">{m.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{m.role || "—"}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-[13px] tabular-nums ${soon ? "text-amber-600 dark:text-amber-400 font-medium" : ""}`}>
                      {date ? date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "sem data"}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">{cost ? brl(cost) : "variável"}</div>
                  </div>
                </Link>
              );
            })}
            {schedule.length === 0 && <p className="text-[13px] text-muted-foreground">Nenhuma pessoa ativa.</p>}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Gift className="size-4" />Bônus pendentes</h3>
          <div className="space-y-2">
            {pendingBonuses.map(e => (
              <div key={e.id} className="flex items-center justify-between gap-2 text-[13px]">
                <span className="truncate">{memberById.get(e.member_id)?.name ?? "—"}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${COMP_STATUS_META[e.status].tone}`}>{COMP_STATUS_META[e.status].label}</span>
                  <span className="tabular-nums">{brl2(Number(e.amount ?? 0))}</span>
                </span>
              </div>
            ))}
            {pendingBonuses.length === 0 && <p className="text-[13px] text-muted-foreground">Nenhum bônus pendente.</p>}
          </div>

          <h3 className="text-sm font-semibold mt-5 mb-2 flex items-center gap-1.5"><AlertTriangle className="size-4" />Revisões vencidas</h3>
          <div className="space-y-1.5">
            {overdueReviews.map(m => (
              <Link key={m.id} to="/team/$memberId" params={{ memberId: m.id }} className="flex items-center justify-between text-[13px] hover:underline">
                <span className="truncate">{m.name}</span>
                <span className="text-[11px] text-amber-600 dark:text-amber-400">{monthsSinceReview(m)} meses</span>
              </Link>
            ))}
            {overdueReviews.length === 0 && <p className="text-[13px] text-muted-foreground">Tudo em dia.</p>}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Movimentações recentes</h3>
        <div className="space-y-1.5">
          {recent.map(e => {
            const meta = COMP_KIND_META[e.kind];
            return (
              <div key={e.id} className="flex items-center gap-3 text-[13px]">
                <span className={`size-2 rounded-full ${meta.dot}`} />
                <span className="truncate flex-1">
                  <span className="font-medium">{memberById.get(e.member_id)?.name ?? "—"}</span>
                  <span className="text-muted-foreground"> · {meta.label}</span>
                  {e.kind === "bonus"
                    ? <span className="text-muted-foreground"> · {brl2(Number(e.amount ?? 0))}</span>
                    : e.new_salary != null && <span className="text-muted-foreground"> · {brl2(Number(e.new_salary))}</span>}
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0">{fmtFull(e.effective_date)}</span>
              </div>
            );
          })}
          {recent.length === 0 && <p className="text-[13px] text-muted-foreground">Sem movimentações registradas.</p>}
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Wallet; label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" /><span className="text-[11px] uppercase tracking-wide font-medium">{label}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1.5">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  );
}
