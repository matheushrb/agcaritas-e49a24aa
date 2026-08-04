import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Search, Plus, LayoutGrid, List as ListIcon, Play, Pause, Square, Clock, Zap,
  ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Flag, Circle,
  MessageSquare, Paperclip, ListChecks, Activity, Trash2, MoreHorizontal, Timer,
  DollarSign, Check, Minus, PanelRightOpen, Maximize2, PanelLeftOpen, Radio, Save as SaveIcon, Lock,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTaskTypes, useTaskTypeStages, type TaskTypeRow, type TaskTypeStageRow, type StatusGroup } from "@/lib/task-types";
import { TaskTypeIcon } from "@/components/settings/icon-picker";
import { IconPreview } from "@/components/settings/icon-color-pickers";
import { useAutomationSettings, effectivePriority, DEFAULT_AUTOMATION_SETTINGS } from "@/lib/automation-settings";
import { Link } from "@tanstack/react-router";
import { CostConfirmDialog, type CostSuggestion } from "@/components/cost-confirm-dialog";
import { suggestTaskCost, type CostMode } from "@/components/team-cost-fields";
import { useCalendarBlocks, BLOCK_META, type CalendarBlock } from "@/lib/calendar-blocks";
import { NewTaskWindow } from "@/components/new-task-window";
import { TaskViews, TaskViewSwitcher, type TskView } from "@/components/tsk-views";

export const Route = createFileRoute("/_authenticated/tasks")({
  validateSearch: (s: Record<string, unknown>) => ({
    open: typeof s.open === "string" ? s.open : undefined,
    new: s.new === 1 || s.new === "1" ? 1 : undefined,
  }),
  component: TasksPage,
});

type TaskStatus = "todo" | "in_progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent" | "critical";
type BillingModel = "hourly" | "one_time" | "package" | "monthly" | "per_task";
type TaskStage = "briefing" | "creation" | "review" | "approval" | "delivery";

type Subtask = { id: string; title: string; done: boolean };

type Deliverable = {
  id: string;
  platform: string;
  type: string;
  billing_enabled: boolean;
  billing_model: BillingModel | null;
  billing_value: number | null;
  delivered_date?: string | null;
  link?: string | null;
  channel?: string | null;
  invoiced?: boolean;
  delivered?: boolean;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  project_id: string | null;
  client_id: string | null;
  assignee_id: string | null;
  due_date: string | null;
  start_date?: string | null;
  billing_model: BillingModel | null;
  billing_value: number | null;
  billing_enabled: boolean;
  progress: number;
  platform: string | null;
  delivery_type: string | null;
  estimated_hours: number | null;
  stage: TaskStage;
  task_type_id: string | null;
  current_stage_id: string | null;
  deliverables: Deliverable[];
  subtasks: Subtask[];
  broadcast_kind: "premiere" | "live" | "recorded" | null;
  recorded_at: string | null;
  aired_at: string | null;
  recorded_dates: string[];
  aired_dates: string[];
  created_at?: string;
};

const STATUS_META: Record<TaskStatus, { label: string; color: string; dot: string }> = {
  todo:        { label: "A fazer",      color: "bg-muted text-foreground",                                dot: "bg-muted-foreground" },
  in_progress: { label: "Em andamento", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400",         dot: "bg-blue-500" },
  review:      { label: "Revisão",      color: "bg-amber-500/15 text-amber-600 dark:text-amber-400",      dot: "bg-amber-500" },
  done:        { label: "Concluída",    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
};
const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "review", "done"];

const PRIORITY_META: Record<TaskPriority, { label: string; color: string; badge: string }> = {
  low:      { label: "Baixa",    color: "text-muted-foreground",                     badge: "bg-muted text-muted-foreground" },
  medium:   { label: "Média",    color: "text-amber-600 dark:text-amber-400",        badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  high:     { label: "Alta",     color: "text-red-600 dark:text-red-400",            badge: "bg-red-500/15 text-red-600 dark:text-red-400" },
  urgent:   { label: "Urgente",  color: "text-orange-600 dark:text-orange-400",      badge: "bg-orange-500/20 text-orange-700 dark:text-orange-300" },
  critical: { label: "Crítica",  color: "text-red-700 dark:text-red-300",            badge: "bg-red-600/25 text-red-700 dark:text-red-200 font-semibold" },
};

function TasksPage() {
  const qc = useQueryClient();
  const searchParams = Route.useSearch();
  const navigate = Route.useNavigate();
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [view, setView] = useState<TskView>("list");
  const [turbo, setTurbo] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftTask, setDraftTask] = useState<Task | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState<Record<string, string>>({});

  // Abrir tarefa via ?open=<id>
  useEffect(() => {
    if (searchParams.open && searchParams.open !== selectedId) {
      setSelectedId(searchParams.open);
      navigate({ search: (prev: any) => ({ ...prev, open: undefined }), replace: true });
    }
  }, [searchParams.open]);

  // Abrir nova tarefa via ?new=1
  useEffect(() => {
    if (searchParams.new) {
      setSelectedId(null);
      setNewOpen(true);
      navigate({ search: (prev: any) => ({ ...prev, new: undefined }), replace: true });
    }
  }, [searchParams.new]);

  const { data: automation } = useAutomationSettings();
  const settings = automation?.settings ?? DEFAULT_AUTOMATION_SETTINGS;

  const { data: rawTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,description,status,priority,project_id,client_id,assignee_id,due_date,billing_model,billing_value,billing_enabled,progress,start_date,platform,delivery_type,estimated_hours,stage,task_type_id,current_stage_id,deliverables,subtasks,broadcast_kind,recorded_at,aired_at,recorded_dates,aired_dates,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map(t => ({
        ...t,
        recorded_dates: Array.isArray(t.recorded_dates) ? t.recorded_dates : [],
        aired_dates: Array.isArray(t.aired_dates) ? t.aired_dates : [],
      })) as Task[];
    },
  });

  const { data: projectsMin = [] } = useQuery({
    queryKey: ["projects-min-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const projectName = (id: string | null) =>
    (id && projectsMin.find(p => p.id === id)?.name) || "Sem projeto";

  const { data: peopleMin = [] } = useQuery({
    queryKey: ["profiles-min-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,display_name,role_title").order("full_name");
      return (data ?? []) as { id: string; full_name: string | null; display_name: string | null; role_title: string | null }[];
    },
  });
  const assigneeName = (id: string | null | undefined) => {
    const p = id ? peopleMin.find(x => x.id === id) : null;
    return { name: p?.display_name || p?.full_name || (id ? "Responsável" : "Não atribuído"), role: p?.role_title ?? null };
  };

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const tasks = useMemo(() => rawTasks.map(t => {
    const eff = effectivePriority(t, settings);
    return eff.escalated ? { ...t, priority: eff.priority } as Task : t;
  }), [rawTasks, settings]);

  const filtered = useMemo(() => {
    let arr = tasks;
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter(t =>
        t.title.toLowerCase().includes(s) ||
        projectName(t.project_id).toLowerCase().includes(s) ||
        assigneeName(t.assignee_id).name.toLowerCase().includes(s)
      );
    }
    if (priorityFilter !== "all") arr = arr.filter(t => t.priority === priorityFilter);
    if (statusFilter !== "all") arr = arr.filter(t => t.status === statusFilter);
    if (assigneeFilter !== "all")
      arr = arr.filter(t => (assigneeFilter === "none" ? !t.assignee_id : t.assignee_id === assigneeFilter));
    if (projectFilter !== "all")
      arr = arr.filter(t => (projectFilter === "none" ? !t.project_id : t.project_id === projectFilter));
    if (turbo) arr = [...arr].sort((a, b) => (b.billing_value ?? 0) - (a.billing_value ?? 0));
    return arr;
  }, [tasks, search, priorityFilter, statusFilter, assigneeFilter, projectFilter, turbo, projectsMin, peopleMin]);

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], review: [], done: [] };
    for (const t of filtered) map[t.status].push(t);
    return map;
  }, [filtered]);

  const kpis = useMemo(() => {
    const total = tasks.length;
    const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done").length;
    const inProgress = tasks.filter(t => t.status === "in_progress").length;
    const review = tasks.filter(t => t.status === "review").length;
    const done = tasks.filter(t => t.status === "done").length;
    const value = tasks.reduce((s, t) => s + (t.billing_value ?? 0), 0);
    return { total, overdue, inProgress, review, done, value };
  }, [tasks]);

  const createTask = useMutation({
    mutationFn: async (input: { title: string; status: TaskStatus; priority?: TaskPriority }) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { data, error } = await supabase.from("tasks").insert({
        title: input.title,
        status: input.status,
        priority: input.priority ?? "medium",
        organization_id: profile.organization_id,
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const handleNew = () => {
    setSelectedId(null);
    setDraftTask(null);
    setNewOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedId(null);
    setDraftTask(null);
  };

  const selected = draftTask ?? tasks.find(t => t.id === selectedId) ?? null;

  const handleQuickCreate = (status: TaskStatus) => {
    const title = (quickTitle[status] ?? "").trim();
    if (!title) return;
    createTask.mutate({ title, status });
    setQuickTitle(p => ({ ...p, [status]: "" }));
  };

  return (
    <>
      <Tsk02List
        view={view}
        onViewChange={setView}
        tasks={tasks as any}
        projects={projectsMin}
        people={peopleMin}
        onOpen={(id) => { setDraftTask(null); setSelectedId(id); }}
        onNew={handleNew}
        onQuickCreate={(title) => createTask.mutate({ title, status: "todo" })}
        onStatusChange={(id, status) => updateStatus.mutate({ id, status: status as TaskStatus })}
      >
        {isLoading ? (
          <div className="mt-5 text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <div className="mt-5">
            <TaskViews
              view={view === "board" ? "kanban" : "gantt"}
              tasks={filtered as any}
              projectName={projectName}
              assigneeName={assigneeName}
              onOpen={(id) => { setDraftTask(null); setSelectedId(id); }}
              onQuickCreate={(status, title) => createTask.mutate({ title, status })}
              onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
            />
          </div>
        )}
      </Tsk02List>


      <TaskModal
        task={selected}
        onClose={handleCloseModal}
      />

      <NewTaskWindow
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(id) => setSelectedId(id)}
      />
    </>
  );
}

function createLocalTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: "",
    description: null,
    status: "todo",
    priority: "medium",
    project_id: null,
    client_id: null,
    assignee_id: null,
    due_date: null,
    billing_model: null,
    billing_value: null,
    billing_enabled: false,
    progress: 0,
    platform: null,
    delivery_type: null,
    estimated_hours: null,
    stage: "creation",
    task_type_id: null,
    current_stage_id: null,
    deliverables: [],
    subtasks: [],
    broadcast_kind: null,
    recorded_at: null,
    aired_at: null,
    recorded_dates: [],
    aired_dates: [],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <Card className="rounded-2xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tracking-tight", tone === "danger" && "text-red-600 dark:text-red-400")}>{value}</div>
    </Card>
  );
}

