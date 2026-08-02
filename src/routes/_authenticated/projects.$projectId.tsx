import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Calendar, CheckSquare, FileText, Grid3x3, Timer as TimerIcon,
  Megaphone, Compass, Rocket, DollarSign, Plus, Flag, Zap,
  Building2, CheckCircle2, RotateCcw, Pencil, AlertTriangle, Users as UsersIcon, Wallet, Receipt,
} from "lucide-react";

import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TaskModal } from "./tasks";
import { EditProjectDialog, type EditableProject } from "@/components/edit-project-dialog";
import { ProjectCostsTab } from "@/components/project-costs-tab";
import { Prj02Overview, p2Initials } from "@/components/prj02-overview";
import { Prj03Tasks } from "@/components/prj03-tasks";
import { Prj04Finance } from "@/components/prj04-finance";
import { Share2, MoreHorizontal, Mail as MailIcon, Target, TrendingUp } from "lucide-react";
import "@/prj02.css";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectDetail,
  notFoundComponent: () => (
    <Card className="rounded-3xl p-12 text-center">
      <div className="font-medium">Projeto não encontrado</div>
      <Link to="/projects" className="text-sm text-primary underline mt-2 inline-block">Voltar para lista</Link>
    </Card>
  ),
  errorComponent: ({ error }) => (
    <Card className="rounded-3xl p-8 text-center">
      <div className="font-medium">Erro ao carregar projeto</div>
      <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
    </Card>
  ),
});

type ProjectStatus = "planning" | "active" | "review" | "done" | "paused";
type Project = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  client_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  project_type: string | null;
  billing_model: string | null;
  urgency: string | null;
  fixed_value: number | null;
  monthly_value: number | null;
  hourly_rate: number | null;
  printing_budget: number | null;
  notes: string | null;
  has_content_calendar?: boolean;
  has_content_grid?: boolean;
  has_timeline?: boolean;
  traffic_budget?: { enabled?: boolean; amount?: number | null; platforms?: string[] } | null;
  scope_flags?: Record<string, unknown> | null;
};
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high";
  due_date: string | null;
  billing_value: number | null;
  billing_model: "hourly" | "one_time" | "package" | "monthly" | "per_task" | null;
  billing_enabled: boolean;
  project_id: string | null;
  client_id: string | null;
  assignee_id: string | null;
  platform: string | null;
  delivery_type: string | null;
  estimated_hours: number | null;
  progress: number;
  stage: "briefing" | "creation" | "review" | "approval" | "delivery";
  task_type_id: string | null;
  current_stage_id: string | null;
  deliverables: { id: string; platform: string; type: string; billing_enabled: boolean; billing_model: "hourly" | "one_time" | "package" | "monthly" | "per_task" | null; billing_value: number | null; invoiced?: boolean }[];
  subtasks: { id: string; title: string; done: boolean }[];
  broadcast_kind: "premiere" | "live" | "recorded" | null;
  recorded_at: string | null;
  aired_at: string | null;
  recorded_dates: string[];
  aired_dates: string[];
  created_at?: string;
};
type Charge = {
  id: string;
  description: string;
  amount: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  project_id: string | null;
};
type Client = { id: string; name: string; trade_name: string | null };

