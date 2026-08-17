import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Pencil, Mail, Phone, MapPin, CalendarDays, Building2, Clock, Wallet, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { HrMemberDialog } from "@/components/hr-member-dialog";
import { HrCompensationTab } from "@/components/hr-compensation";
import {
  MEMBER_COLUMNS, CONTRACT_TYPES, STATUS_META, LEVEL_LABEL, initialsOf, costSummary,
  hourCost, monthlyCost, brl, brl2, fmtFull, fmtDay, type HrMember,
} from "@/lib/hr";

export const Route = createFileRoute("/_authenticated/team/$memberId")({
  component: MemberProfile,
});

const WRITABLE_KEYS = [
  "name","email","phone","role","specialty","level","status","hourly_rate","avatar_url",
  "cost_mode","monthly_salary","monthly_hours","default_task_rate","task_rate_overrides","cost_notes",
  "contract_type","area","admitted_on","birth_date","work_location","hr_notes",
  "company_legal_name","company_tax_id","company_contact","payment_day","pix_key","bank_info","salary_review_months","last_review_on",
] as const;

type ProfileTab = "professional" | "cost" | "compensation" | "activity";

function MemberProfile() {
  const { memberId } = useParams({ from: "/_authenticated/team/$memberId" });
  const qc = useQueryClient();
  const [tab, setTab] = useState<ProfileTab>("professional");
  const [editing, setEditing] = useState(false);

  const { data: member } = useQuery<HrMember | null>({
    queryKey: ["team-member", memberId],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select(MEMBER_COLUMNS).eq("id", memberId).maybeSingle();
      if (error) throw error;
      return data ? ({ ...(data as any), task_rate_overrides: (data as any).task_rate_overrides ?? {} } as HrMember) : null;
    },
  });

  const userId = member?.user_id ?? null;

  const { data: tasks = [] } = useQuery({
    queryKey: ["hr-member-tasks", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,status,due_date,project_id,projects(name)")
        .eq("assignee_id", userId!)
        .is("archived_at", null)
        .order("due_date", { nullsFirst: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: timeRows = [] } = useQuery({
    queryKey: ["hr-member-time", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("id,duration_seconds,created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: blocks = [] } = useQuery({
    queryKey: ["hr-member-blocks", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_blocks")
        .select("id,kind,start_date,end_date,reason")
        .eq("user_id", userId!)
        .order("start_date", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const save = useMutation({
    mutationFn: async (input: Partial<HrMember>) => {
      const payload: Record<string, any> = {};
      for (const k of WRITABLE_KEYS) if (k in input) payload[k] = (input as any)[k];
      const { error } = await supabase.from("team_members").update(payload as any).eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-member", memberId] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Perfil atualizado");
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const monthHours = useMemo(() => {
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    return timeRows
      .filter(r => new Date(r.created_at) >= start)
      .reduce((s, r) => s + Number(r.duration_seconds ?? 0) / 3600, 0);
  }, [timeRows]);

  if (!member) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando perfil…</div>;
  }

  const meta = CONTRACT_TYPES[member.contract_type as keyof typeof CONTRACT_TYPES];
  const capacity = Number(member.monthly_hours ?? 0);
  const pct = capacity ? Math.min(100, Math.round((monthHours / capacity) * 100)) : 0;
  const ch = hourCost(member);
  const openTasks = tasks.filter(t => t.status !== "done");

  return (
    <div className="space-y-5">
      <Link to="/team" search={{ tab: "people" }} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />Voltar para pessoas
      </Link>

      {/* RH03-01 · header */}
      <Card className="p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="size-16 rounded-full bg-muted flex items-center justify-center text-xl font-semibold overflow-hidden">
            {member.avatar_url
              ? <img src={member.avatar_url} alt={member.name} className="size-full object-cover" />
              : initialsOf(member.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold truncate">{member.name}</h1>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${meta.tone}`}>
                <span className={`size-1.5 rounded-full ${meta.dot}`} />{meta.label}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_META[member.status ?? "active"]?.tone}`}>
                {STATUS_META[member.status ?? "active"]?.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {member.role || "—"}{member.level ? ` · ${LEVEL_LABEL[member.level]}` : ""}{member.area ? ` · ${member.area}` : ""}
            </p>
            <div className="flex items-center gap-4 mt-2 text-[12px] text-muted-foreground flex-wrap">
              {member.email && <span className="flex items-center gap-1.5"><Mail className="size-3.5" />{member.email}</span>}
              {member.phone && <span className="flex items-center gap-1.5"><Phone className="size-3.5" />{member.phone}</span>}
              {member.work_location && <span className="flex items-center gap-1.5 capitalize"><MapPin className="size-3.5" />{member.work_location}</span>}
              {member.admitted_on && <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />desde {fmtFull(member.admitted_on)}</span>}
            </div>
          </div>
          <Button variant="outline" className="rounded-full" onClick={() => setEditing(true)}>
            <Pencil className="size-4 mr-1.5" />Editar
          </Button>
        </div>
      </Card>

      {/* RH03-02 · abas */}
      <div className="flex items-center gap-1 rounded-full border border-border p-0.5 w-fit">
        {([["professional", "Profissional"], ["cost", "Custo e capacidade"], ["compensation", "Remuneração"], ["activity", "Projetos e atividade"]] as const).map(([k, label]) => (
          <button
            key={k} onClick={() => setTab(k)}
            className={`px-3.5 py-1.5 rounded-full text-[13px] transition ${tab === k ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}
          >{label}</button>
        ))}
      </div>

      {tab === "professional" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-4 lg:col-span-2 space-y-3">
            <h3 className="text-sm font-semibold">Informações profissionais</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Cargo" value={member.role} />
              <Field label="Área" value={member.area} />
              <Field label="Nível" value={member.level ? LEVEL_LABEL[member.level] : null} />
              <Field label="Especialidade" value={member.specialty} />
              <Field label="Local" value={member.work_location} />
              <Field label="Admissão" value={member.admitted_on ? fmtFull(member.admitted_on) : null} />
              <Field label="Nascimento" value={member.birth_date ? fmtFull(member.birth_date) : null} />
              <Field label="Acesso ao sistema" value={member.user_id ? "Vinculado a um login" : "Sem login"} />
              <Field label="Jornada" value={capacity ? `${capacity} h/mês` : null} />
            </div>
            {member.hr_notes && (
              <div className="pt-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Observações do RH</div>
                <p className="text-[13px] whitespace-pre-wrap">{member.hr_notes}</p>
              </div>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5"><Building2 className="size-4" />
              {member.contract_type === "company" ? "Dados da empresa" : "Vínculo"}
            </h3>
            <p className={`rounded-xl border px-3 py-2 text-[12px] ${meta.tone}`}>{meta.note}</p>
            {member.contract_type === "company" && (
              <div className="space-y-3">
                <Field label="Razão social" value={member.company_legal_name} />
                <Field label="CNPJ" value={member.company_tax_id} />
                <Field label="Contato" value={member.company_contact} />
              </div>
            )}
            <div>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Ausências recentes</div>
              <div className="space-y-1.5">
                {blocks.map(b => (
                  <div key={b.id} className="flex items-center justify-between text-[12px]">
                    <span className="capitalize">{b.kind}</span>
                    <span className="text-muted-foreground">{fmtDay(b.start_date)} – {fmtDay(b.end_date)}</span>
                  </div>
                ))}
                {blocks.length === 0 && <p className="text-[12px] text-muted-foreground">Nenhuma ausência registrada.</p>}
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === "cost" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground"><Wallet className="size-4" /><span className="text-[11px] uppercase tracking-wide font-medium">Custo</span></div>
            <div className="text-2xl font-semibold tabular-nums mt-1.5">{costSummary(member)}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{meta.label}</div>
            {monthlyCost(member) > 0 && (
              <div className="text-[12px] text-muted-foreground mt-2">Custo mensal estimado: <span className="text-foreground">{brl(monthlyCost(member))}</span></div>
            )}
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground"><Clock className="size-4" /><span className="text-[11px] uppercase tracking-wide font-medium">Custo/hora</span></div>
            <div className="text-2xl font-semibold tabular-nums mt-1.5">{ch ? brl2(ch) : "—"}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">base para custo de projetos</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground"><Clock className="size-4" /><span className="text-[11px] uppercase tracking-wide font-medium">Capacidade do mês</span></div>
            <div className="text-2xl font-semibold tabular-nums mt-1.5">{Math.round(monthHours)}h / {capacity || 0}h</div>
            <Progress value={pct} className="h-2 mt-2" />
          </Card>

          {Object.keys(member.task_rate_overrides ?? {}).length > 0 && (
            <Card className="p-4 lg:col-span-3">
              <h3 className="text-sm font-semibold mb-2">Valores por tipo de tarefa</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(member.task_rate_overrides).map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border px-3 py-2 text-[13px] flex items-center justify-between">
                    <span className="truncate">{k}</span><span className="tabular-nums">{brl2(Number(v))}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {member.cost_notes && (
            <Card className="p-4 lg:col-span-3">
              <h3 className="text-sm font-semibold mb-1">Notas de custo</h3>
              <p className="text-[13px] whitespace-pre-wrap text-muted-foreground">{member.cost_notes}</p>
            </Card>
          )}
        </div>
      )}

      {tab === "compensation" && (
        <HrCompensationTab member={member} onPatchMember={(patch) => save.mutate(patch)} />
      )}

      {tab === "activity" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5"><Briefcase className="size-4" />Tarefas atribuídas</h3>
              <span className="text-[11px] text-muted-foreground">{openTasks.length} em aberto</span>
            </div>
            <div className="space-y-1.5">
              {tasks.map(t => (
                <div key={t.id} className="flex items-center justify-between gap-3 text-[13px] rounded-lg px-2 py-1.5 hover:bg-muted/50">
                  <span className="truncate">{t.title}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {t.projects?.name ?? "sem projeto"} · {t.due_date ? fmtDay(t.due_date) : "sem prazo"}
                  </span>
                </div>
              ))}
              {tasks.length === 0 && <p className="text-[13px] text-muted-foreground">Nenhuma tarefa atribuída{member.user_id ? "" : " (sem login vinculado)"}.</p>}
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Horas lançadas</h3>
            <div className="text-2xl font-semibold tabular-nums">{Math.round(monthHours)} h</div>
            <div className="text-[11px] text-muted-foreground">no mês atual</div>
            <div className="text-[13px] text-muted-foreground mt-3">
              Total registrado: {Math.round(timeRows.reduce((s, r) => s + Number(r.duration_seconds ?? 0) / 3600, 0))} h
            </div>
          </Card>
        </div>
      )}

      {editing && (
        <HrMemberDialog
          open={editing}
          onOpenChange={(v) => { if (!v) setEditing(false); }}
          initial={member}
          onSave={(v) => save.mutate(v)}
        />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-[13px] mt-0.5 capitalize-first">{value || "—"}</div>
    </div>
  );
}
