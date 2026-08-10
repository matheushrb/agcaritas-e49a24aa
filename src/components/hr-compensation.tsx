import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowUpRight, Award, Gift, Plus, TrendingUp, CalendarClock, AlertTriangle, Trash2, Wallet,
} from "lucide-react";
import {
  COMP_COLUMNS, COMP_KIND_META, COMP_STATUS_META, LEVEL_LABEL,
  brl2, fmtFull, nextPaymentDate, daysUntil, monthsSinceReview, reviewOverdue,
  type CompEvent, type HrCompKind, type HrCompStatus, type HrMember,
} from "@/lib/hr";

const KIND_ICON: Record<HrCompKind, typeof TrendingUp> = {
  raise: TrendingUp,
  promotion: Award,
  bonus: Gift,
  adjustment: ArrowUpRight,
};

export function useCompensationEvents(memberId?: string) {
  return useQuery<CompEvent[]>({
    queryKey: ["hr-comp-events", memberId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("hr_compensation_events").select(COMP_COLUMNS).order("effective_date", { ascending: false });
      if (memberId) q = q.eq("member_id", memberId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CompEvent[];
    },
  });
}

export function HrCompensationTab({ member, onPatchMember }: {
  member: HrMember;
  onPatchMember: (patch: Partial<HrMember>) => void;
}) {
  const qc = useQueryClient();
  const { data: events = [] } = useCompensationEvents(member.id);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<HrCompKind>("raise");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["hr-comp-events"] });
    qc.invalidateQueries({ queryKey: ["team-member", member.id] });
    qc.invalidateQueries({ queryKey: ["team-members"] });
  };

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hr_compensation_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Registro removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: HrCompStatus }) => {
      const { error } = await supabase.from("hr_compensation_events").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Status atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    const year = new Date().getFullYear();
    const bonusYear = events
      .filter(e => e.kind === "bonus" && e.status !== "cancelled" && new Date(e.effective_date).getFullYear() === year)
      .reduce((s, e) => s + Number(e.amount ?? 0), 0);
    const bonusPending = events
      .filter(e => e.kind === "bonus" && (e.status === "planned" || e.status === "approved"))
      .reduce((s, e) => s + Number(e.amount ?? 0), 0);
    const raises = events.filter(e => (e.kind === "raise" || e.kind === "promotion") && e.status !== "cancelled");
    const last = raises[0] ?? null;
    const lastPct = last && last.previous_salary && last.new_salary
      ? ((Number(last.new_salary) - Number(last.previous_salary)) / Number(last.previous_salary)) * 100
      : null;
    return { bonusYear, bonusPending, last, lastPct, raises: raises.length };
  }, [events]);

  const next = nextPaymentDate(member.payment_day);
  const nextIn = daysUntil(next);
  const months = monthsSinceReview(member);
  const overdue = reviewOverdue(member);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><Wallet className="size-4" /><span className="text-[11px] uppercase tracking-wide font-medium">Salário atual</span></div>
          <div className="text-2xl font-semibold tabular-nums mt-1.5">{member.monthly_salary ? brl2(Number(member.monthly_salary)) : "—"}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{member.role || "sem cargo"}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><CalendarClock className="size-4" /><span className="text-[11px] uppercase tracking-wide font-medium">Próximo pagamento</span></div>
          <div className="text-2xl font-semibold tabular-nums mt-1.5">
            {next ? next.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {next ? (nextIn === 0 ? "é hoje" : `em ${nextIn} dia(s)`) : "defina o dia de pagamento"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground"><Gift className="size-4" /><span className="text-[11px] uppercase tracking-wide font-medium">Bônus no ano</span></div>
          <div className="text-2xl font-semibold tabular-nums mt-1.5">{brl2(stats.bonusYear)}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {stats.bonusPending ? `${brl2(stats.bonusPending)} a pagar` : "nada pendente"}
          </div>
        </Card>
        <Card className={`p-4 ${overdue ? "border-amber-500/50" : ""}`}>
          <div className="flex items-center gap-2 text-muted-foreground"><TrendingUp className="size-4" /><span className="text-[11px] uppercase tracking-wide font-medium">Revisão salarial</span></div>
          <div className="text-2xl font-semibold tabular-nums mt-1.5">{months !== null ? `${months} m` : "—"}</div>
          <div className={`text-[11px] mt-0.5 ${overdue ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>
            {overdue
              ? "revisão vencida"
              : member.salary_review_months
                ? `a cada ${member.salary_review_months} meses`
                : "sem periodicidade definida"}
          </div>
        </Card>
      </div>

      {overdue && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-700 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0" />
          Faz {months} meses desde a última revisão de {member.name}. Vale registrar um aumento ou reagendar a revisão.
        </div>
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold">Histórico de remuneração</h3>
            <p className="text-[11px] text-muted-foreground">Aumentos, promoções, bônus e ajustes registrados.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => { setKind("bonus"); setOpen(true); }}>
              <Gift className="size-4 mr-1.5" />Bônus
            </Button>
            <Button className="rounded-full" onClick={() => { setKind("raise"); setOpen(true); }}>
              <Plus className="size-4 mr-1.5" />Novo evento
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {events.map(e => {
            const meta = COMP_KIND_META[e.kind];
            const Icon = KIND_ICON[e.kind];
            const pct = e.previous_salary && e.new_salary
              ? ((Number(e.new_salary) - Number(e.previous_salary)) / Number(e.previous_salary)) * 100
              : null;
            return (
              <div key={e.id} className="flex items-start gap-3 rounded-xl border border-border px-3 py-2.5">
                <span className={`size-8 rounded-full flex items-center justify-center border ${meta.tone}`}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-medium">{meta.label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${COMP_STATUS_META[e.status].tone}`}>{COMP_STATUS_META[e.status].label}</span>
                    <span className="text-[11px] text-muted-foreground">{fmtFull(e.effective_date)}</span>
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-0.5">
                    {e.kind === "bonus"
                      ? <span className="text-foreground tabular-nums font-medium">{brl2(Number(e.amount ?? 0))}</span>
                      : (
                        <>
                          {e.previous_salary != null && <span className="line-through">{brl2(Number(e.previous_salary))}</span>}
                          {e.new_salary != null && <span className="text-foreground font-medium tabular-nums"> → {brl2(Number(e.new_salary))}</span>}
                          {pct !== null && <span className={pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}> ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)</span>}
                        </>
                      )}
                    {e.new_role && <span> · cargo: {e.previous_role ? `${e.previous_role} → ` : ""}{e.new_role}</span>}
                    {e.new_level && <span> · nível: {LEVEL_LABEL[e.new_level] ?? e.new_level}</span>}
                  </div>
                  {(e.reason || e.notes) && (
                    <p className="text-[12px] mt-1 whitespace-pre-wrap">{e.reason}{e.notes ? ` — ${e.notes}` : ""}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {e.status !== "paid" && e.status !== "cancelled" && (
                    <Button size="sm" variant="ghost" className="h-7 text-[11px] rounded-full"
                      onClick={() => setStatus.mutate({ id: e.id, status: "paid" })}>
                      Marcar pago
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-red-500"
                    onClick={() => remove.mutate(e.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
          {events.length === 0 && (
            <p className="text-[13px] text-muted-foreground">Nenhum evento registrado ainda.</p>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Dados de pagamento</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[13px]">
          <Info label="Dia de pagamento" value={member.payment_day ? `todo dia ${member.payment_day}` : null} />
          <Info label="Chave PIX" value={member.pix_key} />
          <Info label="Dados bancários" value={member.bank_info} />
          <Info label="Última revisão" value={member.last_review_on ? fmtFull(member.last_review_on) : null} />
        </div>
      </Card>

      <CompEventDialog
        open={open}
        onOpenChange={setOpen}
        member={member}
        initialKind={kind}
        onPatchMember={onPatchMember}
        onSaved={invalidate}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-[13px] mt-0.5 break-words">{value || "—"}</div>
    </div>
  );
}

export function CompEventDialog({ open, onOpenChange, member, initialKind = "raise", onPatchMember, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  member: HrMember;
  initialKind?: HrCompKind;
  onPatchMember: (patch: Partial<HrMember>) => void;
  onSaved?: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [kind, setKind] = useState<HrCompKind>(initialKind);
  const [status, setStatus] = useState<HrCompStatus>("approved");
  const [date, setDate] = useState(today);
  const [newSalary, setNewSalary] = useState<string>(member.monthly_salary ? String(member.monthly_salary) : "");
  const [amount, setAmount] = useState<string>("");
  const [newRole, setNewRole] = useState<string>("");
  const [reason, setReason] = useState("");
  const [applyToProfile, setApplyToProfile] = useState(true);

  const reset = () => {
    setKind(initialKind); setStatus("approved"); setDate(today);
    setNewSalary(member.monthly_salary ? String(member.monthly_salary) : "");
    setAmount(""); setNewRole(""); setReason(""); setApplyToProfile(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const isBonus = kind === "bonus";
      const payload: Record<string, unknown> = {
        organization_id: profile.organization_id,
        member_id: member.id,
        kind,
        status,
        effective_date: date,
        reason: reason || null,
        previous_salary: isBonus ? null : (member.monthly_salary ?? null),
        new_salary: isBonus ? null : (newSalary ? Number(newSalary) : null),
        amount: isBonus ? (amount ? Number(amount) : 0) : null,
        previous_role: isBonus ? null : (member.role ?? null),
        new_role: isBonus ? null : (newRole || null),
      };
      const { error } = await supabase.from("hr_compensation_events").insert(payload as never);
      if (error) throw error;

      if (!isBonus && applyToProfile) {
        const patch: Partial<HrMember> = { last_review_on: date };
        if (newSalary) patch.monthly_salary = Number(newSalary);
        if (newRole) patch.role = newRole;
        onPatchMember(patch);
      }
    },
    onSuccess: () => {
      toast.success("Registro salvo");
      onSaved?.();
      onOpenChange(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pct = kind !== "bonus" && member.monthly_salary && newSalary
    ? ((Number(newSalary) - Number(member.monthly_salary)) / Number(member.monthly_salary)) * 100
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Evento de remuneração · {member.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(COMP_KIND_META) as HrCompKind[]).map(k => {
              const meta = COMP_KIND_META[k];
              const Icon = KIND_ICON[k];
              const on = kind === k;
              return (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={`rounded-xl border px-2 py-2 text-[12px] flex flex-col items-center gap-1 transition ${on ? meta.tone : "border-border hover:bg-muted/50"}`}>
                  <Icon className="size-4" />{meta.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Vigência">
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Labeled>
            <Labeled label="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as HrCompStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(COMP_STATUS_META) as HrCompStatus[]).map(k => (
                    <SelectItem key={k} value={k}>{COMP_STATUS_META[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Labeled>
          </div>

          {kind === "bonus" ? (
            <Labeled label="Valor do bônus (R$)">
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Ex.: 1500" autoFocus />
            </Labeled>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Labeled label="Salário atual">
                  <Input value={member.monthly_salary ? brl2(Number(member.monthly_salary)) : "—"} disabled />
                </Labeled>
                <Labeled label="Novo salário (R$)">
                  <Input type="number" step="0.01" value={newSalary} onChange={e => setNewSalary(e.target.value)} autoFocus />
                </Labeled>
              </div>
              {pct !== null && Number.isFinite(pct) && (
                <div className="text-[12px] text-muted-foreground">
                  Variação: <span className={pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>{pct >= 0 ? "+" : ""}{pct.toFixed(1)}%</span>
                </div>
              )}
              <Labeled label={kind === "promotion" ? "Novo cargo" : "Novo cargo (opcional)"}>
                <Input value={newRole} onChange={e => setNewRole(e.target.value)} placeholder={member.role ?? "Ex.: Designer Sênior"} />
              </Labeled>
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={applyToProfile} onChange={e => setApplyToProfile(e.target.checked)} />
                Atualizar o perfil da pessoa com esses valores
              </label>
            </>
          )}

          <Labeled label="Motivo / observações">
            <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Ex.: performance acima da meta no trimestre" />
          </Labeled>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="rounded-full" onClick={() => save.mutate()} disabled={save.isPending || (kind === "bonus" ? !amount : !newSalary && !newRole)}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
