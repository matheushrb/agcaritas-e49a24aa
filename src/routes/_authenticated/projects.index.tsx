import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FolderKanban,
  ListChecks,
  Plus,
  Search,
  SlidersHorizontal,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { NewProjectWizard, type ProjectWizardValue } from "@/components/new-project-wizard";
import {
  ProjectPreviewSheet,
  type ProjectPreviewData,
  type ProjectPreviewStatus,
} from "@/components/project-preview-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/")({
  validateSearch: (s: Record<string, unknown>) => ({
    new: s.new === 1 || s.new === "1" ? 1 : undefined,
  }),
  component: ProjectsPage,
});

type ProjectStatus = ProjectPreviewStatus;
type Project = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  client_id: string | null;
  start_date: string | null;
  end_date: string | null;
  marketing_plan_id: string | null;
  project_type: string | null;
  billing_model: string | null;
  urgency: string | null;
  fixed_value: number | null;
  monthly_value: number | null;
  created_at: string;
};
type Client = { id: string; name: string };

type TaskAgg = {
  counts: Record<string, { total: number; overdue: number; done: number }>;
  projected: Record<string, number>;
};

const STATUS_META: Record<ProjectStatus, { label: string; className: string }> = {
  planning: { label: "Planejamento", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  active: { label: "Ativo", className: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  review: { label: "Revisão", className: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  done: { label: "Concluído", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  paused: { label: "Pausado", className: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};

function ProjectsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const searchParams = Route.useSearch();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [newOpen, setNewOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.new) {
      setNewOpen(true);
      navigate({ to: "/projects", search: {}, replace: true });
    }
  }, [searchParams.new, navigate]);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id,name,description,status,client_id,start_date,end_date,marketing_plan_id,project_type,billing_model,urgency,fixed_value,monthly_value,created_at",
        )
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

  const { data: tasksAgg = { counts: {}, projected: {} } } = useQuery<TaskAgg>({
    queryKey: ["projects-tasks-agg"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("project_id,status,due_date,billing_enabled,billing_value,broadcast_kind,aired_dates,deliverables");
      if (error) throw error;

      const counts: TaskAgg["counts"] = {};
      const projected: TaskAgg["projected"] = {};
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const raw of data ?? []) {
        const row = raw as {
          project_id: string | null;
          due_date: string | null;
          status: string;
          billing_enabled: boolean | null;
          billing_value: number | null;
          broadcast_kind: string | null;
          aired_dates: string[] | null;
          deliverables: Array<{ billing_enabled?: boolean; billing_value?: number | null }> | null;
        };

        if (!row.project_id) continue;
        const pid = row.project_id;
        counts[pid] ??= { total: 0, overdue: 0, done: 0 };
        counts[pid].total += 1;
        if (row.status === "done") counts[pid].done += 1;
        if (row.due_date && new Date(row.due_date) < today && row.status !== "done") counts[pid].overdue += 1;

        const base = row.billing_enabled && row.billing_value != null ? Number(row.billing_value) : 0;
        const multiplier = row.broadcast_kind && (row.aired_dates?.length ?? 0) > 0 ? row.aired_dates!.length : 1;
        const deliverables = (row.deliverables ?? [])
          .filter((d) => d.billing_enabled && d.billing_value != null)
          .reduce((sum, d) => sum + Number(d.billing_value ?? 0), 0);

        projected[pid] = (projected[pid] ?? 0) + base * multiplier + deliverables;
      }

      return { counts, projected };
    },
  });

  const clientById = useMemo(() => Object.fromEntries(clients.map((client) => [client.id, client.name])), [clients]);

  const filtered = useMemo(() => {
    let result = projects;
    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter((project) => {
        const clientName = project.client_id ? clientById[project.client_id] ?? "" : "";
        return [project.name, project.description ?? "", clientName].some((value) => value.toLowerCase().includes(term));
      });
    }
    if (statusFilter !== "all") result = result.filter((project) => project.status === statusFilter);
    return result;
  }, [projects, search, statusFilter, clientById]);

  const stats = useMemo(() => {
    const active = projects.filter((p) => p.status === "active").length;
    const atRisk = projects.filter((p) => (tasksAgg.counts[p.id]?.overdue ?? 0) > 0 && p.status !== "done").length;
    const completed = projects.filter((p) => p.status === "done").length;
    const projectedRevenue = projects.reduce((sum, project) => sum + (tasksAgg.projected[project.id] ?? 0), 0);
    return { total: projects.length, active, atRisk, completed, projectedRevenue };
  }, [projects, tasksAgg]);

  const previewData = useMemo<ProjectPreviewData[]>(
    () =>
      projects.map((project) => {
        const count = tasksAgg.counts[project.id] ?? { total: 0, overdue: 0, done: 0 };
        const progress = count.total > 0 ? Math.round((count.done / count.total) * 100) : 0;
        return {
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          clientName: project.client_id ? clientById[project.client_id] ?? "Cliente" : null,
          startDate: project.start_date,
          endDate: project.end_date,
          projectType: project.project_type,
          urgency: project.urgency,
          billingModel: project.billing_model,
          fixedValue: project.fixed_value,
          monthlyValue: project.monthly_value,
          totalTasks: count.total,
          overdueTasks: count.overdue,
          revenue: tasksAgg.projected[project.id] ?? 0,
          progress,
        };
      }),
    [projects, tasksAgg, clientById],
  );

  const selectedProject = previewData.find((project) => project.id === selectedProjectId) ?? null;

  const createProject = useMutation({
    mutationFn: async (input: ProjectWizardValue) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");

      const { error } = await supabase.from("projects").insert({
        organization_id: profile.organization_id,
        name: input.name,
        client_id: input.client_id,
        description: input.description || null,
        status: "planning",
        start_date: input.start_date,
        end_date: input.end_date,
        project_type: input.project_type,
        billing_model: input.billing_model,
        fixed_value: input.fixed_value,
        urgency: input.urgency,
        scope_flags: { ...input.scope_flags, tools: input.tools } as any,
        traffic_budget: input.traffic_budget as any,
        other_budgets: input.other_budgets as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto criado");
      setNewOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <>
      <div className="space-y-5 pb-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Operação</p>
            <h1 className="text-[32px] font-semibold tracking-[-0.045em] text-foreground">Projetos</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Visão consolidada dos projetos, prazos, entregas, risco e receita prevista.
            </p>
          </div>

          <Button className="h-10 rounded-lg bg-[#3659E3] px-4 text-white hover:bg-[#2F50CE]" onClick={() => setNewOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo projeto
          </Button>
        </header>

        <section className="grid grid-cols-2 gap-2.5 xl:grid-cols-5">
          <SummaryCard label="Total de projetos" value={stats.total.toString()} icon={FolderKanban} />
          <SummaryCard label="Projetos ativos" value={stats.active.toString()} icon={ListChecks} />
          <SummaryCard label="Projetos em risco" value={stats.atRisk.toString()} icon={TriangleAlert} danger={stats.atRisk > 0} />
          <SummaryCard label="Concluídos" value={stats.completed.toString()} icon={CheckCircle2} />
          <SummaryCard label="Receita prevista" value={formatMoney(stats.projectedRevenue)} icon={CircleDollarSign} wide />
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-[0_8px_28px_rgba(15,23,42,0.035)] md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por projeto, cliente ou descrição..."
              className="h-10 rounded-lg border-border/80 bg-background pl-9 shadow-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtrar
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-[170px] rounded-lg border-border/80 bg-background shadow-none">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {(Object.keys(STATUS_META) as ProjectStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_META[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="h-[240px] animate-pulse rounded-xl border border-border/60 bg-card" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <section className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <FolderKanban className="mx-auto h-7 w-7 text-muted-foreground" />
            <h2 className="mt-4 text-sm font-semibold">Nenhum projeto encontrado</h2>
            <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros ou crie um novo projeto.</p>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => {
              const preview = previewData.find((item) => item.id === project.id)!;
              return (
                <ProjectCard
                  key={project.id}
                  project={preview}
                  onClick={() => setSelectedProjectId(project.id)}
                />
              );
            })}
          </section>
        )}
      </div>

      <ProjectPreviewSheet
        project={selectedProject}
        open={Boolean(selectedProject)}
        onOpenChange={(open) => {
          if (!open) setSelectedProjectId(null);
        }}
      />

      <NewProjectWizard
        open={newOpen}
        onOpenChange={setNewOpen}
        clients={clients}
        onCreate={(value) => createProject.mutate(value)}
        pending={createProject.isPending}
      />
    </>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  danger = false,
  wide = false,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  danger?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={cn("rounded-xl border border-border/80 bg-card p-4 shadow-[0_8px_24px_rgba(15,23,42,0.03)]", wide && "col-span-2 xl:col-span-1")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
          <div className={cn("mt-2 text-2xl font-semibold tracking-[-0.04em]", danger && "text-rose-600 dark:text-rose-400")}>{value}</div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9EDFC] text-[#3659E3] dark:bg-[#7E95F5]/10 dark:text-[#9FB0FF]">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project, onClick }: { project: ProjectPreviewData; onClick: () => void }) {
  const status = STATUS_META[project.status];

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[238px] w-full flex-col rounded-xl border border-border/80 bg-card p-5 text-left shadow-[0_8px_24px_rgba(15,23,42,0.035)] transition hover:-translate-y-0.5 hover:border-[#3659E3]/30 hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3659E3]/35"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">{project.clientName || "Projeto interno"}</p>
          <h2 className="mt-1 truncate text-[17px] font-semibold tracking-[-0.025em] text-foreground">{project.name}</h2>
        </div>
        <Badge className={cn("shrink-0 rounded-md border-0 px-2 py-1 text-[10px] font-medium", status.className)}>{status.label}</Badge>
      </div>

      <p className="mt-3 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
        {project.description || "Projeto sem descrição cadastrada."}
      </p>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Progresso</span>
          <span className="font-medium text-foreground">{project.progress}%</span>
        </div>
        <Progress value={project.progress} className="h-1.5 bg-muted" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-border/70 pt-4">
        <ProjectStat label="Tarefas" value={project.totalTasks.toString()} />
        <ProjectStat label="Atrasadas" value={project.overdueTasks.toString()} danger={project.overdueTasks > 0} />
        <ProjectStat label="Previsto" value={formatCompactMoney(project.revenue)} />
      </div>

      <div className="mt-auto flex items-center justify-between pt-4 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatShortDate(project.startDate)} — {formatShortDate(project.endDate)}
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-[#3659E3] opacity-0 transition-opacity group-hover:opacity-100 dark:text-[#9FB0FF]">
          Ver projeto <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </button>
  );
}

function ProjectStat({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <div className={cn("text-sm font-semibold tracking-[-0.02em]", danger && "text-rose-600 dark:text-rose-400")}>{value}</div>
      <div className="mt-0.5 text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatCompactMoney(value: number) {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function formatShortDate(value: string | null) {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match ? new Date(+match[1], +match[2] - 1, +match[3]) : new Date(value);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