const STATUS_META: Record<ProjectStatus, { label: string; color: string }> = {
  planning: { label: "Planejamento", color: "bg-muted text-muted-foreground" },
  active:   { label: "Ativo",         color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  review:   { label: "Revisão",       color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  done:     { label: "Concluído",     color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  paused:   { label: "Pausado",       color: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

const TASK_STATUS: Record<Task["status"], { label: string; color: string }> = {
  todo:        { label: "A fazer",      color: "bg-muted text-foreground" },
  in_progress: { label: "Em andamento", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  review:      { label: "Revisão",      color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  done:        { label: "Concluída",    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
};

const PRIORITY_COLOR: Record<Task["priority"], string> = {
  low: "text-muted-foreground",
  medium: "text-amber-600 dark:text-amber-400",
  high: "text-red-600 dark:text-red-400",
};

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();

  const { data: project } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,organization_id,name,description,status,client_id,start_date,end_date,created_at,project_type,billing_model,urgency,fixed_value,monthly_value,hourly_rate,printing_budget,notes,has_content_calendar,has_content_grid,has_timeline,traffic_budget,scope_flags")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data as Project;
    },
  });

  const { data: client } = useQuery<Client | null>({
    queryKey: ["project-client", project?.client_id],
    enabled: !!project?.client_id,
    queryFn: async () => {
      if (!project?.client_id) return null;
      const { data } = await supabase.from("clients").select("id,name,trade_name").eq("id", project.client_id).maybeSingle();
      return (data as Client) ?? null;
    },
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["project-tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,description,status,priority,due_date,billing_value,billing_model,billing_enabled,project_id,client_id,assignee_id,platform,delivery_type,estimated_hours,progress,stage,task_type_id,current_stage_id,deliverables,subtasks,broadcast_kind,recorded_at,aired_at,recorded_dates,aired_dates,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map(t => ({
        ...t,
        recorded_dates: Array.isArray(t.recorded_dates) ? t.recorded_dates : [],
        aired_dates: Array.isArray(t.aired_dates) ? t.aired_dates : [],
      })) as Task[];
    },
  });

  const { data: charges = [] } = useQuery<Charge[]>({
    queryKey: ["project-charges", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("charges")
        .select("id,description,amount,status,due_date,paid_at,project_id")
        .eq("project_id", projectId);
      if (error) return [];
      return (data ?? []) as Charge[];
    },
  });

  const { data: costs = [] } = useQuery<{ id: string; amount: number; status: string; kind: string; description: string | null; occurred_on: string }[]>({
    queryKey: ["project-costs-finance", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_costs")
        .select("id,amount,status,kind,description,occurred_on")
        .eq("project_id", projectId);
      if (error) return [];
      return (data ?? []) as any[];
    },
  });

  // Base tasks from the project's project_type
  const { data: projectTypeRow } = useQuery({
    queryKey: ["project-type-row", project?.project_type],
    enabled: !!project?.project_type,
    queryFn: async () => {
      const key = project!.project_type!;
      const { data } = await (supabase as any)
        .from("project_types")
        .select("id,slug,name,base_tasks")
        .or(`slug.eq.${key},id.eq.${key}`)
        .maybeSingle();
      return data as { id: string; slug: string | null; name: string; base_tasks: { task_type_id: string }[] } | null;
    },
  });
  const baseTaskTypeIds = (projectTypeRow?.base_tasks ?? []).map(b => b.task_type_id).filter(Boolean);
  const { data: baseTaskTypes = [] } = useQuery({
    queryKey: ["project-base-task-types", baseTaskTypeIds.join(",")],
    enabled: baseTaskTypeIds.length > 0,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("task_types")
        .select("id,name,color,icon,default_price,default_billing_model")
        .in("id", baseTaskTypeIds);
      return (data ?? []) as { id: string; name: string; color: string | null; icon: string | null; default_price: number | null; default_billing_model: string | null }[];
    },
  });

  const stats = useMemo(() => {
    const total = tasks.length;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== "done").length;
    const done = tasks.filter(t => t.status === "done").length;
    const invoiced = charges.reduce((s, c) => s + Number(c.amount ?? 0), 0);
    const team = new Set(tasks.map(t => t.assignee_id).filter(Boolean) as string[]).size;
    let daysDelta: number | null = null;
    if (project?.end_date) {
      const end = new Date(project.end_date); end.setHours(0, 0, 0, 0);
      daysDelta = Math.round((end.getTime() - now.getTime()) / 86_400_000);
    }
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, overdue, done, invoiced, team, daysDelta, progress };
  }, [tasks, charges, project?.end_date]);

  const isOverdueActive = !!project && (project.status === "active" || project.status === "planning" || project.status === "review")
    && !!project.end_date && new Date(project.end_date) < new Date();
  const isClosed = project?.status === "done" || project?.status === "paused";

  const setStatus = useMutation({
    mutationFn: async (s: ProjectStatus) => {
      const { error } = await supabase.from("projects").update({ status: s }).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Status atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null;
  const [editOpen, setEditOpen] = useState(false);

  const addTask = useMutation({
    mutationFn: async (input: string | { title: string; task_type_id?: string | null; billing_model?: string | null; billing_value?: number | null }) => {
      const payload = typeof input === "string" ? { title: input } : input;
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const insert: any = {
        title: payload.title,
        status: "todo",
        priority: "medium",
        project_id: projectId,
        client_id: project?.client_id ?? null,
        organization_id: profile.organization_id,
      };
      if (payload.task_type_id) insert.task_type_id = payload.task_type_id;
      if (payload.billing_model) insert.billing_model = payload.billing_model;
      if (payload.billing_value != null) insert.billing_value = payload.billing_value;
      const { data, error } = await supabase.from("tasks").insert(insert).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id: string) => {
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setSelectedTaskId(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveField = useMutation({
    mutationFn: async (patch: Partial<Project>) => {
      const { error } = await supabase.from("projects").update(patch as never).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const assigneeIds = Array.from(new Set(tasks.map(t => t.assignee_id).filter(Boolean))) as string[];
  const { data: people = [] } = useQuery({
    queryKey: ["project-people", projectId, assigneeIds.join(",")],
    enabled: assigneeIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,role_title").in("id", assigneeIds);
      return ((data ?? []) as { id: string; full_name: string | null; role_title: string | null }[])
        .map(p => ({ id: p.id, full_name: p.full_name, role: p.role_title }));
    },
  });

  const [activeTab, setActiveTab] = useState("overview");

  if (!project) {
    return <div className="text-sm text-muted-foreground">Carregando projeto…</div>;
  }

  const fmt = (d: string | null) => {
    if (!d) return "—";
    const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const dt = iso ? new Date(+iso[1], +iso[2] - 1, +iso[3]) : new Date(d);
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  };

  const showCalendar = !!project.has_content_calendar;
  const showGrid = !!project.has_content_grid;
  const showTimeline = !!project.has_timeline;
  const showTraffic = !!project.traffic_budget?.enabled;
  const scope = (project.scope_flags ?? {}) as Record<string, unknown>;
  const showStrategy = ["swot", "personas", "competitors", "roadmap", "kpis", "action_plan"].some((k) => !!scope[k]);
  const showCampaigns = showTraffic;

  const taskRevenue = tasks.reduce((s, t) => {
    const deliv = (t.deliverables ?? []).reduce((a, d) => a + Number(d.billing_value ?? 0), 0);
    return s + (t.billing_enabled ? Number(t.billing_value ?? 0) : 0) + deliv;
  }, 0);
  const revenue = Number(project.fixed_value ?? 0) + Number(project.monthly_value ?? 0) + taskRevenue;
  const health = stats.overdue > 2 ? "bad" : stats.overdue > 0 ? "warn" : "";
  const healthLabel = health === "bad" ? "Crítico" : health === "warn" ? "Atenção" : "Saudável";
  const ownerName = people[0]?.full_name ?? "Não definido";
  const ownerRole = people[0]?.role ?? "Responsável";

  const TABS: { id: string; label: string; count?: number }[] = [
    { id: "overview", label: "Geral" },
    { id: "tasks", label: "Tarefas", count: tasks.length },
    { id: "team", label: "Equipe", count: people.length },
    { id: "finance", label: "Financeiro" },
    { id: "costs", label: "Custos" },
    ...(showStrategy ? [{ id: "strategy", label: "Estratégia" }] : []),
    ...(showCalendar ? [{ id: "calendar", label: "Calendário" }] : []),
    ...(showGrid ? [{ id: "grid", label: "Grid" }] : []),
    ...(showTimeline ? [{ id: "timeline", label: "Timeline" }] : []),
    ...(showTraffic ? [{ id: "traffic", label: "Tráfego" }] : []),
    ...(showCampaigns ? [{ id: "campaigns", label: "Campanhas" }] : []),
    { id: "docs", label: "Arquivos" },
  ];

  return (
    <div className="prj02">
      {/* 01 — cabeçalho global e projeto */}
      <div className="p2-crumb">
        <Link to="/projects">Projetos</Link>
        <span className="sep">/</span>
        <span className="cur">{project.name}</span>
      </div>

      <div className="p2-head">
        <div style={{ minWidth: 0 }}>
          <div className="p2-title-row">
            <h1 className="p2-title">{project.name}</h1>
            <span className={cn("p2-health", health)}><span className="dot" />{healthLabel}</span>
          </div>
          <p className="p2-sub">{project.description || "Sem descrição cadastrada para este projeto."}</p>
        </div>
        <div className="p2-actions">
          <button className="p2-btn" type="button" onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success("Link copiado"); }}>
            <Share2 /> Compartilhar
          </button>
          <button className="p2-btn" type="button" onClick={() => setEditOpen(true)}><Pencil /> Editar projeto</button>
          <button className="p2-btn primary" type="button" onClick={() => addTask.mutate("Nova tarefa")}><Plus /> Novo item</button>
          {isClosed ? (
            <button className="p2-btn icon" type="button" title="Reabrir" onClick={() => setStatus.mutate("active")}><RotateCcw /></button>
          ) : (
            <button className="p2-btn icon" type="button" title="Concluir projeto" onClick={() => { if (confirm("Concluir este projeto?")) setStatus.mutate("done"); }}><CheckCircle2 /></button>
          )}
          <Link to="/invoices" search={{ projectId: project.id, new: "1" }} className="p2-btn icon" title="Faturar"><Receipt /></Link>
        </div>
      </div>

      {/* 02 — KPIs do projeto */}
      <div className="p2-kpis">
        <div className="p2-kpi">
          <div className="p2-kpi-h"><Flag /> Status</div>
          <div className={cn("p2-kpi-v", health === "" && "green", health === "bad" && "red")}><span className="dot" style={{ background: "currentColor" }} />{STATUS_META[project.status].label}</div>
        </div>
        <div className="p2-kpi">
          <div className="p2-kpi-h">Progresso</div>
          <div className="p2-kpi-v">{stats.progress}%<span className="track"><i style={{ width: `${stats.progress}%` }} /></span></div>
        </div>
        <div className="p2-kpi">
          <div className="p2-kpi-h"><Calendar /> Prazo final</div>
          <div className="p2-kpi-v">{fmt(project.end_date)}</div>
          <div className="p2-kpi-f">{stats.daysDelta === null ? "sem prazo" : stats.daysDelta >= 0 ? `${stats.daysDelta} dias restantes` : `${Math.abs(stats.daysDelta)} dias em atraso`}</div>
        </div>
        <div className="p2-kpi">
          <div className="p2-kpi-h"><UsersIcon /> Responsável</div>
          <div className="p2-kpi-v" style={{ fontSize: 14 }}>{ownerName}</div>
          <div className="p2-kpi-f">{ownerRole}</div>
        </div>
        <div className="p2-kpi">
          <div className="p2-kpi-h"><UsersIcon /> Equipe</div>
          <div className="p2-kpi-v">
            <span className="p2-stack">
              {people.slice(0, 3).map(p => <span className="av" key={p.id}>{p2Initials(p.full_name)}</span>)}
              {people.length > 3 && <span className="more">+{people.length - 3}</span>}
              {!people.length && <span className="more">—</span>}
            </span>
          </div>
          <div className="p2-kpi-f">{people.length} membros</div>
        </div>
        <div className="p2-kpi">
          <div className="p2-kpi-h"><CheckCircle2 /> Tarefas concluídas</div>
          <div className="p2-kpi-v">{stats.done}</div>
          <div className="p2-kpi-f">de {stats.total}</div>
        </div>
        <div className="p2-kpi">
          <div className="p2-kpi-h"><AlertTriangle /> Tarefas atrasadas</div>
          <div className={cn("p2-kpi-v", stats.overdue > 0 && "red")}>{stats.overdue}</div>
          <div className="p2-kpi-f">críticas</div>
        </div>
        <div className="p2-kpi">
          <div className="p2-kpi-h"><DollarSign /> Receita prevista</div>
          <div className="p2-kpi-v">R$ {Math.round(revenue).toLocaleString("pt-BR")}</div>
          <div className="p2-kpi-f">Faturado: R$ {Math.round(stats.invoiced).toLocaleString("pt-BR")}{revenue > 0 ? ` (${Math.round((stats.invoiced / revenue) * 100)}%)` : ""}</div>
        </div>
      </div>

      {/* 03 — abas do projeto */}
      <div className="p2-tabs">
        {TABS.map(t => (
          <button key={t.id} type="button" className={cn("p2-tab", activeTab === t.id && "on")} onClick={() => setActiveTab(t.id)}>
            {t.label}{t.count !== undefined && <span className="count">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* 04 a 11 — conteúdo */}
      {activeTab === "overview" && (
        <Prj02Overview
          projectId={projectId}
          description={project.description ?? ""}
          projectType={projectTypeRow?.name ?? project.project_type ?? "—"}
          category={project.urgency ? `Urgência ${project.urgency}` : "Padrão"}
          budget={revenue}
          startDate={project.start_date}
          tags={[projectTypeRow?.name ?? null, project.billing_model, project.urgency ? `Urgência ${project.urgency}` : null].filter(Boolean) as string[]}
          clientName={client ? (client.trade_name || client.name) : "Interno"}
          clientSince={project.created_at ? fmt(project.created_at) : null}
          tasks={tasks as never}
          people={people}
          ownerName={ownerName}
          ownerRole={ownerRole}
          stageLabel={STATUS_META[project.status].label}
          stageSince={fmt(project.start_date)}
          revenue={revenue}
          invoiced={stats.invoiced}
        />
      )}

      {activeTab === "tasks" && (
        <Prj03Tasks
          tasks={tasks as never}
          people={people}
          onOpen={(id) => setSelectedTaskId(id)}
          onQuickCreate={() => addTask.mutate("Nova tarefa")}
          pending={addTask.isPending}
        />
      )}

      {activeTab === "team" && (
        <div style={{ marginTop: 18 }}>
          <ComingSoon icon={UsersIcon} title="Equipe do projeto" description="Alocação, papéis e horas dedicadas por membro." />
        </div>
      )}

      {activeTab === "finance" && <Prj04Finance charges={charges as never} tasks={tasks as never} costs={costs as never} />}
      {activeTab === "costs" && <div style={{ marginTop: 18 }}><ProjectCostsTab projectId={projectId} organizationId={project.organization_id} /></div>}
      {activeTab === "strategy" && <div style={{ marginTop: 18 }}><StrategyTab description={project.description ?? ""} onSave={(d) => saveField.mutate({ description: d })} /></div>}
      {activeTab === "calendar" && <div style={{ marginTop: 18 }}><ComingSoon icon={Calendar} title="Calendário de Conteúdo" description="Grade mensal com peças de conteúdo por plataforma." /></div>}
      {activeTab === "grid" && <div style={{ marginTop: 18 }}><ComingSoon icon={Grid3x3} title="Grid de Conteúdo" description="Prévia visual do feed por plataforma." /></div>}
      {activeTab === "timeline" && <div style={{ marginTop: 18 }}><ComingSoon icon={TimerIcon} title="Timeline" description="Roadmap do projeto por fases, com marcos e entregas." /></div>}
      {activeTab === "traffic" && <div style={{ marginTop: 18 }}><ComingSoon icon={Megaphone} title="Tráfego Pago" description="Campanhas, orçamento, CPA e ROAS do projeto." /></div>}
      {activeTab === "campaigns" && <div style={{ marginTop: 18 }}><ComingSoon icon={Rocket} title="Campanhas" description="Lançamentos e campanhas dentro do projeto." /></div>}
      {activeTab === "docs" && <div style={{ marginTop: 18 }}><ComingSoon icon={FileText} title="Arquivos" description="Briefings, contratos, PDFs e anexos deste projeto." /></div>}

      <TaskModal task={selectedTask} onClose={() => setSelectedTaskId(null)} />
      <EditProjectDialog
        project={project as EditableProject}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </div>
  );
}

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <Card className="rounded-2xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-semibold tracking-tight", tone === "danger" && "text-red-600 dark:text-red-400")}>{value}</div>
    </Card>
  );
}

type BaseTaskType = { id: string; name: string; color: string | null; icon: string | null; default_price: number | null; default_billing_model: string | null };

function TasksTab({
  tasks, baseTaskTypes, onAdd, onOpen, onQuickCreate, onCreateFromBase, pending,
}: {
  tasks: Task[];
  baseTaskTypes: BaseTaskType[];
  onAdd: (title: string) => void;
  onOpen: (id: string) => void;
  onQuickCreate: () => void;
  onCreateFromBase: (bt: BaseTaskType) => void;
  pending: boolean;
}) {
  const [draft, setDraft] = useState("");
  const submit = () => {
    const t = draft.trim();
    if (!t) return;
    onAdd(t);
    setDraft("");
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Clique em uma tarefa para editar, definir valor e faturar.</p>
        <Button className="rounded-full gap-1.5" onClick={onQuickCreate} disabled={pending}>
          <Plus className="h-4 w-4" /> Nova tarefa
        </Button>
      </div>

      {baseTaskTypes.length > 0 && (
        <Card className="rounded-2xl p-3">
          <div className="text-xs text-muted-foreground mb-2 px-1">Modelos deste tipo de projeto — clique para criar</div>
          <div className="flex flex-wrap gap-2">
            {baseTaskTypes.map(bt => (
              <button
                key={bt.id}
                onClick={() => onCreateFromBase(bt)}
                disabled={pending}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background hover:bg-muted/60 px-3 py-1.5 text-xs font-medium transition disabled:opacity-50"
                title={`Criar tarefa: ${bt.name}`}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: bt.color ?? "hsl(var(--primary))" }}
                />
                {bt.name}
                {bt.default_price != null && bt.default_price > 0 && (
                  <span className="text-muted-foreground">· R$ {Number(bt.default_price).toLocaleString("pt-BR")}</span>
                )}
              </button>
            ))}
          </div>
        </Card>
      )}


      <Card className="rounded-2xl overflow-hidden">
        <ul className="divide-y divide-border">
          {tasks.length === 0 && (
            <li className="px-6 py-12 text-center space-y-3">
              <div className="text-sm font-medium">Nenhuma tarefa neste projeto ainda</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Crie a primeira tarefa, defina o valor de faturamento e depois clique em <strong>Faturar</strong> para lançar no Financeiro.
              </p>
              <Button className="rounded-full gap-1.5" onClick={onQuickCreate} disabled={pending}>
                <Plus className="h-4 w-4" /> Criar primeira tarefa
              </Button>
            </li>
          )}
          {tasks.map(t => {
            const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== "done";
            return (
              <li key={t.id}>
                <button
                  onClick={() => onOpen(t.id)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/40"
                >
                  <Flag className={cn("h-3.5 w-3.5 shrink-0", PRIORITY_COLOR[t.priority])} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.title}</div>
                  </div>
                  <Badge className={cn("rounded-full", TASK_STATUS[t.status].color)}>{TASK_STATUS[t.status].label}</Badge>
                  {t.billing_value && t.billing_value > 0 ? (
                    <Badge variant="outline" className="rounded-full gap-1"><Zap className="h-3 w-3" />R$ {t.billing_value.toLocaleString("pt-BR")}</Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-full text-muted-foreground">Sem valor</Badge>
                  )}
                  {t.due_date && (
                    <span className={cn("text-xs shrink-0 w-14 text-right", overdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground")}>
                      {new Date(t.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          <li className="px-4 py-2 flex items-center gap-2">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submit(); }}
              disabled={pending}
              placeholder="Digite um título e pressione Enter…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground py-1"
            />
          </li>
        </ul>
      </Card>
    </div>
  );
}

function StrategyTab({ description, onSave }: { description: string; onSave: (d: string) => void }) {
  const [value, setValue] = useState(description);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="rounded-2xl p-4 lg:col-span-2 space-y-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          <div className="font-medium">Briefing estratégico</div>
        </div>
        <Textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={() => value !== description && onSave(value)}
          rows={10}
          className="rounded-xl resize-none"
          placeholder="Objetivo do projeto, público, tom de voz, diferenciais, KPIs..."
        />
        <div className="text-xs text-muted-foreground">Salva ao sair do campo.</div>
      </Card>
      <div className="space-y-3">
        <StratCard title="SWOT" hint="Forças, fraquezas, oportunidades e ameaças." />
        <StratCard title="Personas" hint="Perfis de público-alvo detalhados." />
        <StratCard title="Concorrentes" hint="Análise comparativa e pontos de atenção." />
        <StratCard title="KPIs" hint="Métricas de sucesso e resultados esperados." />
      </div>
    </div>
  );
}

function StratCard({ title, hint }: { title: string; hint: string }) {
  return (
    <Card className="rounded-2xl p-4">
      <div className="text-sm font-medium">{title}</div>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      <Button size="sm" variant="outline" className="rounded-full mt-3 gap-1"><Plus className="h-3.5 w-3.5" />Adicionar</Button>
    </Card>
  );
}

function FinanceTab({
  charges,
  tasks,
  costs,
}: {
  charges: Charge[];
  tasks: Task[];
  costs: { id: string; amount: number; status: string; kind: string; description: string | null; occurred_on: string }[];
}) {
  const fmt = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const invoiced = charges.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const paid = charges.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const pendingReceive = invoiced - paid;

  // Receita prevista (potencial): soma de tudo faturável no projeto,
  // considerando o valor da tarefa e o dos entregáveis marcados como faturáveis.
  // Para tarefas de transmissão/estreia, multiplica pelo nº de datas ao ar.
  const projected = tasks.reduce((sum, t) => {
    const base = t.billing_enabled && t.billing_value != null ? Number(t.billing_value) : 0;
    const multiplier = t.broadcast_kind && (t.aired_dates?.length ?? 0) > 0 ? t.aired_dates.length : 1;
    const taskRev = base * multiplier;
    const deliverRev = (t.deliverables ?? [])
      .filter(d => d.billing_enabled && d.billing_value != null)
      .reduce((s, d) => s + Number(d.billing_value ?? 0), 0);
    return sum + taskRev + deliverRev;
  }, 0);
  const toBill = Math.max(0, projected - invoiced);

  const costsTotal = costs.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const costsPaid = costs.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const margin = projected - costsTotal;
  const marginPct = projected > 0 ? Math.round((margin / projected) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Panorama do projeto */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Receita prevista" value={fmt(projected)} />
        <Kpi label="Faturado" value={fmt(invoiced)} />
        <Kpi label="Recebido" value={fmt(paid)} />
        <Kpi label="A receber" value={fmt(pendingReceive)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="A faturar" value={fmt(toBill)} />
        <Kpi label="Custos" value={fmt(costsTotal)} />
        <Kpi label="Custos pagos" value={fmt(costsPaid)} />
        <Kpi label={`Margem prevista${projected > 0 ? ` (${marginPct}%)` : ""}`} value={fmt(margin)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">Lançamentos financeiros</div>
          <ul className="divide-y divide-border">
            {charges.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum lançamento vinculado a este projeto.</li>
            )}
            {charges.map(c => (
              <li key={c.id} className="px-4 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.description}</div>
                  {c.due_date && <div className="text-xs text-muted-foreground">Vence {new Date(c.due_date).toLocaleDateString("pt-BR")}</div>}
                </div>
                <Badge variant="outline" className="rounded-full">{c.status}</Badge>
                <span className="text-sm font-medium w-32 text-right text-emerald-600 dark:text-emerald-400">
                  {fmt(Number(c.amount))}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wide">Custos do projeto</div>
          <ul className="divide-y divide-border">
            {costs.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum custo registrado para este projeto.</li>
            )}
            {costs.map(c => (
              <li key={c.id} className="px-4 py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{c.description ?? c.kind}</div>
                  <div className="text-xs text-muted-foreground">{new Date(c.occurred_on).toLocaleDateString("pt-BR")} · {c.kind}</div>
                </div>
                <Badge variant="outline" className="rounded-full">{c.status}</Badge>
                <span className="text-sm font-medium w-32 text-right text-rose-600 dark:text-rose-400">
                  {fmt(Number(c.amount))}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function ComingSoon({ icon: Icon, title, description }: { icon: typeof FileText; title: string; description: string }) {
  return (
    <Card className="rounded-3xl p-10 text-center border-dashed">
      <Icon className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
      <div className="font-medium">{title}</div>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{description}</p>
      <Badge variant="outline" className="rounded-full mt-4">Em breve</Badge>
    </Card>
  );
}