function isOverdue(task: Task) {
  return task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
}

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const overdue = isOverdue(task);
  return (
    <li>
      <button onClick={onClick} className="w-full text-left px-4 py-3 hover:bg-muted/40 flex items-center gap-3">
        <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_META[task.status].dot)} />
        <Flag className={cn("h-3.5 w-3.5 shrink-0", PRIORITY_META[task.priority].color)} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium flex items-center gap-2">
            {overdue && <Badge className="rounded-full bg-red-500/15 text-red-600 dark:text-red-400 text-[10px] px-1.5 py-0">Atrasada</Badge>}
            {task.title}
          </div>
          {task.description && <div className="truncate text-xs text-muted-foreground">{task.description}</div>}
        </div>
        {task.billing_value && task.billing_value > 0 && (
          <Badge variant="outline" className="rounded-full gap-1"><Zap className="h-3 w-3" />R$ {task.billing_value.toLocaleString("pt-BR")}</Badge>
        )}
        {task.due_date && (
          <span className={cn("text-xs shrink-0", overdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground")}>
            {new Date(task.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          </span>
        )}
      </button>
    </li>
  );
}

function KanbanCard({ task, onClick }: { task: Task; onClick: () => void }) {
  const overdue = isOverdue(task);
  return (
    <button onClick={onClick} className="w-full text-left rounded-xl bg-card border border-border p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium line-clamp-2">
          {overdue && <Badge className="mr-1.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 text-[10px] px-1.5 py-0">Atrasada</Badge>}
          {task.title}
        </div>
        <Badge className={cn("rounded-full shrink-0 text-[10px]", PRIORITY_META[task.priority].badge)}>{PRIORITY_META[task.priority].label}</Badge>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        {task.due_date ? new Date(task.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}
        {task.billing_value && task.billing_value > 0 ? <span className="flex items-center gap-1"><Zap className="h-3 w-3" />R$ {task.billing_value.toLocaleString("pt-BR")}</span> : null}
      </div>
    </button>
  );
}

/* ============================================================
 * TaskModal — janela grande estilo ClickUp / Monday
 * ============================================================ */
export function TaskModal({
  task,
  onClose,
}: {
  task: Task | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [dueDate, setDueDate] = useState<string>("");
  const [billingModel, setBillingModel] = useState<BillingModel | "">("");
  const [billingValue, setBillingValue] = useState<string>("");
  const [estimatedHours, setEstimatedHours] = useState<string>("");
  const [platform, setPlatform] = useState<string>("");
  const [deliveryType, setDeliveryType] = useState<string>("");
  const [stage, setStage] = useState<TaskStage>("creation");
  const [progress, setProgress] = useState<number>(0);
  const [projectId, setProjectId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [billingEnabled, setBillingEnabled] = useState<boolean>(false);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [taskTypeId, setTaskTypeId] = useState<string>("");
  const [currentStageId, setCurrentStageId] = useState<string>("");
  const [broadcastKind, setBroadcastKind] = useState<"premiere" | "live" | "recorded" | "">("");
  const [recordedDates, setRecordedDates] = useState<string[]>([]);
  const [airedDates, setAiredDates] = useState<string[]>([]);
  const [costPrompt, setCostPrompt] = useState<{
    member: { id: string; name: string; cost_mode: CostMode };
    suggestion: CostSuggestion;
    assigneeId: string;
  } | null>(null);
  const persistedDraftIdRef = useRef<string | null>(null);
  const creatingDraftRef = useRef<Promise<string> | null>(null);

  const { data: taskTypes = [] } = useTaskTypes();
  const { data: typeStages = [] } = useTaskTypeStages(taskTypeId || null);

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["tasks-modal-assignees"],
    queryFn: async () => {
      // assignee_id referencia auth.users → listamos profiles da organização
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,avatar_url")
        .order("full_name");
      return (data ?? [])
        .map((p: any) => ({
          id: p.id as string,
          name: (p.full_name || "Sem nome") as string,
          avatar_url: (p.avatar_url ?? null) as string | null,
        }));
    },
  });

  // team_members com dados de custo — indexados por user_id para lookup rápido ao atribuir
  const { data: costMembers = [] } = useQuery({
    queryKey: ["tasks-modal-cost-members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_members")
        .select("id,user_id,name,cost_mode,hourly_rate,monthly_salary,monthly_hours,default_task_rate,task_rate_overrides");
      return (data ?? []) as Array<{
        id: string; user_id: string | null; name: string; cost_mode: CostMode;
        hourly_rate: number | null; monthly_salary: number | null; monthly_hours: number | null;
        default_task_rate: number | null; task_rate_overrides: Record<string, number> | null;
      }>;
    },
  });

  const { data: projectsList = [] } = useQuery({
    queryKey: ["tasks-modal-projects"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id,name,client_id").order("name");
      return (data ?? []) as { id: string; name: string; client_id: string | null }[];
    },
  });

  // Plataformas permitidas: quando a tarefa pertence a um projeto, restringe às
  // plataformas cadastradas naquele projeto (scope_flags.tools = lista de nomes).
  const { data: projectPlatforms = null } = useQuery({
    queryKey: ["tasks-modal-project-platforms", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data: proj } = await supabase
        .from("projects")
        .select("scope_flags")
        .eq("id", projectId)
        .maybeSingle();
      const tools: string[] = Array.isArray((proj?.scope_flags as any)?.tools)
        ? (proj!.scope_flags as any).tools
        : [];
      if (tools.length === 0) return [] as { value: string; label: string; icon_url?: string | null; icon?: string | null; color?: string | null }[];
      const { data: plats } = await (supabase as any)
        .from("platforms")
        .select("id,name,icon,icon_url,color")
        .in("name", tools);
      return ((plats ?? []) as { id: string; name: string; icon?: string | null; icon_url?: string | null; color?: string | null }[]).map(p => ({
        value: p.name,
        label: p.name,
        icon: p.icon,
        icon_url: p.icon_url,
        color: p.color,
      }));
    },
  });



  const { data: clientsList = [] } = useQuery({
    queryKey: ["tasks-modal-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  useEffect(() => {
    if (!task) return;
    persistedDraftIdRef.current = null;
    creatingDraftRef.current = null;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setPriority(task.priority);
    setStatus(task.status);
    setDueDate(task.due_date ?? "");
    setBillingModel(task.billing_model ?? "");
    setBillingValue(task.billing_value?.toString() ?? "");
    setEstimatedHours(task.estimated_hours?.toString() ?? "");
    setPlatform(task.platform ?? "");
    setDeliveryType(task.delivery_type ?? "");
    setStage(task.stage ?? "creation");
    setProgress(task.progress ?? 0);
    setProjectId(task.project_id ?? "");
    setClientId(task.client_id ?? "");
    setBillingEnabled(task.billing_enabled ?? false);
    setDeliverables(Array.isArray(task.deliverables) ? task.deliverables : []);
    setSubtasks(Array.isArray(task.subtasks) ? task.subtasks : []);
    setAssigneeId(task.assignee_id ?? "");
    setTaskTypeId(task.task_type_id ?? "");
    setCurrentStageId(task.current_stage_id ?? "");
    setBroadcastKind((task.broadcast_kind ?? "") as any);
    {
      const legacyRec = task.recorded_at ? [task.recorded_at.slice(0, 10)] : [];
      const legacyAir = task.aired_at ? [task.aired_at.slice(0, 10)] : [];
      const rec = Array.isArray(task.recorded_dates) && task.recorded_dates.length > 0 ? task.recorded_dates : legacyRec;
      const air = Array.isArray(task.aired_dates) && task.aired_dates.length > 0 ? task.aired_dates : legacyAir;
      setRecordedDates(rec);
      setAiredDates(air);
    }
    setDirty(false);
  }, [task]);

  // Rastreia se há alterações pendentes desde o último carregamento/salvamento.
  const [dirty, setDirty] = useState(false);
  const markDirty = () => setDirty(true);

  const isLocalDraft = !!task?.id.startsWith("draft-");

  // Monta payload completo (usado no Salvar explícito e ao criar rascunho).
  const buildFullPayload = async () => {
    const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
    if (!profile?.organization_id) throw new Error("Sem organização");
    return {
      organization_id: profile.organization_id,
      title: (title.trim() || "Nova tarefa"),
      description: description || null,
      status,
      priority,
      project_id: projectId || null,
      client_id: clientId || null,
      due_date: dueDate || null,
      billing_model: (billingModel || null) as BillingModel | null,
      billing_value: billingValue ? Number(billingValue) : null,
      billing_enabled: billingEnabled,
      progress,
      platform: platform || null,
      delivery_type: deliveryType || null,
      estimated_hours: estimatedHours ? Number(estimatedHours) : null,
      stage,
      deliverables,
      subtasks,
      assignee_id: assigneeId || null,
      task_type_id: taskTypeId || null,
      current_stage_id: currentStageId || null,
      broadcast_kind: broadcastKind || null,
      recorded_at: recordedDates[0] || null,
      aired_at: airedDates[0] || null,
      recorded_dates: recordedDates,
      aired_dates: airedDates,
    };
  };

  // Cria o registro no banco caso a tarefa ainda esteja como rascunho local.
  const createDraftRecord = async () => {
    if (persistedDraftIdRef.current) return { id: persistedDraftIdRef.current, created: false };
    if (creatingDraftRef.current) return { id: await creatingDraftRef.current, created: false };

    creatingDraftRef.current = (async () => {
      const payload = await buildFullPayload();
      const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
      if (error) throw error;
      return data.id as string;
    })();

    try {
      const id = await creatingDraftRef.current;
      persistedDraftIdRef.current = id;
      return { id, created: true };
    } finally {
      creatingDraftRef.current = null;
    }
  };

  // Salvamento explícito — envia todo o estado atual em uma única gravação.
  const save = useMutation({
    mutationFn: async () => {
      if (!task) return;
      if (isLocalDraft) {
        const { created } = await createDraftRecord();
        if (created) return;
        const payload = await buildFullPayload();
        const { error } = await supabase.from("tasks").update(payload).eq("id", persistedDraftIdRef.current!);
        if (error) throw error;
        return;
      }
      const payload = await buildFullPayload();
      const { error } = await supabase.from("tasks").update(payload).eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["project-tasks"] });
      setDirty(false);
      toast.success("Alterações salvas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTask = useMutation({
    mutationFn: async () => {
      if (!task) return;
      if (isLocalDraft && !persistedDraftIdRef.current) return;
      const { error } = await supabase.from("tasks").delete().eq("id", persistedDraftIdRef.current ?? task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa excluída");
      onClose();
    },
  });

  const [invoiced, setInvoiced] = useState(false);
  useEffect(() => {
    setInvoiced(false);
    if (!task || isLocalDraft) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("charges")
        .select("id")
        .eq("task_id", task.id)
        .is("parent_charge_id", null)
        .is("deliverable_id", null)
        .maybeSingle();
      if (!cancelled && data) setInvoiced(true);
    })();
    return () => { cancelled = true; };
  }, [task?.id, isLocalDraft]);

  const bill = useMutation({
    mutationFn: async () => {
      if (!task) return;
      if (dirty) throw new Error("Salve as alterações da tarefa antes de faturar");
      if (!billingEnabled) throw new Error("Ative a chave de faturamento nesta tarefa");
      const value = billingValue ? Number(billingValue) : 0;
      if (!value || value <= 0) throw new Error("Defina um valor de faturamento primeiro");
      const persistedTaskId = isLocalDraft ? (await createDraftRecord()).id : task.id;
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const resolvedProjectId = projectId || task.project_id || null;
      let resolvedClient: string | null = clientId || task.client_id || null;
      if (!resolvedClient && resolvedProjectId) {
        const { data: proj } = await supabase.from("projects").select("client_id").eq("id", resolvedProjectId).maybeSingle();
        resolvedClient = (proj?.client_id as string) ?? null;
      }
      const today = new Date().toISOString().slice(0, 10);
      const baseTitle = title.trim() || task.title || "Nova tarefa";
      // Se a tarefa é de transmissão/estreia com datas ao ar, gera uma cobrança por data.
      const airDates = Array.isArray(airedDates) ? airedDates.filter(Boolean) : [];
      const useAirDates = !!broadcastKind && airDates.length > 0;
      const kindLabel = broadcastKind === "live" ? "Ao vivo" : broadcastKind === "premiere" ? "Estreia" : broadcastKind === "recorded" ? "Gravado" : "";
      const rows = useAirDates
        ? airDates.map(d => ({
            organization_id: profile.organization_id,
            project_id: resolvedProjectId,
            task_id: persistedTaskId,
            client_id: resolvedClient,
            description: `Tarefa: ${baseTitle}${kindLabel ? ` — ${kindLabel}` : ""} em ${new Date(d + "T00:00:00").toLocaleDateString("pt-BR")}`,
            amount: value,
            status: "pending_invoice" as const,
            due_date: d,
            type: "income" as const,
          }))
        : [{
            organization_id: profile.organization_id,
            project_id: resolvedProjectId,
            task_id: persistedTaskId,
            client_id: resolvedClient,
            description: `Tarefa: ${baseTitle}`,
            amount: value,
            status: "pending_invoice" as const,
            due_date: today,
            type: "income" as const,
          }];
      const { error } = await supabase.from("charges").insert(rows);
      if (error) throw error;
      return { count: rows.length };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["charges"] });
      qc.invalidateQueries({ queryKey: ["project-charges"] });
      setInvoiced(true);
      const n = res?.count ?? 1;
      toast.success(n > 1 ? `${n} cobranças lançadas no Financeiro` : "Tarefa lançada no Financeiro");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const billDeliverable = useMutation({
    mutationFn: async (d: Deliverable) => {
      if (!task) return;
      if (dirty) throw new Error("Salve as alterações da tarefa antes de faturar o entregável");
      if (!d.billing_enabled) throw new Error("Ative o faturamento deste entregável");
      if (!d.delivered) throw new Error("Marque o entregável como entregue antes de faturar");
      const value = d.billing_value ?? 0;
      if (!value || value <= 0) throw new Error("Defina um valor para este entregável");
      const persistedTaskId = isLocalDraft ? (await createDraftRecord()).id : task.id;
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const resolvedProjectId = projectId || task.project_id || null;
      let resolvedClient: string | null = clientId || task.client_id || null;
      if (!resolvedClient && resolvedProjectId) {
        const { data: proj } = await supabase.from("projects").select("client_id").eq("id", resolvedProjectId).maybeSingle();
        resolvedClient = (proj?.client_id as string) ?? null;
      }
      const deliveredDate = d.delivered_date || new Date().toISOString().slice(0, 10);
      const platLabel = d.platform ? platformLabel(d.platform) : "Entregável";
      const typeLabel = d.type ? (DELIVERY_TYPE_OPTIONS.find(o => o.value === d.type)?.label ?? d.type) : "";
      const channelLabel = d.channel ? ` (${d.channel})` : "";
      const dateLabel = new Date(deliveredDate + "T00:00:00").toLocaleDateString("pt-BR");
      const description = `${typeLabel ? `${typeLabel} no ${platLabel}` : platLabel}${channelLabel}: R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} - ${dateLabel}`;

      // Localiza cobrança-pai da tarefa (se já existir) para linkar como sub-item.
      const { data: parentCharge } = await supabase
        .from("charges")
        .select("id")
        .eq("task_id", persistedTaskId)
        .is("parent_charge_id", null)
        .is("deliverable_id", null)
        .maybeSingle();

      const { error } = await supabase.from("charges").insert({
        organization_id: profile.organization_id,
        project_id: resolvedProjectId,
        task_id: persistedTaskId,
        client_id: resolvedClient,
        parent_charge_id: parentCharge?.id ?? null,
        deliverable_id: d.id,
        description,
        amount: value,
        status: "pending_invoice",
        due_date: deliveredDate,
        type: "income",
      });
      if (error) throw error;
      const next = deliverables.map(x => x.id === d.id ? { ...x, invoiced: true } : x);
      setDeliverables(next);
      const { error: upErr } = await supabase.from("tasks").update({ deliverables: next }).eq("id", persistedTaskId);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["charges"] });
      qc.invalidateQueries({ queryKey: ["project-charges"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Entregável lançado no Financeiro");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const [mode, setMode] = useState<"modal" | "docked" | "minimized">("modal");
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  useEffect(() => { if (task) setMode("modal"); }, [task?.id]);

  // Fechar com verificação de alterações não salvas.
  const requestClose = () => {
    if (dirty) { setUnsavedOpen(true); return; }
    onClose();
  };

  useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mode !== "minimized") { requestClose(); return; }
      // Ctrl/Cmd + S — salva
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty && !save.isPending) save.mutate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [task, mode, onClose, dirty, save.isPending]);

  // Modo docked: empurra o conteúdo principal via CSS var lida pelo AppShell.
  const DOCK_WIDTH = 640;
  useEffect(() => {
    const root = document.documentElement;
    if (task && mode === "docked") {
      root.style.setProperty("--dock-offset", `${DOCK_WIDTH + 24}px`);
    } else {
      root.style.setProperty("--dock-offset", "0px");
    }
    return () => { root.style.setProperty("--dock-offset", "0px"); };
  }, [task, mode]);

  // Índice da etapa atual — dinâmico se houver tipo, senão usa o enum antigo.
  const useDynamicStages = taskTypeId && typeStages.length > 0;
  const dynamicStageIndex = useDynamicStages
    ? Math.max(0, typeStages.findIndex(s => s.id === currentStageId))
    : -1;

  // Progresso automático: usa pesos das etapas quando há tipo, senão fallback.
  const computedProgress = useMemo(() => {
    const subDone = subtasks.filter(s => s.done).length;
    const subTotal = subtasks.length;
    if (useDynamicStages) {
      const totalWeight = typeStages.reduce((a, s) => a + s.weight, 0);
      const doneWeight = status === "done"
        ? totalWeight
        : typeStages.slice(0, dynamicStageIndex).reduce((a, s) => a + s.weight, 0);
      const denom = totalWeight + subTotal;
      if (denom === 0) return 0;
      return Math.round(((doneWeight + subDone) / denom) * 100);
    }
    const total = subTotal + STAGE_ORDER.length;
    if (total === 0) return 0;
    const stagesDone = status === "done" ? STAGE_ORDER.length : Math.max(0, STAGE_ORDER.indexOf(stage));
    return Math.round(((subDone + stagesDone) / total) * 100);
  }, [subtasks, stage, status, useDynamicStages, typeStages, dynamicStageIndex]);

  const lastProgressRef = useRef<number | null>(null);
  useEffect(() => {
    if (!task) return;
    if (lastProgressRef.current === computedProgress) return;
    lastProgressRef.current = computedProgress;
    if (progress !== computedProgress) setProgress(computedProgress);
    // Não marcamos dirty aqui: progresso é derivado das subtarefas/etapa,
    // que já chamam markDirty quando alteradas pelo usuário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedProgress, task?.id]);

  if (!task) return null;
  const overdue = dueDate && new Date(dueDate) < new Date() && status !== "done";
  const subtasksDone = subtasks.filter(s => s.done).length;
  const stagesTotal = useDynamicStages ? typeStages.length : STAGE_ORDER.length;
  const stagesDoneCount = useDynamicStages
    ? (status === "done" ? stagesTotal : dynamicStageIndex)
    : (status === "done" ? STAGE_ORDER.length : Math.max(0, STAGE_ORDER.indexOf(stage)));

  // Minimized pill
  if (mode === "minimized") {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-card border border-border shadow-lg pl-4 pr-2 py-2">
        <button onClick={() => setMode("modal")} className="text-sm font-medium max-w-[240px] truncate text-left">
          {title || "Tarefa"}
        </button>
        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => setMode("modal")} title="Restaurar">
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive" onClick={requestClose} title="Fechar">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  const shell = (
    <div
      className={cn(
        "fixed z-50 bg-card text-card-foreground border border-border shadow-2xl flex flex-col overflow-hidden",
        mode === "modal"
          ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-[1360px] h-[calc(100vh-3rem)] max-h-[900px] rounded-3xl"
          : "top-3 right-3 bottom-3 rounded-2xl"
      )}
      style={mode === "docked" ? { width: `min(calc(100vw - 1.5rem), ${DOCK_WIDTH}px)` } : undefined}
    >
            {/* Top bar */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-card">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono">#{task.id.slice(0, 6).toUpperCase()}</span>
                <TaskTypePicker
                  value={taskTypeId}
                  types={taskTypes}
                  variant="badge"
                  onChange={(id, t) => {
                    setTaskTypeId(id);
                    setCurrentStageId("");
                    if (t) {
                      if (!billingModel && t.default_billing_model) {
                        setBillingModel(t.default_billing_model as BillingModel);
                      }
                      if (!billingValue && t.default_price != null) {
                        setBillingValue(String(t.default_price));
                      }
                    }
                    markDirty();
                  }}
                />
                {dirty && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[10px] font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Alterações não salvas
                  </span>
                )}
              </div>

              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="sm"
                  className="rounded-full gap-1.5 h-8 px-3"
                  onClick={() => save.mutate()}
                  disabled={!dirty || save.isPending}
                  title="Salvar (Ctrl/Cmd + S)"
                >
                  <SaveIcon className="h-4 w-4" />
                  {save.isPending ? "Salvando…" : "Salvar"}
                </Button>
                <div className="mx-1 h-5 w-px bg-border" />
                <StatusPicker value={status} onChange={v => { setStatus(v); markDirty(); }} />
                <PriorityPicker value={priority} onChange={v => { setPriority(v); markDirty(); }} />
                <DatePicker
                  value={dueDate}
                  overdue={!!overdue}
                  onChange={v => { setDueDate(v); markDirty(); }}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive" onClick={() => removeTask.mutate()} title="Excluir">
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="mx-1 h-5 w-px bg-border" />
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => setMode("minimized")} title="Minimizar">
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setMode(mode === "docked" ? "modal" : "docked")}
                  title={mode === "docked" ? "Expandir" : "Encaixar na lateral"}
                >
                  {mode === "docked" ? <PanelLeftOpen className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={requestClose} title="Fechar">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Body — split em modal, coluna única em docked */}
            <div className={cn(
              "flex-1 min-h-0 grid grid-cols-1",
              mode === "modal" && "lg:grid-cols-[1fr_320px]",
            )}>
              {/* ---------- MAIN ---------- */}
              <div className={cn(
                "min-h-0 overflow-y-auto px-6 py-6 space-y-5",
                mode === "modal" && "border-r border-border",
              )}>
                <input
                  value={title}
                  onChange={e => { setTitle(e.target.value); markDirty(); }}
                  onBlur={() => title.trim() && title !== task.title && markDirty()}
                  placeholder="Título da tarefa"
                  className="w-full bg-transparent outline-none text-2xl font-semibold tracking-tight placeholder:text-muted-foreground/50"
                />

                {/* Propriedades — estilo ClickUp / Monday / Notion (inline, sem cards) */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <InlineField label="Status">
                    <StatusPicker value={status} onChange={v => { setStatus(v); markDirty(); }} inline />
                  </InlineField>
                  <InlineField label="Prioridade">
                    <PriorityPicker value={priority} onChange={v => { setPriority(v); markDirty(); }} inline />
                  </InlineField>
                  <InlineField label="Prazo">
                    <DueDatePicker
                      value={dueDate}
                      overdue={!!overdue}
                      onChange={v => { setDueDate(v); markDirty(); }}
                    />
                  </InlineField>
                  <InlineField label="Responsável">
                    <AssigneePicker
                      value={assigneeId}
                      members={teamMembers}
                      dueDate={dueDate}
                      onChange={v => {
                        setAssigneeId(v);
                        markDirty();
                        if (!v) return;
                        const m = costMembers.find(cm => cm.user_id === v);
                        if (!m) return;
                        const est = estimatedHours ? Number(estimatedHours) : null;
                        const s = suggestTaskCost(
                          {
                            cost_mode: m.cost_mode,
                            hourly_rate: m.hourly_rate,
                            monthly_salary: m.monthly_salary,
                            monthly_hours: m.monthly_hours,
                            default_task_rate: m.default_task_rate,
                            task_rate_overrides: m.task_rate_overrides ?? {},
                          },
                          { task_type_id: taskTypeId || null, estimated_hours: est }
                        );
                        if (!s) return;
                        setCostPrompt({
                          member: { id: m.id, name: m.name, cost_mode: m.cost_mode },
                          suggestion: s,
                          assigneeId: v,
                        });
                      }}
                    />
                  </InlineField>
                  <InlineField label="Progresso">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted transition-colors"
                          title="Calculado automaticamente"
                        >
                          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${computedProgress}%` }} />
                          </div>
                          <span className="tabular-nums">{computedProgress}%</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="p-3 w-64 rounded-xl">
                        <div className="text-xs font-semibold mb-2">Progresso automático</div>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          <li className="flex items-center justify-between">
                            <span>Etapas concluídas</span>
                            <span className="tabular-nums text-foreground">{stagesDoneCount} / {stagesTotal}</span>
                          </li>
                          <li className="flex items-center justify-between">
                            <span>Subtarefas feitas</span>
                            <span className="tabular-nums text-foreground">{subtasksDone} / {subtasks.length}</span>
                          </li>
                          <li className="flex items-center justify-between pt-1 border-t border-border mt-1">
                            <span>Total</span>
                            <span className="tabular-nums text-foreground font-semibold">{computedProgress}%</span>
                          </li>
                        </ul>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          O progresso é calculado a partir das etapas do fluxo e das subtarefas concluídas.
                        </p>
                      </PopoverContent>
                    </Popover>
                  </InlineField>
                  <InlineField label="Estimativa">
                    <div className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-muted transition-colors">
                      <Input
                        type="number" min={0} step={0.5}
                        value={estimatedHours}
                        onChange={e => { setEstimatedHours(e.target.value); markDirty(); }}
                        onBlur={() => markDirty()}
                        className="h-6 w-14 border-none bg-transparent p-0 text-xs text-right shadow-none focus-visible:ring-0"
                        placeholder="0"
                      />
                      <span className="text-muted-foreground">h</span>
                    </div>
                  </InlineField>
                </div>

                {/* Etapa da tarefa — workflow dinâmico (tipo) ou fluxo padrão */}
                <TaskStageSection
                  dynamicStages={useDynamicStages ? typeStages : null}
                  currentStageId={currentStageId}
                  stage={stage}
                  onDynamicChange={s => {
                    setCurrentStageId(s.id);
                    // Deriva o status macro da etapa
                    const nextStatus = s.status_group as TaskStatus;
                    setStatus(nextStatus);
                    // Injeta subtarefas automáticas da etapa (evita duplicar por título)
                    const auto = (s as any).auto_checklist as string[] | undefined;
                    let nextSubtasks = subtasks;
                    if (Array.isArray(auto) && auto.length) {
                      const existing = new Set(subtasks.map(x => x.title.trim().toLowerCase()));
                      const toAdd = auto
                        .map(t => t.trim())
                        .filter(t => t && !existing.has(t.toLowerCase()))
                        .map(title => ({
                          id: (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`),
                          title,
                          done: false,
                        }));
                      if (toAdd.length) {
                        nextSubtasks = [...subtasks, ...toAdd];
                        setSubtasks(nextSubtasks);
                        toast.success(`${toAdd.length} subtarefa(s) criadas por “${s.name}”`);
                      }
                    }
                    markDirty();
                  }}
                  onStageChange={v => { setStage(v); markDirty(); }}
                />




                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Descrição</label>
                  <Textarea
                    value={description}
                    onChange={e => { setDescription(e.target.value); markDirty(); }}
                    onBlur={() => markDirty()}
                    rows={5}
                    placeholder="Adicione contexto, briefing, links de referência..."
                    className="mt-2 rounded-xl resize-none"
                  />
                </div>

                <DeliverablesSection
                  deliverables={deliverables}
                  onChange={(next) => {
                    setDeliverables(next);
                    const legacyPlatform = next.map(d => d.platform).filter(Boolean).join(",");
                    setPlatform(legacyPlatform);
                    markDirty();
                  }}
                  onBill={(d) => billDeliverable.mutate(d)}
                  billingPending={billDeliverable.isPending}
                  canBill={invoiced && status !== "done"}
                  taskFinalized={status === "done"}
                  taskInvoiced={invoiced}
                  platformOptions={projectPlatforms ?? PLATFORM_OPTIONS}

                />



                {(() => {
                  const tt = taskTypes.find((t: any) => t.id === taskTypeId);
                  if (!tt?.has_broadcast) return null;
                  const KINDS: { value: "premiere" | "live" | "recorded"; label: string }[] = [
                    { value: "live", label: "Ao vivo" },
                    { value: "premiere", label: "Estreia" },
                    { value: "recorded", label: "Gravado" },
                  ];
                  return (
                    <div className="rounded-2xl border p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center">
                          <Radio className="h-4 w-4" />
                        </span>
                        <div>
                          <div className="text-sm font-semibold">Transmissão / Estreia</div>
                          <div className="text-[11px] text-muted-foreground">Registre quando foi gravado e quando vai ao ar.</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {KINDS.map(k => (
                          <button
                            key={k.value}
                            type="button"
                            onClick={() => { setBroadcastKind(k.value); markDirty(); }}
                            className={cn(
                              "h-8 rounded-full px-3 text-xs border transition-colors",
                              broadcastKind === k.value
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background hover:bg-muted",
                            )}
                          >
                            {k.label}
                          </button>
                        ))}
                        {broadcastKind && (
                          <button
                            type="button"
                            onClick={() => { setBroadcastKind(""); markDirty(); }}
                            className="h-8 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
                          >
                            Limpar
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <DateListEditor
                          label="Datas de gravação"
                          emptyHint="Nenhuma data de gravação"
                          dates={recordedDates}
                          onChange={next => { setRecordedDates(next); markDirty(); }}
                        />
                        <DateListEditor
                          label={broadcastKind === "live" ? "Datas de transmissão" : "Datas de estreia"}
                          emptyHint={broadcastKind === "live" ? "Nenhuma data de transmissão" : "Nenhuma data de estreia"}
                          helper="Cada data gera uma cobrança separada ao faturar."
                          dates={airedDates}
                          onChange={next => { setAiredDates(next); markDirty(); }}
                        />
                      </div>
                    </div>
                  );
                })()}

                <Tabs defaultValue="subtasks" className="w-full">
                  <TabsList className="rounded-full bg-primary p-1 dark:bg-primary">

                    <TabsTrigger value="subtasks" className="rounded-full gap-1.5 text-primary-foreground/80 dark:text-primary-foreground/90 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:data-[state=active]:bg-card dark:data-[state=active]:text-foreground"><ListChecks className="h-4 w-4" />Subtarefas</TabsTrigger>
                    <TabsTrigger value="uploads" className="rounded-full gap-1.5 text-primary-foreground/80 dark:text-primary-foreground/90 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:data-[state=active]:bg-card dark:data-[state=active]:text-foreground"><Paperclip className="h-4 w-4" />Anexos</TabsTrigger>
                    <TabsTrigger value="comments" className="rounded-full gap-1.5 text-primary-foreground/80 dark:text-primary-foreground/90 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:data-[state=active]:bg-card dark:data-[state=active]:text-foreground"><MessageSquare className="h-4 w-4" />Comentários</TabsTrigger>
                    <TabsTrigger value="activity" className="rounded-full gap-1.5 text-primary-foreground/80 dark:text-primary-foreground/90 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm dark:data-[state=active]:bg-card dark:data-[state=active]:text-foreground"><Activity className="h-4 w-4" />Atividade</TabsTrigger>
                  </TabsList>

                  <TabsContent value="subtasks" className="mt-4">
                    <Subtasks
                      items={subtasks}
                      onChange={next => { setSubtasks(next); markDirty(); }}
                    />
                  </TabsContent>

                  <TabsContent value="uploads" className="mt-4 space-y-3">
                    {deliverables.length === 0 ? (
                      <>
                        <Card className="rounded-2xl p-6 border-dashed border-2 text-center space-y-2">
                          <Paperclip className="h-6 w-6 mx-auto text-muted-foreground" />
                          <div className="text-sm font-medium">Arraste arquivos ou clique para enviar</div>
                          <div className="text-xs text-muted-foreground">PDF, PNG, JPG, MP4, PSD, AI — até 50 MB</div>
                          <Button variant="outline" size="sm" className="rounded-full mt-2">Selecionar arquivo</Button>
                        </Card>
                        <div className="text-xs text-muted-foreground">
                          Adicione entregáveis em <strong>Entregáveis</strong> (barra lateral) para separar os uploads por plataforma.
                        </div>
                      </>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {deliverables.map(d => (
                          <Card key={d.id} className="rounded-2xl p-4 border-dashed border-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {d.platform ? platformLabel(d.platform) : "Sem plataforma"}
                                {d.type ? ` · ${DELIVERY_TYPE_OPTIONS.find(o => o.value === d.type)?.label ?? d.type}` : ""}
                              </span>
                              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="text-center py-3 space-y-1">
                              <div className="text-sm font-medium">Arraste arquivos aqui</div>
                              <div className="text-[11px] text-muted-foreground">Entregáveis para {d.platform ? platformLabel(d.platform) : "este item"}</div>
                              <Button variant="outline" size="sm" className="rounded-full mt-2">Selecionar arquivo</Button>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>


                  <TabsContent value="comments" className="mt-4 space-y-3">
                    <Card className="rounded-2xl p-3">
                      <Textarea placeholder="Escreva um comentário… @mencione um membro" rows={2} className="rounded-xl border-none focus-visible:ring-0 resize-none" />
                      <div className="flex justify-end mt-2">
                        <Button size="sm" className="rounded-full">Comentar</Button>
                      </div>
                    </Card>
                    <div className="text-xs text-muted-foreground text-center py-6">Nenhum comentário ainda.</div>
                  </TabsContent>

                  <TabsContent value="activity" className="mt-4">
                    <ul className="space-y-3">
                      <li className="flex items-start gap-3">
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                        <div className="text-sm">
                          <div><strong>Você</strong> <span className="text-muted-foreground">criou a tarefa</span></div>
                          <div className="text-xs text-muted-foreground">
                            {task.created_at ? new Date(task.created_at).toLocaleString("pt-BR") : "agora"}
                          </div>
                        </div>
                      </li>
                    </ul>
                  </TabsContent>
                </Tabs>
              </div>

              {/* ---------- SIDEBAR (vira seção inline em docked) ---------- */}
              <aside className={cn(
                "min-h-0",
                mode === "modal"
                  ? "overflow-y-auto bg-muted/20 px-5 py-6 space-y-5"
                  : "border-t border-border px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-5 items-start",
              )}>
                <SidebarSection title="Vínculo">
                  <SidebarRow label="Projeto">
                    <Select
                      value={projectId || "none"}
                      onValueChange={v => {
                        const nv = v === "none" ? "" : v;
                        setProjectId(nv);
                        const proj = projectsList.find(p => p.id === nv);
                        const nextClient = proj?.client_id ?? clientId ?? "";
                        if (proj?.client_id) setClientId(proj.client_id);
                        markDirty();
                      }}
                    >
                      <SelectTrigger className="h-8 rounded-lg border-none bg-transparent hover:bg-muted/60 text-sm px-2 shadow-none">
                        <SelectValue placeholder="Avulsa" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem projeto (avulsa)</SelectItem>
                        {projectsList.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </SidebarRow>
                  <SidebarRow label="Cliente">
                    <Select
                      value={clientId || "none"}
                      onValueChange={v => {
                        const nv = v === "none" ? "" : v;
                        setClientId(nv);
                        markDirty();
                      }}
                    >
                      <SelectTrigger className="h-8 rounded-lg border-none bg-transparent hover:bg-muted/60 text-sm px-2 shadow-none">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {clientsList.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </SidebarRow>
                </SidebarSection>







                <div>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Faturamento</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">{billingEnabled ? "Ativado" : "Desligado"}</span>
                      <Switch
                        checked={billingEnabled}
                        onCheckedChange={v => { setBillingEnabled(v); markDirty(); }}
                      />
                    </div>
                  </div>
                  <div className={cn("rounded-xl bg-card border border-border divide-y divide-border transition-opacity", !billingEnabled && "opacity-50 pointer-events-none")}>
                    <SidebarRow label="Modelo">
                      <Select value={billingModel || "none"} onValueChange={v => { const nv = v === "none" ? "" : v; setBillingModel(nv as BillingModel | ""); markDirty(); }}>
                        <SelectTrigger className="h-8 rounded-lg border-none bg-transparent hover:bg-muted/60 text-sm px-2 shadow-none">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          <SelectItem value="per_task">Por tarefa</SelectItem>
                          <SelectItem value="hourly">Por hora</SelectItem>
                          <SelectItem value="one_time">Fixo</SelectItem>
                          <SelectItem value="package">Pacote</SelectItem>
                          <SelectItem value="monthly">Recorrente</SelectItem>
                        </SelectContent>
                      </Select>
                    </SidebarRow>
                    <SidebarRow label="Valor">
                      <div className="flex items-center gap-1.5 w-full">
                        <span className="text-xs text-muted-foreground">R$</span>
                        <Input
                          type="number" min={0} step={0.01}
                          value={billingValue}
                          onChange={e => { setBillingValue(e.target.value); markDirty(); }}
                          onBlur={() => markDirty()}
                          className="h-8 rounded-lg border-none bg-transparent hover:bg-muted/60 text-sm px-2 shadow-none focus-visible:ring-0"
                          placeholder="0,00"
                        />
                      </div>
                    </SidebarRow>
                    <div className="p-3 space-y-2">
                      <Button
                        className="w-full rounded-full gap-1.5"
                        disabled={!billingEnabled || !billingValue || Number(billingValue) <= 0 || bill.isPending || invoiced}
                        onClick={() => bill.mutate()}
                      >
                        {invoiced ? <><Check className="h-4 w-4" />Lançado no Financeiro</> : <><DollarSign className="h-4 w-4" />Faturar tarefa</>}
                      </Button>
                    </div>
                    <div className="pt-1">
                      <TaskTimer />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-2 px-1">
                    {billingEnabled
                      ? "Ative uma tarefa como faturável, defina o modelo e o valor, e lance no Financeiro."
                      : "Sem a chave ativada, a tarefa fica na sua lista mas não gera cobrança."}
                  </p>
                </div>
              </aside>
            </div>
    </div>
  );

  return (
    <>
      {mode === "modal" && (
        <div className="fixed inset-0 z-40 bg-black/50 animate-in fade-in-0" onClick={requestClose} />
      )}
      {shell}
      <AlertDialog open={unsavedOpen} onOpenChange={setUnsavedOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem alterações nesta tarefa que ainda não foram salvas. O que deseja fazer?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setUnsavedOpen(false); setDirty(false); onClose(); }}
            >
              Sair sem salvar
            </AlertDialogAction>
            <AlertDialogAction
              onClick={async () => {
                setUnsavedOpen(false);
                try { await save.mutateAsync(); onClose(); } catch { /* toast já mostrado */ }
              }}
            >
              Salvar e sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {shell}
      {costPrompt && (
        <CostConfirmDialog
          open={!!costPrompt}
          onOpenChange={(v) => { if (!v) setCostPrompt(null); }}
          memberName={costPrompt.member.name}
          costMode={costPrompt.member.cost_mode}
          suggestion={costPrompt.suggestion}
          onSkip={() => setCostPrompt(null)}
          onConfirm={async ({ amount, hours, description }) => {
            try {
              const { data: proj } = await supabase.from("projects").select("organization_id").eq("id", projectId || "").maybeSingle();
              if (!projectId || !proj?.organization_id) {
                toast.error("Vincule a tarefa a um projeto antes de gerar custo.");
                setCostPrompt(null);
                return;
              }
              const { error } = await supabase.from("project_costs").insert({
                organization_id: proj.organization_id,
                project_id: projectId,
                task_id: task?.id.startsWith("draft-") ? null : task?.id ?? null,
                team_member_id: costPrompt.member.id,
                kind: costPrompt.suggestion.kind,
                amount,
                hours,
                description: description || null,
                status: costPrompt.member.cost_mode === "internal_fixed" ? "confirmed" : "pending",
              });
              if (error) throw error;
              toast.success("Custo registrado");
              qc.invalidateQueries({ queryKey: ["project-costs", projectId] });
            } catch (e: any) {
              toast.error(e.message ?? "Falha ao registrar custo");
            } finally {
              setCostPrompt(null);
            }
          }}
        />
      )}
    </>
  );
}

/* ---------- Inline field (estilo Notion / Monday / ClickUp) ---------- */
function InlineField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground whitespace-nowrap">{label}</span>
      {children}
    </div>
  );
}

const STAGE_ORDER: TaskStage[] = ["briefing", "creation", "review", "approval", "delivery"];
const STAGE_META: Record<TaskStage, { label: string; tone: "slate" | "blue" | "amber" | "emerald" | "purple" }> = {
  briefing: { label: "Briefing", tone: "slate" },
  creation: { label: "Criação", tone: "blue" },
  review:   { label: "Revisão", tone: "amber" },
  approval: { label: "Aprovação", tone: "purple" },
  delivery: { label: "Entrega", tone: "emerald" },
};
const TONE_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  slate:   { bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-400", border: "border-slate-500/20", dot: "bg-slate-500" },
  blue:    { bg: "bg-blue-500/10",  text: "text-blue-600 dark:text-blue-400",  border: "border-blue-500/20",  dot: "bg-blue-500" },
  amber:   { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20", dot: "bg-amber-500" },
  purple:  { bg: "bg-purple-500/10",text: "text-purple-600 dark:text-purple-400",border: "border-purple-500/20",dot: "bg-purple-500" },
  emerald: { bg: "bg-emerald-500/10",text: "text-emerald-600 dark:text-emerald-400",border: "border-emerald-500/20",dot: "bg-emerald-500" },
};

const PLATFORM_OPTIONS: { value: string; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "meta_ads", label: "Meta Ads" },
  { value: "google_ads", label: "Google Ads" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "site", label: "Site / Blog" },
];
const DELIVERY_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "post", label: "Post" },
  { value: "reels", label: "Reels" },
  { value: "story", label: "Story" },
  { value: "carrossel", label: "Carrossel" },
  { value: "video", label: "Vídeo" },
  { value: "arte", label: "Arte" },
  { value: "copy", label: "Copy" },
];

function parsePlatforms(v: string): string[] {
  return v ? v.split(",").map(s => s.trim()).filter(Boolean) : [];
}
function platformLabel(v: string) {
  return PLATFORM_OPTIONS.find(p => p.value === v)?.label ?? v;
}

function TaskStageSection({
  stage, onStageChange, dynamicStages, currentStageId, onDynamicChange,
}: {
  stage: TaskStage;
  onStageChange: (v: TaskStage) => void;
  dynamicStages: TaskTypeStageRow[] | null;
  currentStageId: string;
  onDynamicChange: (s: TaskTypeStageRow) => void;
}) {
  // Modo dinâmico — usa etapas configuradas do tipo
  if (dynamicStages && dynamicStages.length > 0) {
    const currentIdx = Math.max(0, dynamicStages.findIndex(s => s.id === currentStageId));
    return (
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Etapa da tarefa</span>
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {dynamicStages.map((s, i) => {
            const isCurrent = s.id === currentStageId;
            const isPast = i < currentIdx && !!currentStageId;
            return (
              <button
                key={s.id}
                onClick={() => onDynamicChange(s)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border",
                  isCurrent && "border-transparent text-white",
                  !isCurrent && !isPast && "border-transparent text-muted-foreground hover:bg-muted",
                  isPast && !isCurrent && "border-transparent text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
                )}
                style={isCurrent ? { backgroundColor: s.color } : undefined}
              >
                {isPast && !isCurrent ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: isCurrent ? "#fff" : s.color }} />
                )}
                {s.name}
                {i < dynamicStages.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          O status macro (a fazer / andamento / revisão / concluído) é atualizado automaticamente pela etapa.
        </p>
      </div>
    );
  }

  // Modo padrão (fallback quando não há tipo)
  const currentIndex = STAGE_ORDER.indexOf(stage);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Etapa da tarefa</span>
        <span className="ml-auto text-[10px] text-muted-foreground">Escolha um tipo para usar etapas personalizadas</span>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STAGE_ORDER.map((s, i) => {
          const meta = STAGE_META[s];
          const tone = TONE_STYLES[meta.tone];
          const isCurrent = s === stage;
          const isPast = i < currentIndex;
          return (
            <button
              key={s}
              onClick={() => onStageChange(s)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border",
                isCurrent && [tone.bg, tone.text, tone.border],
                !isCurrent && !isPast && "border-transparent text-muted-foreground hover:bg-muted",
                isPast && !isCurrent && "border-transparent text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
              )}
            >
              {isPast && !isCurrent ? (
                <Check className="h-3 w-3" />
              ) : (
                <span className={cn("h-1.5 w-1.5 rounded-full", isCurrent ? tone.dot : "bg-muted-foreground/50")} />
              )}
              {meta.label}
              {i < STAGE_ORDER.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Task type picker ---------- */
function TaskTypePicker({
  value, types, onChange, variant = "inline",
}: {
  value: string;
  types: TaskTypeRow[];
  variant?: "inline" | "badge";
  onChange: (id: string, type: TaskTypeRow | null) => void;
}) {
  const selected = types.find(t => t.id === value) ?? null;
  const color = selected?.color ?? "";
  return (
    <Popover>
      <PopoverTrigger asChild>
        {variant === "badge" ? (
          <button
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors"
            style={selected ? {
              backgroundColor: `${color}22`,
              color: color,
              borderColor: `${color}55`,
            } : undefined}
          >
            {selected ? (
              <>
                {selected.icon
                  ? <TaskTypeIcon name={selected.icon} className="h-3 w-3" />
                  : <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />}
                {selected.name}
              </>
            ) : (
              <span className="text-muted-foreground">Definir tipo</span>
            )}
          </button>
        ) : (
          <button className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted transition-colors">
            {selected ? (
              <>
                {selected.icon
                  ? <TaskTypeIcon name={selected.icon} className="h-3.5 w-3.5" color={color} />
                  : <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
                {selected.name}
              </>
            ) : (
              <span className="text-muted-foreground">Sem tipo</span>
            )}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="p-1 w-64 rounded-xl">
        <button
          onClick={() => onChange("", null)}
          className={cn("w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted", !value && "bg-muted/60")}
        >
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          <span className="text-muted-foreground">Sem tipo</span>
        </button>
        {types.length === 0 && (
          <div className="px-2 py-3 text-[11px] text-muted-foreground">
            Nenhum tipo configurado. Vá em Configurações → Tipos de Tarefa.
          </div>
        )}
        {types.map(t => (
          <button
            key={t.id}
            onClick={() => onChange(t.id, t)}
            className={cn("w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted", value === t.id && "bg-muted/60")}
          >
            <span
              className="h-5 w-5 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${t.color}22`, color: t.color }}
            >
              {t.icon
                ? <TaskTypeIcon name={t.icon} className="h-3 w-3" />
                : <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color }} />}
            </span>
            {t.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Platform multi-select ---------- */
function PlatformMultiSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const selected = parsePlatforms(value);
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v];
    onChange(next.join(","));
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="w-full flex items-center flex-wrap gap-1 rounded-lg px-2 py-1 min-h-[32px] text-xs hover:bg-muted/60 text-left">
          {selected.length === 0 && <span className="text-muted-foreground">—</span>}
          {selected.map(s => (
            <span key={s} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px]">
              {platformLabel(s)}
            </span>
          ))}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-1 w-52 rounded-xl">
        {PLATFORM_OPTIONS.map(opt => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className={cn(
                "w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted",
                active && "bg-muted/60",
              )}
            >
              <span className={cn(
                "h-4 w-4 rounded border flex items-center justify-center",
                active ? "bg-primary border-primary text-primary-foreground" : "border-border",
              )}>
                {active && <Check className="h-3 w-3" />}
              </span>
              {opt.label}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}


/* ---------- Deliverables (entregáveis por plataforma, cada um faturável) ---------- */
function DeliverablesSection({
  deliverables,
  onChange,
  onBill,
  billingPending,
  canBill,
  taskFinalized,
  taskInvoiced,
  platformOptions,
}: {
  deliverables: Deliverable[];
  onChange: (next: Deliverable[]) => void;
  onBill: (d: Deliverable) => void;
  billingPending: boolean;
  canBill: boolean;
  taskFinalized: boolean;
  taskInvoiced: boolean;
  platformOptions: { value: string; label: string; icon?: string | null; icon_url?: string | null; color?: string | null }[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const add = () => {
    const id = `d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    onChange([
      ...deliverables,
      {
        id,
        platform: "",
        type: "",
        billing_enabled: false,
        billing_model: null,
        billing_value: null,
      },
    ]);
    setExpandedId(id);
  };
  const update = (id: string, patch: Partial<Deliverable>) => {
    onChange(deliverables.map(d => (d.id === id ? { ...d, ...patch } : d)));
  };
  const remove = (id: string) => {
    onChange(deliverables.filter(d => d.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const totalBillable = deliverables
    .filter(d => d.billing_enabled && d.billing_value)
    .reduce((sum, d) => sum + (d.billing_value ?? 0), 0);

  const billHelper = taskFinalized
    ? "Tarefa finalizada — reabra para faturar novos entregáveis."
    : !taskInvoiced
      ? "Fature a tarefa principal antes para lançar entregáveis como sub-itens da mesma fatura."
      : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Entregáveis</span>
        <Button size="sm" variant="outline" className="h-7 rounded-full text-xs gap-1" onClick={add}>
          <Plus className="h-3.5 w-3.5" /> Adicionar entregável
        </Button>
      </div>

      {deliverables.length === 0 ? (
        <div className="rounded-xl bg-card border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          Nenhum entregável nesta tarefa. Adicione um para separar plataforma, canal, data de entrega, link e valor.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {deliverables.map((d, i) => {
            const isOpen = expandedId === d.id;
            const platOpt = d.platform ? platformOptions.find(o => o.value === d.platform) : undefined;
            const platLabel = platOpt?.label ?? (d.platform ? platformLabel(d.platform) : "");
            const typeLabel = d.type ? (DELIVERY_TYPE_OPTIONS.find(o => o.value === d.type)?.label ?? d.type) : "";
            const title = platLabel || `Entregável ${i + 1}`;

            if (!isOpen) {
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setExpandedId(d.id)}
                  className="text-left rounded-xl bg-card border border-border p-3 hover:border-primary/40 hover:shadow-sm transition-all group sm:col-span-1 col-span-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <IconPreview name={platOpt?.icon ?? null} color={platOpt?.color ?? null} iconUrl={platOpt?.icon_url ?? null} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">#{i + 1}</span>
                        {d.delivered ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 text-[10px] font-medium"><Check className="h-2.5 w-2.5" />Entregue</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-medium">Pendente</span>
                        )}
                        {d.invoiced && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-1.5 py-0.5 text-[10px] font-medium"><Check className="h-2.5 w-2.5" />Faturado</span>
                        )}
                        {d.billing_enabled && !d.invoiced && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium">Faturável</span>
                        )}
                      </div>
                      <div className="text-sm font-medium truncate">{title}</div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        {typeLabel && <span className="truncate">{typeLabel}</span>}
                        {d.channel && <span className="truncate">· {d.channel}</span>}
                        {d.delivered_date && <span>· {new Date(d.delivered_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {d.billing_enabled && d.billing_value != null && (
                        <div className="text-sm font-semibold">R$ {d.billing_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                      )}
                    </div>
                  </div>
                </button>
              );
            }

            return (
              <div key={d.id} className="rounded-xl bg-card border border-primary/40 p-3 space-y-2.5 sm:col-span-2 col-span-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <IconPreview name={platOpt?.icon ?? null} color={platOpt?.color ?? null} iconUrl={platOpt?.icon_url ?? null} size={28} />
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                      {platLabel || `Entregável ${i + 1}`}
                      {d.invoiced && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal"><Check className="h-2.5 w-2.5" />Faturado</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 rounded-full text-xs" onClick={() => setExpandedId(null)}>
                      Recolher
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6 rounded-full text-muted-foreground hover:text-destructive" onClick={() => remove(d.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Plataforma</label>
                    <Select value={d.platform || "none"} onValueChange={v => update(d.id, { platform: v === "none" ? "" : v })}>
                      <SelectTrigger className="h-8 rounded-lg text-xs mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {platformOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Tipo</label>
                    <Select value={d.type || "none"} onValueChange={v => update(d.id, { type: v === "none" ? "" : v })}>
                      <SelectTrigger className="h-8 rounded-lg text-xs mt-1"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {DELIVERY_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Canal</label>
                    <Input
                      value={d.channel ?? ""}
                      onChange={e => update(d.id, { channel: e.target.value || null })}
                      placeholder="Ex: @caritas"
                      className="h-8 rounded-lg text-xs mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase">Entregue em</label>
                    <Input
                      type="date"
                      value={d.delivered_date ?? ""}
                      onChange={e => update(d.id, { delivered_date: e.target.value || null })}
                      className="h-8 rounded-lg text-xs mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Link da entrega</label>
                  <Input
                    value={d.link ?? ""}
                    onChange={e => update(d.id, { link: e.target.value || null })}
                    placeholder="https://…"
                    className="h-8 rounded-lg text-xs mt-1"
                  />
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-border">
                  <span className="text-[11px] text-muted-foreground">Entregue</span>
                  <Button
                    size="sm"
                    variant={d.delivered ? "default" : "outline"}
                    className="h-7 rounded-full text-xs gap-1"
                    onClick={() => update(d.id, {
                      delivered: !d.delivered,
                      delivered_date: !d.delivered ? (d.delivered_date ?? new Date().toISOString().slice(0, 10)) : d.delivered_date,
                    })}
                  >
                    {d.delivered ? <><Check className="h-3.5 w-3.5" />Entregue</> : "Marcar como entregue"}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Faturar este entregável</span>
                  <Switch
                    checked={d.billing_enabled}
                    onCheckedChange={v => update(d.id, { billing_enabled: v })}
                  />
                </div>

                {d.billing_enabled && (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <Select
                        value={d.billing_model ?? "none"}
                        onValueChange={v => update(d.id, { billing_model: v === "none" ? null : (v as BillingModel) })}
                      >
                        <SelectTrigger className="h-8 rounded-lg text-xs">
                          <SelectValue placeholder="Modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          <SelectItem value="per_task">Por tarefa</SelectItem>
                          <SelectItem value="hourly">Por hora</SelectItem>
                          <SelectItem value="one_time">Fixo</SelectItem>
                          <SelectItem value="package">Pacote</SelectItem>
                          <SelectItem value="monthly">Recorrente</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-1 rounded-lg border border-border px-2 h-8">
                        <span className="text-[11px] text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={d.billing_value ?? ""}
                          onChange={e => update(d.id, { billing_value: e.target.value ? Number(e.target.value) : null })}
                          className="h-7 border-none bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                          placeholder="0,00"
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full rounded-full gap-1.5 h-8 text-xs"
                      disabled={!d.billing_value || d.billing_value <= 0 || billingPending || d.invoiced || !canBill || !d.delivered}
                      onClick={() => onBill(d)}
                      title={!d.delivered ? "Marque o entregável como entregue antes de faturar." : (billHelper ?? undefined)}
                    >
                      {d.invoiced ? <><Check className="h-3.5 w-3.5" />Lançado</> : <><DollarSign className="h-3.5 w-3.5" />Faturar entregável</>}
                    </Button>
                    {!d.delivered && !d.invoiced && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed">Marque como entregue para liberar o faturamento.</p>
                    )}
                    {d.delivered && billHelper && !d.invoiced && (
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{billHelper}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {totalBillable > 0 && (
            <div className="sm:col-span-2 rounded-xl bg-muted/40 px-3 py-2 text-xs flex items-center justify-between">
              <span className="text-muted-foreground">Total faturável</span>
              <span className="font-semibold">R$ {totalBillable.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* ---------- Sidebar helpers ---------- */
function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{title}</div>
      <div className="rounded-xl bg-card border border-border divide-y divide-border">
        {children}
      </div>
    </div>
  );
}
function SidebarRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 min-h-[40px]">
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}


/* ---------- Pickers ---------- */
function StatusPicker({ value, onChange, inline }: { value: TaskStatus; onChange: (v: TaskStatus) => void; inline?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            STATUS_META[value].color,
            inline && "w-full justify-start px-2 hover:opacity-80",
          )}
        >
          <Circle className={cn("h-2 w-2 fill-current", STATUS_META[value].dot.replace("bg-", "text-"))} />
          {STATUS_META[value].label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-1 w-44 rounded-xl">
        {STATUS_ORDER.map(s => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={cn("w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted", s === value && "bg-muted/60")}
          >
            <Circle className={cn("h-2 w-2 fill-current", STATUS_META[s].dot.replace("bg-", "text-"))} />
            {STATUS_META[s].label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
function PriorityPicker({ value, onChange, inline }: { value: TaskPriority; onChange: (v: TaskPriority) => void; inline?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            PRIORITY_META[value].badge,
            inline && "w-full justify-start px-2 hover:opacity-80",
          )}
        >
          <Flag className={cn("h-3 w-3", PRIORITY_META[value].color)} />
          {PRIORITY_META[value].label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-1 w-40 rounded-xl">
        {(["critical", "urgent", "high", "medium", "low"] as TaskPriority[]).map(p => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn("w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted", p === value && "bg-muted/60")}
          >
            <Flag className={cn("h-3.5 w-3.5", PRIORITY_META[p].color)} />
            {PRIORITY_META[p].label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
function DatePicker({ value, onChange, overdue, inline }: { value: string; onChange: (v: string) => void; overdue?: boolean; inline?: boolean }) {
  const label = value ? new Date(value + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : (inline ? "Sem prazo" : "Prazo");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            inline
              ? "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium cursor-pointer transition-colors hover:bg-muted"
              : "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors bg-muted text-foreground hover:bg-muted/70",
            overdue && (inline ? "text-red-600 dark:text-red-400" : "bg-red-500/15 text-red-600 dark:text-red-400"),
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-auto rounded-xl pointer-events-auto">
        <CalendarPicker
          mode="single"
          selected={value ? new Date(value + "T00:00:00") : undefined}
          onSelect={(d: Date | undefined) => {
            if (!d) { onChange(""); return; }
            const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            onChange(iso);
          }}
          initialFocus
          className="p-3 pointer-events-auto"
        />
        {value && (
          <div className="p-2 border-t border-border">
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => onChange("")}>Limpar</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function DueDatePicker(props: { value: string; onChange: (v: string) => void; overdue?: boolean }) {
  return <DatePicker {...props} inline />;
}

function DateListEditor({ label, dates, onChange, emptyHint, helper }: {
  label: string;
  dates: string[];
  onChange: (next: string[]) => void;
  emptyHint?: string;
  helper?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (v: string) => {
    if (!v) return;
    const d = v.slice(0, 10);
    if (dates.includes(d)) return;
    onChange([...dates, d].sort());
    setDraft("");
  };
  const remove = (d: string) => onChange(dates.filter(x => x !== d));
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</label>
      <div className="mt-1 space-y-2">
        {dates.length === 0 && emptyHint && (
          <div className="text-xs text-muted-foreground">{emptyHint}</div>
        )}
        {dates.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {dates.map(d => (
              <span key={d} className="inline-flex items-center gap-1 h-7 rounded-full border bg-background px-2 text-xs">
                {new Date(d + "T00:00:00").toLocaleDateString("pt-BR")}
                <button type="button" onClick={() => remove(d)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <DueDatePicker value={draft} onChange={v => add(v)} />
          </div>
        </div>
        {helper && <div className="text-[10px] text-muted-foreground">{helper}</div>}
      </div>
    </div>
  );
}

function AssigneePicker({ value, members, onChange, dueDate }: { value: string; members: { id: string; name: string; avatar_url: string | null }[]; onChange: (v: string) => void; dueDate?: string | null }) {
  const selected = members.find(m => m.id === value);
  const { data: blocks = [] } = useCalendarBlocks();
  const blockedById = useMemo(() => {
    const map = new Map<string, CalendarBlock>();
    if (!dueDate) return map;
    const d = dueDate.slice(0, 10);
    for (const b of blocks) {
      if (d >= b.start_date && d <= b.end_date) map.set(b.user_id, b);
    }
    return map;
  }, [blocks, dueDate]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted transition-colors">
          {selected ? (
            <>
              <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold inline-flex items-center justify-center">
                {selected.name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <span className="max-w-[120px] truncate">{selected.name}</span>
              {blockedById.has(selected.id) && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">· indisponível</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Atribuir</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-1 w-64 rounded-xl">
        <button
          onClick={() => onChange("")}
          className={cn("w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted", !value && "bg-muted/60")}
        >
          <span className="h-5 w-5 rounded-full bg-muted inline-flex" />
          <span className="text-muted-foreground">Sem responsável</span>
        </button>
        {members.map(m => {
          const block = blockedById.get(m.id);
          return (
            <button
              key={m.id}
              onClick={() => {
                if (block) {
                  const ok = confirm(`${m.name} está com ${BLOCK_META[block.kind].label.toLowerCase()} nesse prazo${block.reason ? ` (${block.reason})` : ""}. Atribuir mesmo assim?`);
                  if (!ok) return;
                }
                onChange(m.id);
              }}
              className={cn(
                "w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted",
                m.id === value && "bg-muted/60",
                block && "opacity-70",
              )}
              title={block ? `${BLOCK_META[block.kind].label}${block.reason ? " · " + block.reason : ""}` : undefined}
            >
              <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold inline-flex items-center justify-center">
                {m.name.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase()}
              </span>
              <span className="truncate flex-1 text-left">{m.name}</span>
              {block && (
                <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium border", BLOCK_META[block.kind].color)}>
                  <Lock className="h-2.5 w-2.5" />
                  {BLOCK_META[block.kind].label}
                </span>
              )}
            </button>
          );
        })}
        {members.length === 0 && (
          <div className="text-xs text-muted-foreground px-2 py-2">Sem membros cadastrados.</div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Subtasks (persistidas em jsonb) ---------- */
function Subtasks({ items, onChange }: { items: Subtask[]; onChange: (next: Subtask[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...items, { id: crypto.randomUUID(), title: t, done: false }]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <div className="text-xs text-muted-foreground py-3">Divida esta tarefa em passos menores. O progresso é calculado automaticamente.</div>
      )}
      <ul className="space-y-1">
        {items.map(i => (
          <li key={i.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 group">
            <input
              type="checkbox"
              checked={i.done}
              onChange={() => onChange(items.map(p => p.id === i.id ? { ...p, done: !p.done } : p))}
              className="accent-primary"
            />
            <span className={cn("flex-1 text-sm", i.done && "line-through text-muted-foreground")}>{i.title}</span>
            <button
              onClick={() => onChange(items.filter(p => p.id !== i.id))}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
            ><X className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") add(); }}
          placeholder="+ Nova subtarefa"
          className="rounded-lg h-9"
        />
        <Button size="sm" variant="outline" className="rounded-lg" onClick={add}>Adicionar</Button>
      </div>
    </div>
  );
}

/* ---------- Timer ---------- */
function TaskTimer() {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      iv.current = setInterval(() => setSeconds(s => s + 1), 1000);
    } else if (iv.current) {
      clearInterval(iv.current); iv.current = null;
    }
    return () => { if (iv.current) clearInterval(iv.current); };
  }, [running]);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  return (
    <Card className="rounded-xl p-3 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Timer className="h-3.5 w-3.5" /> Timer</div>
        <div className="font-mono text-sm tabular-nums">{fmt(seconds)}</div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {running ? (
          <Button size="sm" variant="outline" className="rounded-full gap-1 h-7 text-xs" onClick={() => setRunning(false)}><Pause className="h-3 w-3" />Pausar</Button>
        ) : (
          <Button size="sm" className="rounded-full gap-1 h-7 text-xs" onClick={() => setRunning(true)}><Play className="h-3 w-3" />Iniciar</Button>
        )}
        <Button size="sm" variant="ghost" className="rounded-full gap-1 h-7 text-xs" onClick={() => { setRunning(false); setSeconds(0); }}><Square className="h-3 w-3" />Parar</Button>
      </div>
    </Card>
  );
}
