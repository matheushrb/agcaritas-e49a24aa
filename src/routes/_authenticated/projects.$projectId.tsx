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
  Building2, CheckCircle2, RotateCcw, Pencil, AlertTriangle, Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TaskModal } from "./tasks";

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
  name: string;
  description: string | null;
  status: ProjectStatus;
  client_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
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
        .select("id,name,description,status,client_id,start_date,end_date,created_at")
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
      const { data } = await supabase.from("clients").select("id,name").eq("id", project.client_id).maybeSingle();
      return (data as Client) ?? null;
    },
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["project-tasks", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,description,status,priority,due_date,billing_value,billing_model,billing_enabled,project_id,client_id,assignee_id,platform,delivery_type,estimated_hours,progress,stage,task_type_id,current_stage_id,deliverables,subtasks,created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
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

  const stats = useMemo(() => {
    const total = tasks.length;
    const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done").length;
    const done = tasks.filter(t => t.status === "done").length;
    const invoiced = charges.reduce((s, c) => s + Number(c.amount ?? 0), 0);
    return { total, overdue, done, invoiced };
  }, [tasks, charges]);

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

  const addTask = useMutation({
    mutationFn: async (title: string) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { data, error } = await supabase.from("tasks").insert({
        title,
        status: "todo",
        priority: "medium",
        project_id: projectId,
        organization_id: profile.organization_id,
      }).select("id").single();
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
      const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!project) {
    return <div className="text-sm text-muted-foreground">Carregando projeto…</div>;
  }

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Link to="/projects" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Projetos
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-3xl font-bold tracking-tight truncate">{project.name}</h1>
              <Badge className={cn("rounded-full", STATUS_META[project.status].color)}>{STATUS_META[project.status].label}</Badge>
            </div>
            <div className="mt-1 text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
              {client && <span>{client.name}</span>}
              <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{fmt(project.start_date)} → {fmt(project.end_date)}</span>
            </div>
          </div>

          <Select value={project.status} onValueChange={v => setStatus.mutate(v as ProjectStatus)}>
            <SelectTrigger className="w-[170px] rounded-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_META) as ProjectStatus[]).map(s => (
                <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Tarefas" value={stats.total.toString()} />
          <Kpi label="Concluídas" value={stats.done.toString()} />
          <Kpi label="Atrasadas" value={stats.overdue.toString()} tone={stats.overdue > 0 ? "danger" : "default"} />
          <Kpi label="Faturado" value={`R$ ${stats.invoiced.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tasks">
        <div className="overflow-x-auto">
          <TabsList className="rounded-full bg-muted/60 h-auto flex-wrap">
            <TabsTrigger value="tasks"     className="rounded-full gap-1.5"><CheckSquare className="h-4 w-4" />Tarefas</TabsTrigger>
            <TabsTrigger value="docs"      className="rounded-full gap-1.5"><FileText className="h-4 w-4" />Documentos</TabsTrigger>
            <TabsTrigger value="calendar"  className="rounded-full gap-1.5"><Calendar className="h-4 w-4" />Calendário</TabsTrigger>
            <TabsTrigger value="grid"      className="rounded-full gap-1.5"><Grid3x3 className="h-4 w-4" />Grid</TabsTrigger>
            <TabsTrigger value="timeline"  className="rounded-full gap-1.5"><TimerIcon className="h-4 w-4" />Timeline</TabsTrigger>
            <TabsTrigger value="traffic"   className="rounded-full gap-1.5"><Megaphone className="h-4 w-4" />Tráfego</TabsTrigger>
            <TabsTrigger value="strategy"  className="rounded-full gap-1.5"><Compass className="h-4 w-4" />Estratégia</TabsTrigger>
            <TabsTrigger value="campaigns" className="rounded-full gap-1.5"><Rocket className="h-4 w-4" />Campanhas</TabsTrigger>
            <TabsTrigger value="finance"   className="rounded-full gap-1.5"><DollarSign className="h-4 w-4" />Financeiro</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="tasks" className="mt-4">
          <TasksTab
            tasks={tasks}
            onAdd={(t) => addTask.mutate(t)}
            onOpen={(id) => setSelectedTaskId(id)}
            onQuickCreate={() => addTask.mutate("Nova tarefa")}
            pending={addTask.isPending}
          />
        </TabsContent>

        <TabsContent value="docs" className="mt-4">
          <ComingSoon
            icon={FileText}
            title="Documentos"
            description="Briefings, contratos, PDFs e anexos deste projeto ficarão aqui, com histórico de versões."
          />
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <ComingSoon
            icon={Calendar}
            title="Calendário de Conteúdo"
            description="Grade mensal com peças de conteúdo por plataforma. Clique em um dia vazio para criar; clique em peça para editar."
          />
        </TabsContent>

        <TabsContent value="grid" className="mt-4">
          <ComingSoon
            icon={Grid3x3}
            title="Grid de Conteúdo"
            description="Prévia visual do feed (Instagram, TikTok, LinkedIn). Arraste peças para reordenar."
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <ComingSoon
            icon={TimerIcon}
            title="Timeline"
            description="Roadmap do projeto por fases, com marcos e entregas."
          />
        </TabsContent>

        <TabsContent value="traffic" className="mt-4">
          <ComingSoon
            icon={Megaphone}
            title="Tráfego Pago"
            description="Campanhas ativas, orçamento, CPA, ROAS e criativos vinculados ao projeto."
          />
        </TabsContent>

        <TabsContent value="strategy" className="mt-4">
          <StrategyTab description={project.description ?? ""} onSave={(d) => saveField.mutate({ description: d })} />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <ComingSoon
            icon={Rocket}
            title="Campanhas"
            description="Lançamentos e campanhas específicas dentro do projeto, com objetivo, período e KPI."
          />
        </TabsContent>

        <TabsContent value="finance" className="mt-4">
          <FinanceTab charges={charges} />
        </TabsContent>
      </Tabs>

      <TaskModal task={selectedTask} onClose={() => setSelectedTaskId(null)} />
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

function TasksTab({
  tasks, onAdd, onOpen, onQuickCreate, pending,
}: {
  tasks: Task[];
  onAdd: (title: string) => void;
  onOpen: (id: string) => void;
  onQuickCreate: () => void;
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

function FinanceTab({ charges }: { charges: Charge[] }) {
  const invoiced = charges.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const paid = charges.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const pending = invoiced - paid;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="Faturado" value={`R$ ${invoiced.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
        <Kpi label="Recebido" value={`R$ ${paid.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
        <Kpi label="Pendente" value={`R$ ${pending.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
      </div>
      <Card className="rounded-2xl overflow-hidden">
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
                R$ {Number(c.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </li>
          ))}
        </ul>
      </Card>
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
