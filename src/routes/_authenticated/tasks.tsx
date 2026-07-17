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
import {
  Search, Plus, LayoutGrid, List as ListIcon, Play, Pause, Square, Clock, Zap,
  ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Flag, Circle,
  MessageSquare, Paperclip, ListChecks, Activity, Trash2, MoreHorizontal, Timer,
  DollarSign, Check, Minus, PanelRightOpen, Maximize2, PanelLeftOpen,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

type TaskStatus = "todo" | "in_progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high";
type BillingModel = "hourly" | "one_time" | "package" | "monthly" | "per_task";
type TaskStage = "briefing" | "creation" | "review" | "approval" | "delivery";

type Deliverable = {
  id: string;
  platform: string;
  type: string;
  billing_enabled: boolean;
  billing_model: BillingModel | null;
  billing_value: number | null;
  invoiced?: boolean;
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
  billing_model: BillingModel | null;
  billing_value: number | null;
  billing_enabled: boolean;
  progress: number;
  platform: string | null;
  delivery_type: string | null;
  estimated_hours: number | null;
  stage: TaskStage;
  deliverables: Deliverable[];
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
  low:    { label: "Baixa", color: "text-muted-foreground",                     badge: "bg-muted text-muted-foreground" },
  medium: { label: "Média", color: "text-amber-600 dark:text-amber-400",        badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  high:   { label: "Alta",  color: "text-red-600 dark:text-red-400",            badge: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

function TasksPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [view, setView] = useState<"list" | "kanban">("list");
  const [turbo, setTurbo] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftTask, setDraftTask] = useState<Task | null>(null);
  const [quickTitle, setQuickTitle] = useState<Record<string, string>>({});

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,description,status,priority,project_id,client_id,assignee_id,due_date,billing_model,billing_value,billing_enabled,progress,platform,delivery_type,estimated_hours,stage,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const filtered = useMemo(() => {
    let arr = tasks;
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter(t => t.title.toLowerCase().includes(s));
    }
    if (priorityFilter !== "all") arr = arr.filter(t => t.priority === priorityFilter);
    if (statusFilter !== "all") arr = arr.filter(t => t.status === statusFilter);
    if (turbo) arr = [...arr].sort((a, b) => (b.billing_value ?? 0) - (a.billing_value ?? 0));
    return arr;
  }, [tasks, search, priorityFilter, statusFilter, turbo]);

  const byStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], review: [], done: [] };
    for (const t of filtered) map[t.status].push(t);
    return map;
  }, [filtered]);

  const kpis = useMemo(() => {
    const total = tasks.length;
    const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done").length;
    const inProgress = tasks.filter(t => t.status === "in_progress").length;
    const value = tasks.reduce((s, t) => s + (t.billing_value ?? 0), 0);
    return { total, overdue, inProgress, value };
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
    setDraftTask(createLocalTask());
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
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Tarefas</h1>
            <p className="text-sm text-muted-foreground">Lista, prioridades, timers e faturamento por tarefa.</p>
          </div>
          <Button className="rounded-full gap-1.5" onClick={handleNew} disabled={createTask.isPending}>
            <Plus className="h-4 w-4" /> Nova tarefa
          </Button>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Total" value={kpis.total.toString()} />
          <Kpi label="Em andamento" value={kpis.inProgress.toString()} />
          <Kpi label="Atrasadas" value={kpis.overdue.toString()} tone={kpis.overdue > 0 ? "danger" : "default"} />
          <Kpi label="Valor total" value={`R$ ${kpis.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
        </div>

        <Card className="p-3 rounded-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar tarefa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-full" />
            </div>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px] rounded-full"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas prioridades</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="low">Baixa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] rounded-full"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant={turbo ? "default" : "outline"}
              size="sm"
              className="rounded-full gap-1.5"
              onClick={() => setTurbo(t => !t)}
              title="Ordenar por valor decrescente"
            >
              <Zap className="h-4 w-4" /> Turbo
            </Button>
            <div className="ml-auto flex items-center rounded-full border border-border p-1 bg-card">
              <button
                onClick={() => setView("list")}
                className={cn("grid h-8 w-8 place-items-center rounded-full", view === "list" && "bg-primary text-primary-foreground")}
                title="Lista"
              ><ListIcon className="h-4 w-4" /></button>
              <button
                onClick={() => setView("kanban")}
                className={cn("grid h-8 w-8 place-items-center rounded-full", view === "kanban" && "bg-primary text-primary-foreground")}
                title="Kanban"
              ><LayoutGrid className="h-4 w-4" /></button>
            </div>
          </div>
        </Card>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : view === "list" ? (
          <div className="space-y-4">
            {STATUS_ORDER.map(status => (
              <Card key={status} className="rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Badge className={cn("rounded-full", STATUS_META[status].color)}>{STATUS_META[status].label}</Badge>
                    <span className="text-sm text-muted-foreground">{byStatus[status].length}</span>
                  </div>
                </div>
                <ul className="divide-y divide-border">
                  {byStatus[status].map(t => (
                    <TaskRow key={t.id} task={t} onClick={() => { setDraftTask(null); setSelectedId(t.id); }} />
                  ))}
                  <li className="px-4 py-2">
                    <input
                      value={quickTitle[status] ?? ""}
                      onChange={e => setQuickTitle(p => ({ ...p, [status]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") handleQuickCreate(status); }}
                      placeholder="+ Digite e pressione Enter para criar..."
                      className="w-full bg-transparent outline-none text-sm placeholder:text-muted-foreground py-1"
                    />
                  </li>
                </ul>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {STATUS_ORDER.map(status => (
              <Card key={status} className="rounded-2xl p-3 flex flex-col gap-2 min-h-[320px] bg-muted/30">
                <div className="flex items-center justify-between px-1">
                  <Badge className={cn("rounded-full", STATUS_META[status].color)}>{STATUS_META[status].label}</Badge>
                  <span className="text-xs text-muted-foreground">{byStatus[status].length}</span>
                </div>
                <div className="space-y-2">
                  {byStatus[status].map(t => (
                    <KanbanCard key={t.id} task={t} onClick={() => { setDraftTask(null); setSelectedId(t.id); }} />
                  ))}
                </div>
                <input
                  value={quickTitle[status] ?? ""}
                  onChange={e => setQuickTitle(p => ({ ...p, [status]: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Enter") handleQuickCreate(status); }}
                  placeholder="+ Nova tarefa..."
                  className="mt-auto w-full bg-transparent outline-none text-xs placeholder:text-muted-foreground px-2 py-2 rounded-lg border border-dashed border-border"
                />
              </Card>
            ))}
          </div>
        )}
      </div>

      <TaskModal
        task={selected}
        onClose={handleCloseModal}
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

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
  return (
    <li>
      <button onClick={onClick} className="w-full text-left px-4 py-3 hover:bg-muted/40 flex items-center gap-3">
        <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_META[task.status].dot)} />
        <Flag className={cn("h-3.5 w-3.5 shrink-0", PRIORITY_META[task.priority].color)} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{task.title}</div>
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
  return (
    <button onClick={onClick} className="w-full text-left rounded-xl bg-card border border-border p-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium line-clamp-2">{task.title}</span>
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
  const persistedDraftIdRef = useRef<string | null>(null);
  const creatingDraftRef = useRef<Promise<string> | null>(null);

  const { data: projectsList = [] } = useQuery({
    queryKey: ["tasks-modal-projects"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id,name,client_id").order("name");
      return (data ?? []) as { id: string; name: string; client_id: string | null }[];
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
  }, [task]);

  const isLocalDraft = !!task?.id.startsWith("draft-");

  const buildInsertPayload = async (patch: Partial<Task>) => {
    const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
    if (!profile?.organization_id) throw new Error("Sem organização");
    return {
      organization_id: profile.organization_id,
      title: (patch.title ?? (title.trim() || "Nova tarefa")) as string,
      description: patch.description ?? (description || null),
      status: patch.status ?? status,
      priority: patch.priority ?? priority,
      project_id: patch.project_id ?? (projectId || null),
      client_id: patch.client_id ?? (clientId || null),
      due_date: patch.due_date ?? (dueDate || null),
      billing_model: patch.billing_model ?? ((billingModel || null) as BillingModel | null),
      billing_value: patch.billing_value ?? (billingValue ? Number(billingValue) : null),
      billing_enabled: patch.billing_enabled ?? billingEnabled,
      progress: patch.progress ?? progress,
      platform: patch.platform ?? (platform || null),
      delivery_type: patch.delivery_type ?? (deliveryType || null),
      estimated_hours: patch.estimated_hours ?? (estimatedHours ? Number(estimatedHours) : null),
      stage: patch.stage ?? stage,
    };
  };

  const createDraftRecord = async (patch: Partial<Task>) => {
    if (persistedDraftIdRef.current) return { id: persistedDraftIdRef.current, created: false };
    if (creatingDraftRef.current) return { id: await creatingDraftRef.current, created: false };

    creatingDraftRef.current = (async () => {
      const payload = await buildInsertPayload(patch);
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

  const save = useMutation({
    mutationFn: async (patch: Partial<Task>) => {
      if (!task) return;
      if (isLocalDraft) {
        const { id, created } = await createDraftRecord(patch);
        if (created) return;
        const { error } = await supabase.from("tasks").update(patch).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("tasks").update(patch).eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
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
  useEffect(() => { setInvoiced(false); }, [task?.id]);

  const bill = useMutation({
    mutationFn: async () => {
      if (!task) return;
      if (!billingEnabled) throw new Error("Ative a chave de faturamento nesta tarefa");
      const value = billingValue ? Number(billingValue) : 0;
      if (!value || value <= 0) throw new Error("Defina um valor de faturamento primeiro");
      const persistedTaskId = isLocalDraft ? (await createDraftRecord({})).id : task.id;
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const resolvedProjectId = projectId || task.project_id || null;
      let resolvedClient: string | null = clientId || task.client_id || null;
      if (!resolvedClient && resolvedProjectId) {
        const { data: proj } = await supabase.from("projects").select("client_id").eq("id", resolvedProjectId).maybeSingle();
        resolvedClient = (proj?.client_id as string) ?? null;
      }
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("charges").insert({
        organization_id: profile.organization_id,
        project_id: resolvedProjectId,
        task_id: persistedTaskId,
        client_id: resolvedClient,
        description: `Tarefa: ${title.trim() || task.title || "Nova tarefa"}`,
        amount: value,
        status: "pending",
        due_date: today,
        type: "income",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["charges"] });
      qc.invalidateQueries({ queryKey: ["project-charges"] });
      setInvoiced(true);
      toast.success("Tarefa lançada no Financeiro");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [mode, setMode] = useState<"modal" | "docked" | "minimized">("modal");
  useEffect(() => { if (task) setMode("modal"); }, [task?.id]);
  useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && mode !== "minimized") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [task, mode, onClose]);

  if (!task) return null;
  const overdue = dueDate && new Date(dueDate) < new Date() && status !== "done";

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
        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive" onClick={onClose} title="Fechar">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  const shell = (
    <div
      className={cn(
        "fixed z-50 bg-white border border-border shadow-2xl flex flex-col overflow-hidden",
        mode === "modal"
          ? "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-[1360px] h-[calc(100vh-3rem)] max-h-[900px] rounded-3xl"
          : "top-3 right-3 bottom-3 w-[calc(100vw-2rem)] sm:w-[560px] rounded-2xl"
      )}
    >
            {/* Top bar */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-white">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono">#{task.id.slice(0, 6).toUpperCase()}</span>
                <span>·</span>
                <span>Tarefa</span>
              </div>

              <div className="ml-auto flex items-center gap-1">
                <StatusPicker value={status} onChange={v => { setStatus(v); save.mutate({ status: v }); }} />
                <PriorityPicker value={priority} onChange={v => { setPriority(v); save.mutate({ priority: v }); }} />
                <DatePicker
                  value={dueDate}
                  overdue={!!overdue}
                  onChange={v => { setDueDate(v); save.mutate({ due_date: v || null }); }}
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
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={onClose} title="Fechar">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_320px]">
              {/* ---------- MAIN ---------- */}
              <div className="min-h-0 overflow-y-auto px-6 py-6 space-y-5 border-r border-border">
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={() => title.trim() && title !== task.title && save.mutate({ title: title.trim() })}
                  placeholder="Título da tarefa"
                  className="w-full bg-transparent outline-none text-2xl font-semibold tracking-tight placeholder:text-muted-foreground/50"
                />

                {/* Propriedades — estilo ClickUp / Monday / Notion (inline, sem cards) */}
                <div className="flex flex-wrap items-center gap-1">
                  <InlineField label="Status">
                    <StatusPicker value={status} onChange={v => { setStatus(v); save.mutate({ status: v }); }} inline />
                  </InlineField>
                  <InlineField label="Prioridade">
                    <PriorityPicker value={priority} onChange={v => { setPriority(v); save.mutate({ priority: v }); }} inline />
                  </InlineField>
                  <InlineField label="Prazo">
                    <DatePicker value={dueDate} overdue={!!overdue} onChange={v => { setDueDate(v); save.mutate({ due_date: v || null }); }} inline />
                  </InlineField>
                  <InlineField label="Progresso">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted transition-colors">
                          <div className="h-1.5 w-8 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="tabular-nums">{progress}%</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="p-3 w-56 rounded-xl">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Progresso</span>
                            <span className="tabular-nums">{progress}%</span>
                          </div>
                          <input
                            type="range" min={0} max={100} step={5}
                            value={progress}
                            onChange={e => setProgress(Number(e.target.value))}
                            onMouseUp={() => save.mutate({ progress })}
                            onTouchEnd={() => save.mutate({ progress })}
                            className="w-full accent-primary"
                          />
                        </div>
                      </PopoverContent>
                    </Popover>
                  </InlineField>
                  <InlineField label="Estimativa">
                    <div className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-muted transition-colors">
                      <Input
                        type="number" min={0} step={0.5}
                        value={estimatedHours}
                        onChange={e => setEstimatedHours(e.target.value)}
                        onBlur={() => save.mutate({ estimated_hours: estimatedHours ? Number(estimatedHours) : null })}
                        className="h-6 w-14 border-none bg-transparent p-0 text-xs text-right shadow-none focus-visible:ring-0"
                        placeholder="0"
                      />
                      <span className="text-muted-foreground">h</span>
                    </div>
                  </InlineField>
                </div>

                {/* Etapa da tarefa — workflow de produção */}
                <TaskStageSection
                  stage={stage}
                  onStageChange={v => { setStage(v); save.mutate({ stage: v }); }}
                />


                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Descrição</label>
                  <Textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    onBlur={() => save.mutate({ description })}
                    rows={5}
                    placeholder="Adicione contexto, briefing, links de referência..."
                    className="mt-2 rounded-xl resize-none"
                  />
                </div>


                <Tabs defaultValue="subtasks" className="w-full">
                  <TabsList className="rounded-full bg-muted/60">
                    <TabsTrigger value="subtasks" className="rounded-full gap-1.5"><ListChecks className="h-4 w-4" />Subtarefas</TabsTrigger>
                    <TabsTrigger value="uploads" className="rounded-full gap-1.5"><Paperclip className="h-4 w-4" />Anexos</TabsTrigger>
                    <TabsTrigger value="comments" className="rounded-full gap-1.5"><MessageSquare className="h-4 w-4" />Comentários</TabsTrigger>
                    <TabsTrigger value="activity" className="rounded-full gap-1.5"><Activity className="h-4 w-4" />Atividade</TabsTrigger>
                  </TabsList>

                  <TabsContent value="subtasks" className="mt-4">
                    <Subtasks />
                  </TabsContent>

                  <TabsContent value="uploads" className="mt-4 space-y-3">
                    {(() => {
                      const plats = parsePlatforms(platform);
                      if (plats.length === 0) {
                        return (
                          <>
                            <Card className="rounded-2xl p-6 border-dashed border-2 text-center space-y-2">
                              <Paperclip className="h-6 w-6 mx-auto text-muted-foreground" />
                              <div className="text-sm font-medium">Arraste arquivos ou clique para enviar</div>
                              <div className="text-xs text-muted-foreground">PDF, PNG, JPG, MP4, PSD, AI — até 50 MB</div>
                              <Button variant="outline" size="sm" className="rounded-full mt-2">Selecionar arquivo</Button>
                            </Card>
                            <div className="text-xs text-muted-foreground">
                              Selecione uma ou mais plataformas em <strong>Entrega</strong> para separar os uploads por canal.
                            </div>
                          </>
                        );
                      }
                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {plats.map(p => (
                            <Card key={p} className="rounded-2xl p-4 border-dashed border-2 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{platformLabel(p)}</span>
                                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <div className="text-center py-3 space-y-1">
                                <div className="text-sm font-medium">Arraste arquivos aqui</div>
                                <div className="text-[11px] text-muted-foreground">Entregáveis para {platformLabel(p)}</div>
                                <Button variant="outline" size="sm" className="rounded-full mt-2">Selecionar arquivo</Button>
                              </div>
                            </Card>
                          ))}
                        </div>
                      );
                    })()}
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

              {/* ---------- SIDEBAR ---------- */}
              <aside className="min-h-0 overflow-y-auto bg-muted/20 px-5 py-6 space-y-5">
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
                        save.mutate({ project_id: nv || null, client_id: (nextClient || null) as string | null });
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
                        save.mutate({ client_id: nv || null });
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

                <SidebarSection title="Entrega">
                  <SidebarRow label="Plataforma">
                    <PlatformMultiSelect
                      value={platform}
                      onChange={v => { setPlatform(v); save.mutate({ platform: v || null }); }}
                    />
                  </SidebarRow>
                  <SidebarRow label="Tipo">
                    <Select
                      value={deliveryType || "none"}
                      onValueChange={v => {
                        const nv = v === "none" ? "" : v;
                        setDeliveryType(nv);
                        save.mutate({ delivery_type: nv || null });
                      }}
                    >
                      <SelectTrigger className="h-8 rounded-lg border-none bg-transparent hover:bg-muted/60 text-sm px-2 shadow-none">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {DELIVERY_TYPE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
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
                        onCheckedChange={v => { setBillingEnabled(v); save.mutate({ billing_enabled: v }); }}
                      />
                    </div>
                  </div>
                  <div className={cn("rounded-xl bg-card border border-border divide-y divide-border transition-opacity", !billingEnabled && "opacity-50 pointer-events-none")}>
                    <SidebarRow label="Modelo">
                      <Select value={billingModel || "none"} onValueChange={v => { const nv = v === "none" ? "" : v; setBillingModel(nv as BillingModel | ""); save.mutate({ billing_model: (nv || null) as BillingModel | null }); }}>
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
                          onChange={e => setBillingValue(e.target.value)}
                          onBlur={() => save.mutate({ billing_value: billingValue ? Number(billingValue) : null })}
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
        <div className="fixed inset-0 z-40 bg-black/50 animate-in fade-in-0" onClick={onClose} />
      )}
      {shell}
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
  stage, onStageChange,
}: {
  stage: TaskStage;
  onStageChange: (v: TaskStage) => void;
}) {
  const currentIndex = STAGE_ORDER.indexOf(stage);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Etapa da tarefa</span>
      </div>

      {/* Timeline */}
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
                isPast && !isCurrent && "border-transparent text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
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

      <p className="text-[11px] text-muted-foreground">
        Avance a etapa para acompanhar onde a tarefa está no fluxo de produção.
      </p>
    </div>
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
        {(["high", "medium", "low"] as TaskPriority[]).map(p => (
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
  if (inline) {
    return (
      <label className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium cursor-pointer transition-colors hover:bg-muted",
        overdue && "text-red-600 dark:text-red-400",
      )}>
        <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
        {value ? new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "Sem prazo"}
        <input type="date" value={value} onChange={e => onChange(e.target.value)} className="sr-only" />
      </label>
    );
  }
  return (
    <label className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors bg-muted text-foreground hover:bg-muted/70",
      overdue && "bg-red-500/15 text-red-600 dark:text-red-400",
    )}>
      <CalendarIcon className="h-3.5 w-3.5" />
      {value ? new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "Prazo"}
      <input type="date" value={value} onChange={e => onChange(e.target.value)} className="sr-only" />
    </label>
  );
}

/* ---------- Subtasks (in-memory por enquanto) ---------- */
function Subtasks() {
  const [items, setItems] = useState<{ id: string; title: string; done: boolean }[]>([]);
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    setItems(prev => [...prev, { id: crypto.randomUUID(), title: t, done: false }]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <div className="text-xs text-muted-foreground py-3">Divida esta tarefa em passos menores.</div>
      )}
      <ul className="space-y-1">
        {items.map(i => (
          <li key={i.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50 group">
            <input
              type="checkbox"
              checked={i.done}
              onChange={() => setItems(prev => prev.map(p => p.id === i.id ? { ...p, done: !p.done } : p))}
              className="accent-primary"
            />
            <span className={cn("flex-1 text-sm", i.done && "line-through text-muted-foreground")}>{i.title}</span>
            <button
              onClick={() => setItems(prev => prev.filter(p => p.id !== i.id))}
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
