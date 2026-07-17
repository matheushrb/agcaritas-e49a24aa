import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityDialog, DialogField, DialogCancelButton } from "@/components/entity-dialog";
import { Users, UserPlus, Plus, Search, Mail, Phone, Pencil } from "lucide-react";
import { toast } from "sonner";
import { TeamCostFieldsEditor, type TeamCostFields, type CostMode, COST_MODE_LABEL } from "@/components/team-cost-fields";

export const Route = createFileRoute("/_authenticated/team")({
  component: TeamPage,
});

type Level = "junior" | "mid" | "senior" | "lead";
type Status = "active" | "inactive" | "away" | "vacation";
type Member = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  specialty: string | null;
  level: Level | null;
  status: Status | null;
  hourly_rate: number | null;
  avatar_url: string | null;
  cost_mode: CostMode;
  monthly_salary: number | null;
  monthly_hours: number | null;
  default_task_rate: number | null;
  task_rate_overrides: Record<string, number>;
  cost_notes: string | null;
};

const LEVEL_LABEL: Record<string, string> = { junior: "Júnior", mid: "Pleno", senior: "Sênior", lead: "Lead" };
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:   { label: "Ativo",    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  inactive: { label: "Inativo",  color: "bg-muted text-muted-foreground" },
  away:     { label: "Ausente",  color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  vacation: { label: "Férias",   color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
};

const COST_MODE_TONE: Record<CostMode, string> = {
  internal_fixed: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  freelancer_per_task: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  freelancer_per_hour: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  one_off: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

const emptyCost: TeamCostFields = {
  cost_mode: "internal_fixed",
  monthly_salary: null,
  monthly_hours: 160,
  hourly_rate: null,
  default_task_rate: null,
  task_rate_overrides: {},
  cost_notes: null,
};

function TeamPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id,name,email,phone,role,specialty,level,status,hourly_rate,avatar_url,cost_mode,monthly_salary,monthly_hours,default_task_rate,task_rate_overrides,cost_notes")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((m: any) => ({ ...m, task_rate_overrides: m.task_rate_overrides ?? {} })) as Member[];
    },
  });

  const filtered = useMemo(() =>
    members.filter(m => !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.role?.toLowerCase().includes(search.toLowerCase())),
  [members, search]);

  const kpis = useMemo(() => ({
    total: members.length,
    active: members.filter(m => m.status === "active").length,
    away: members.filter(m => m.status === "away" || m.status === "vacation").length,
  }), [members]);

  const upsert = useMutation({
    mutationFn: async (input: Partial<Member> & { id?: string }) => {
      if (input.id) {
        const { id, ...rest } = input;
        const { error } = await supabase.from("team_members").update(rest as any).eq("id", id);
        if (error) throw error;
      } else {
        const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
        if (!profile?.organization_id) throw new Error("Sem organização");
        const { error } = await supabase.from("team_members").insert({
          organization_id: profile.organization_id,
          ...input,
          name: input.name!,
          status: input.status ?? "active",
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Salvo");
      setNewOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Users className="size-6" />Equipe</h1>
          <p className="text-sm text-muted-foreground">Time, especialidades e modelo de custo por colaborador.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="size-4 mr-1" />Novo membro</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-xl font-semibold">{kpis.total}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Ativos</div><div className="text-xl font-semibold">{kpis.active}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Ausentes/Férias</div><div className="text-xl font-semibold">{kpis.away}</div></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou cargo…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(m => (
          <Card key={m.id} className="p-4 group relative">
            <button
              onClick={() => setEditing(m)}
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition p-1.5 rounded-md hover:bg-muted"
              title="Editar"
            >
              <Pencil className="size-3.5" />
            </button>
            <div className="flex items-start gap-3">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center font-medium">
                {m.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium truncate">{m.name}</h3>
                  {m.status && <Badge className={STATUS_LABEL[m.status]?.color}>{STATUS_LABEL[m.status]?.label}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {m.role ?? "—"}{m.level ? ` · ${LEVEL_LABEL[m.level]}` : ""}
                </p>
                {m.specialty && <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.specialty}</p>}
              </div>
            </div>
            <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              {m.email && <div className="flex items-center gap-1.5"><Mail className="size-3" />{m.email}</div>}
              {m.phone && <div className="flex items-center gap-1.5"><Phone className="size-3" />{m.phone}</div>}
              <div className="flex items-center gap-2 pt-1">
                <Badge className={COST_MODE_TONE[m.cost_mode]} variant="secondary">{COST_MODE_LABEL[m.cost_mode]}</Badge>
                <span className="text-[11px]">{costSummary(m)}</span>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full">Nenhum membro.</p>}
      </div>

      {(newOpen || editing) && (
        <MemberDialog
          open={newOpen || !!editing}
          onOpenChange={(v) => { if (!v) { setNewOpen(false); setEditing(null); } }}
          initial={editing}
          onSave={(v) => upsert.mutate(editing ? { ...v, id: editing.id } : v)}
        />
      )}
    </div>
  );
}

function costSummary(m: Member): string {
  switch (m.cost_mode) {
    case "internal_fixed":
      return m.monthly_salary ? `R$ ${Number(m.monthly_salary).toFixed(0)}/mês` : "sem salário";
    case "freelancer_per_hour":
      return m.hourly_rate ? `R$ ${Number(m.hourly_rate).toFixed(2)}/h` : "sem valor/h";
    case "freelancer_per_task":
      return m.default_task_rate ? `R$ ${Number(m.default_task_rate).toFixed(2)}/tarefa` : "sem valor/task";
    case "one_off":
      return "manual";
  }
}

function MemberDialog({ open, onOpenChange, initial, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Member | null;
  onSave: (v: Partial<Member>) => void;
}) {
  const [f, setF] = useState<Partial<Member>>(() => initial ?? { status: "active", level: "mid", ...emptyCost });
  const initials = (f.name ?? "").split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase() || "?";
  const isEdit = !!initial;

  const cost: TeamCostFields = {
    cost_mode: (f.cost_mode ?? "internal_fixed") as CostMode,
    monthly_salary: f.monthly_salary ?? null,
    monthly_hours: f.monthly_hours ?? 160,
    hourly_rate: f.hourly_rate ?? null,
    default_task_rate: f.default_task_rate ?? null,
    task_rate_overrides: f.task_rate_overrides ?? {},
    cost_notes: f.cost_notes ?? null,
  };

  return (
    <EntityDialog
      open={open} onOpenChange={onOpenChange}
      icon={UserPlus} tone="purple"
      eyebrow="RH"
      title={isEdit ? "Editar membro" : "Novo membro da equipe"}
      subtitle="Dados, especialidade e modelo de custo do colaborador."
      main={
        <>
          <DialogField label="Nome completo">
            <Input placeholder="Ex.: Ana Beatriz Souza" value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} autoFocus />
          </DialogField>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="E-mail">
              <Input type="email" placeholder="ana@empresa.com" value={f.email ?? ""} onChange={e => setF({ ...f, email: e.target.value })} />
            </DialogField>
            <DialogField label="Telefone">
              <Input placeholder="(11) 99999-0000" value={f.phone ?? ""} onChange={e => setF({ ...f, phone: e.target.value })} />
            </DialogField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="Cargo">
              <Input placeholder="Ex.: Designer" value={f.role ?? ""} onChange={e => setF({ ...f, role: e.target.value })} />
            </DialogField>
            <DialogField label="Especialidade">
              <Input placeholder="Ex.: Motion, UI, tráfego pago" value={f.specialty ?? ""} onChange={e => setF({ ...f, specialty: e.target.value })} />
            </DialogField>
          </div>

          <div className="pt-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Modelo de custo</div>
            <TeamCostFieldsEditor value={cost} onChange={(v) => setF({ ...f, ...v })} />
          </div>
        </>
      }
      sidebar={
        <>
          <div className="flex items-center gap-3">
            <div className="size-14 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-semibold text-lg">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{f.name || "Novo membro"}</div>
              <div className="text-xs text-muted-foreground truncate">{f.role || "—"}</div>
            </div>
          </div>
          <DialogField label="Nível">
            <Select value={f.level ?? undefined} onValueChange={(v) => setF({ ...f, level: v as Level })}>
              <SelectTrigger><SelectValue placeholder="Nível" /></SelectTrigger>
              <SelectContent>{Object.entries(LEVEL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </DialogField>
          <DialogField label="Status">
            <Select value={f.status ?? undefined} onValueChange={(v) => setF({ ...f, status: v as Status })}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </DialogField>
        </>
      }
      footer={
        <>
          <DialogCancelButton onClick={() => onOpenChange(false)} />
          <Button className="rounded-full" onClick={() => onSave(f)} disabled={!f.name}>
            {isEdit ? "Salvar" : "Adicionar membro"}
          </Button>
        </>
      }
    />
  );
}
