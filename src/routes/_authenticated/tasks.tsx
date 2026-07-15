import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, LayoutGrid, List as ListIcon, Play, Pause, Square, Clock, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

type TaskStatus = "todo" | "in_progress" | "review" | "done";
type TaskPriority = "low" | "medium" | "high";
type BillingModel = "hourly" | "one_time" | "package" | "monthly";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  project_id: string | null;
  assignee_id: string | null;
  due_date: string | null;
  billing_model: BillingModel | null;
  billing_value: number | null;
  progress: number;
  platform: string | null;
  delivery_type: string | null;
  estimated_hours: number | null;
};

const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: "A fazer", color: "bg-muted text-muted-foreground" },
  in_progress: { label: "Em andamento", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  review: { label: "Revisão", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  done: { label: "Concluída", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
};
const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "review", "done"];

const PRIORITY_META: Record<TaskPriority, { label: string; dot: string; badge: string }> = {
  low: { label: "Baixa", dot: "bg-muted-foreground/40", badge: "bg-muted text-muted-foreground" },
  medium: { label: "Média", dot: "bg-amber-500", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  high: { label: "Alta", dot: "bg-red-500", badge: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

function TasksPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [view, setView] = useState<"list" | "kanban">("list");
  const [turbo, setTurbo] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("todo");
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium");
  const [quickTitle, setQuickTitle] = useState<Record<string, string>>({});

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,title,description,status,priority,project_id,assignee_id,due_date,billing_model,billing_value,progress,platform,delivery_type,estimated_hours")
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
    if (turbo) {
      arr = [...arr].sort((a, b) => (b.billing_value ?? 0) - (a.billing_value ?? 0));
    }
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
      const { error } = await supabase.from("tasks").insert({
        title: input.title,
        status: input.status,
        priority: input.priority ?? "medium",
        organization_id: profile.organization_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selected = tasks.find(t => t.id === selectedId) ?? null;

  const handleQuickCreate = (status: TaskStatus) => {
    const title = (quickTitle[status] ?? "").trim();
    if (!title) return;
    createTask.mutate({ title, status });
    setQuickTitle(p => ({ ...p, [status]: "" }));
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Tarefas</h1>
            <p className="text-sm text-muted-foreground">Lista, prioridades, timers e faturamento por tarefa.</p>
          </div>
          <Button
            className="rounded-full gap-1.5"
            onClick={() => createTask.mutate({ title: "Nova tarefa", status: "todo" })}
          >
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
                    <TaskRow key={t.id} task={t} onClick={() => setSelectedId(t.id)} />
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
                    <KanbanCard key={t.id} task={t} onClick={() => setSelectedId(t.id)} />
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

      <TaskDrawer task={selected} onClose={() => setSelectedId(null)} />
    </AppShell>
  );
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
        <span className={cn("h-2 w-2 rounded-full shrink-0", PRIORITY_META[task.priority].dot)} />
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

function TaskDrawer({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [dueDate, setDueDate] = useState<string>(task?.due_date ?? "");
  const [billingModel, setBillingModel] = useState<BillingModel | "">(task?.billing_model ?? "");
  const [billingValue, setBillingValue] = useState<string>(task?.billing_value?.toString() ?? "");

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setPriority(task.priority);
    setStatus(task.status);
    setDueDate(task.due_date ?? "");
    setBillingModel(task.billing_model ?? "");
    setBillingValue(task.billing_value?.toString() ?? "");
  }, [task]);

  const save = useMutation({
    mutationFn: async (patch: Partial<Task>) => {
      if (!task) return;
      const { error } = await supabase.from("tasks").update(patch).eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTask = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa excluída");
      onClose();
    },
  });

  const advanceStatus = (dir: 1 | -1) => {
    if (!task) return;
    const idx = STATUS_ORDER.indexOf(status);
    const next = STATUS_ORDER[Math.min(Math.max(idx + dir, 0), STATUS_ORDER.length - 1)];
    setStatus(next);
    save.mutate({ status: next });
  };

  return (
    <Sheet open={!!task} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {task && (
          <>
            <SheetHeader className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn("rounded-full", PRIORITY_META[priority].badge)}>{PRIORITY_META[priority].label}</Badge>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => advanceStatus(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Badge className={cn("rounded-full", STATUS_META[status].color)}>{STATUS_META[status].label}</Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={() => advanceStatus(1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
              <SheetTitle asChild>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={() => title !== task.title && save.mutate({ title })}
                  className="w-full bg-transparent outline-none text-xl font-semibold tracking-tight"
                />
              </SheetTitle>
            </SheetHeader>

            <Tabs defaultValue="details" className="mt-4">
              <TabsList className="grid grid-cols-4 rounded-full">
                <TabsTrigger value="details" className="rounded-full">Detalhes</TabsTrigger>
                <TabsTrigger value="uploads" className="rounded-full">Uploads</TabsTrigger>
                <TabsTrigger value="billing" className="rounded-full">Faturamento</TabsTrigger>
                <TabsTrigger value="activity" className="rounded-full">Atividade</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <Field label="Descrição">
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} onBlur={() => save.mutate({ description })} rows={3} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Prioridade">
                    <Select value={priority} onValueChange={v => { setPriority(v as TaskPriority); save.mutate({ priority: v as TaskPriority }); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Prazo">
                    <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} onBlur={() => save.mutate({ due_date: dueDate || null })} />
                  </Field>
                </div>
              </TabsContent>

              <TabsContent value="uploads" className="space-y-3 mt-4">
                <div className="text-sm text-muted-foreground">
                  Uploads de plataforma serão configurados por tarefa quando o módulo de Plataformas for ligado (Configurações → Plataformas).
                </div>
                <Card className="rounded-2xl p-4 border-dashed">
                  <div className="text-sm">Nenhuma plataforma vinculada.</div>
                  <Button variant="outline" size="sm" className="mt-2 rounded-full"><Plus className="h-4 w-4 mr-1" />Adicionar plataforma</Button>
                </Card>
              </TabsContent>

              <TabsContent value="billing" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Modelo">
                    <Select value={billingModel} onValueChange={v => { setBillingModel(v as BillingModel); save.mutate({ billing_model: v as BillingModel }); }}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Por hora</SelectItem>
                        <SelectItem value="one_time">Fixo</SelectItem>
                        <SelectItem value="package">Pacote</SelectItem>
                        <SelectItem value="monthly">Recorrente</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Valor (R$)">
                    <Input
                      type="number"
                      value={billingValue}
                      onChange={e => setBillingValue(e.target.value)}
                      onBlur={() => save.mutate({ billing_value: billingValue ? Number(billingValue) : null })}
                    />
                  </Field>
                </div>
                <TaskTimer />
              </TabsContent>

              <TabsContent value="activity" className="space-y-3 mt-4">
                <Card className="rounded-2xl p-4 space-y-3">
                  <div className="flex items-start gap-3 text-sm">
                    <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <div><strong>Você</strong> <span className="text-muted-foreground">criou a tarefa</span></div>
                      <div className="text-xs text-muted-foreground">agora</div>
                    </div>
                  </div>
                </Card>
                <Textarea placeholder="Comentar… @mencionar" rows={2} />
                <div className="flex justify-end">
                  <Button size="sm" className="rounded-full">Enviar</Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-8 border-t border-border pt-4 flex items-center justify-between">
              <Button variant="ghost" className="text-destructive" size="sm" onClick={() => removeTask.mutate()}>Excluir</Button>
              <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

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
    <Card className="rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> Timer</div>
        <div className="font-mono text-lg tabular-nums">{fmt(seconds)}</div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {running ? (
          <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => setRunning(false)}><Pause className="h-4 w-4" />Pausar</Button>
        ) : (
          <Button size="sm" className="rounded-full gap-1.5" onClick={() => setRunning(true)}><Play className="h-4 w-4" />Iniciar</Button>
        )}
        <Button size="sm" variant="ghost" className="rounded-full gap-1.5" onClick={() => { setRunning(false); setSeconds(0); }}><Square className="h-4 w-4" />Parar</Button>
      </div>
    </Card>
  );
}
