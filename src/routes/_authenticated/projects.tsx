import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Briefcase, Calendar, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects")({
  component: ProjectsPage,
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
  marketing_plan_id: string | null;
  created_at: string;
};
type Client = { id: string; name: string };

const STATUS_META: Record<ProjectStatus, { label: string; color: string }> = {
  planning: { label: "Planejamento", color: "bg-muted text-muted-foreground" },
  active:   { label: "Ativo",         color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  review:   { label: "Revisão",       color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  done:     { label: "Concluído",     color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  paused:   { label: "Pausado",       color: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

function ProjectsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [newOpen, setNewOpen] = useState(false);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,description,status,client_id,start_date,end_date,marketing_plan_id,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name").order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const { data: taskCounts = {} } = useQuery<Record<string, { total: number; overdue: number }>>({
    queryKey: ["projects-task-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("project_id,status,due_date");
      if (error) throw error;
      const acc: Record<string, { total: number; overdue: number }> = {};
      for (const t of data ?? []) {
        const pid = (t as { project_id: string | null }).project_id;
        if (!pid) continue;
        acc[pid] ??= { total: 0, overdue: 0 };
        acc[pid].total += 1;
        const row = t as { due_date: string | null; status: string };
        if (row.due_date && new Date(row.due_date) < new Date() && row.status !== "done") acc[pid].overdue += 1;
      }
      return acc;
    },
  });

  const clientById = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c.name])), [clients]);

  const filtered = useMemo(() => {
    let arr = projects;
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter(p => p.name.toLowerCase().includes(s) || (p.description ?? "").toLowerCase().includes(s));
    }
    if (statusFilter !== "all") arr = arr.filter(p => p.status === statusFilter);
    return arr;
  }, [projects, search, statusFilter]);

  const kpis = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(p => p.status === "active").length;
    const done = projects.filter(p => p.status === "done").length;
    const paused = projects.filter(p => p.status === "paused").length;
    return { total, active, done, paused };
  }, [projects]);

  const createProject = useMutation({
    mutationFn: async (input: {
      name: string; client_id: string | null; description: string; status: ProjectStatus;
      start_date: string | null; end_date: string | null;
    }) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await supabase.from("projects").insert({
        name: input.name,
        client_id: input.client_id,
        description: input.description || null,
        status: input.status,
        start_date: input.start_date,
        end_date: input.end_date,
        organization_id: profile.organization_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto criado");
      setNewOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Projetos</h1>
            <p className="text-sm text-muted-foreground">Do briefing à entrega — cada projeto com suas tarefas, calendário, tráfego e financeiro.</p>
          </div>
          <Button className="rounded-full gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> Novo projeto
          </Button>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Total" value={kpis.total.toString()} />
          <Kpi label="Ativos" value={kpis.active.toString()} />
          <Kpi label="Concluídos" value={kpis.done.toString()} />
          <Kpi label="Pausados" value={kpis.paused.toString()} tone={kpis.paused > 0 ? "warn" : "default"} />
        </div>

        <Card className="p-3 rounded-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar projeto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-full" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] rounded-full"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {(Object.keys(STATUS_META) as ProjectStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <Card className="rounded-3xl p-12 text-center border-dashed">
            <Briefcase className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <div className="font-medium">Nenhum projeto por aqui</div>
            <p className="text-sm text-muted-foreground mt-1">Crie seu primeiro projeto para começar a organizar entregas.</p>
            <Button className="rounded-full mt-4" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" />Novo projeto</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                clientName={p.client_id ? clientById[p.client_id] ?? "Cliente" : null}
                counts={taskCounts[p.id] ?? { total: 0, overdue: 0 }}
              />
            ))}
          </div>
        )}
      </div>

      <NewProjectDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        clients={clients}
        onCreate={(v) => createProject.mutate(v)}
        pending={createProject.isPending}
      />
    </>
  );
}

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warn" }) {
  return (
    <Card className="rounded-2xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tracking-tight", tone === "warn" && "text-amber-600 dark:text-amber-400")}>{value}</div>
    </Card>
  );
}

function ProjectCard({ project, clientName, counts }: { project: Project; clientName: string | null; counts: { total: number; overdue: number } }) {
  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";
  return (
    <Link to="/projects/$projectId" params={{ projectId: project.id }} className="block">
      <Card className="rounded-2xl p-5 hover:shadow-md transition-shadow h-full flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-base font-semibold truncate">{project.name}</div>
            {clientName && <div className="text-xs text-muted-foreground truncate">{clientName}</div>}
          </div>
          <Badge className={cn("rounded-full shrink-0", STATUS_META[project.status].color)}>
            {STATUS_META[project.status].label}
          </Badge>
        </div>

        {project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
          <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{fmt(project.start_date)} → {fmt(project.end_date)}</span>
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />{counts.total}
            </span>
            {counts.overdue > 0 && (
              <span className="text-red-600 dark:text-red-400 font-medium">{counts.overdue} atrasadas</span>
            )}
          </span>
        </div>
      </Card>
    </Link>
  );
}

function NewProjectDialog({
  open, onOpenChange, clients, onCreate, pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clients: Client[];
  onCreate: (v: { name: string; client_id: string | null; description: string; status: ProjectStatus; start_date: string | null; end_date: string | null }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState<string>("none");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const reset = () => {
    setName(""); setClientId("none"); setDescription("");
    setStatus("planning"); setStart(""); setEnd("");
  };

  return (
    <Dialog open={open} onOpenChange={v => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader><DialogTitle>Novo projeto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Nome">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Rebrand Bella Estética" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente">
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem cliente</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={v => setStatus(v as ProjectStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_META) as ProjectStatus[]).map(s => (
                    <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início"><Input type="date" value={start} onChange={e => setStart(e.target.value)} /></Field>
            <Field label="Prazo final"><Input type="date" value={end} onChange={e => setEnd(e.target.value)} /></Field>
          </div>
          <Field label="Descrição">
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Escopo, objetivo, entregáveis..." />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            className="rounded-full"
            disabled={!name.trim() || pending}
            onClick={() => onCreate({
              name: name.trim(),
              client_id: clientId === "none" ? null : clientId,
              description,
              status,
              start_date: start || null,
              end_date: end || null,
            })}
          >Criar projeto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
