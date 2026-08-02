import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,


  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns,
  Folder,
  FolderOpen,
  LayoutGrid,
  List,
  ListChecks,
  MoreHorizontal,
  PauseCircle,
  Plus,
  Search,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { NewProjectWizard, type ProjectWizardValue } from "@/components/new-project-wizard";
import {
  ProjectPreviewSheet,
  type ProjectPreviewData,
  type ProjectPreviewStatus,
} from "@/components/project-preview-sheet";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import "@/prj01.css";

export const Route = createFileRoute("/_authenticated/projects/")({
  validateSearch: (s: { new?: number | string }) => ({
    new: s.new === 1 || s.new === "1" ? (1 as const) : undefined,
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
  project_type: string | null;
  billing_model: string | null;
  urgency: string | null;
  fixed_value: number | null;
  monthly_value: number | null;
  created_at: string;
};

type Client = { id: string; name: string };
type Member = { user_id: string; name: string; avatar: string | null };

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

const PAGE_SIZES = [8, 12, 24, 48];

function ProjectsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const searchParams = Route.useSearch();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState<"cards" | "list" | "kanban">("cards");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
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
          "id,name,description,status,client_id,start_date,end_date,project_type,billing_model,urgency,fixed_value,monthly_value,created_at",
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

  const { data: membersByProject = {} } = useQuery<Record<string, Member[]>>({
    queryKey: ["project-members-min"],
    queryFn: async () => {
      const { data: rows, error } = await supabase.from("project_members").select("project_id,user_id");
      if (error) throw error;
      const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
      const profiles = ids.length
        ? (await supabase.from("profiles").select("id,full_name,display_name,avatar_url").in("id", ids)).data ?? []
        : [];
      const byId = Object.fromEntries(
        profiles.map((p) => [p.id, { name: p.display_name || p.full_name || "—", avatar: p.avatar_url }]),
      );
      const out: Record<string, Member[]> = {};
      for (const row of rows ?? []) {
        const profile = byId[row.user_id];
        (out[row.project_id] ??= []).push({
          user_id: row.user_id,
          name: profile?.name ?? "—",
          avatar: profile?.avatar ?? null,
        });
      }
      return out;
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

  const clientById = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.name])), [clients]);

  const allMembers = useMemo(() => {
    const map = new Map<string, Member>();
    for (const list of Object.values(membersByProject)) for (const m of list) map.set(m.user_id, m);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [membersByProject]);

  const rows = useMemo<ProjectPreviewData[]>(
    () =>
      projects.map((project) => {
        const count = tasksAgg.counts[project.id] ?? { total: 0, overdue: 0, done: 0 };
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
          doneTasks: count.done,
          revenue: tasksAgg.projected[project.id] ?? 0,
          progress: count.total > 0 ? Math.round((count.done / count.total) * 100) : 0,
        } as ProjectPreviewData & { doneTasks: number };
      }),
    [projects, tasksAgg, clientById],
  );

  const filtered = useMemo(() => {
    let result = rows;
    const term = search.trim().toLowerCase();
    if (term) {
      result = result.filter((p) =>
        [p.name, p.description ?? "", p.clientName ?? ""].some((v) => v.toLowerCase().includes(term)),
      );
    }
    if (statusFilter !== "all") result = result.filter((p) => p.status === statusFilter);
    if (clientFilter !== "all") {
      const name = clientById[clientFilter];
      result = result.filter((p) => p.clientName === name);
    }
    if (ownerFilter !== "all") {
      result = result.filter((p) => (membersByProject[p.id] ?? []).some((m) => m.user_id === ownerFilter));
    }
    const sorted = [...result];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "deadline")
      sorted.sort((a, b) => (a.endDate ?? "9999").localeCompare(b.endDate ?? "9999"));
    if (sort === "revenue") sorted.sort((a, b) => b.revenue - a.revenue);
    return sorted;
  }, [rows, search, statusFilter, clientFilter, ownerFilter, sort, clientById, membersByProject]);

  useEffect(() => setPage(1), [search, statusFilter, clientFilter, ownerFilter, sort, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const kpis = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((p) => p.status === "active").length;
    const done = rows.filter((p) => p.status === "done").length;
    const paused = rows.filter((p) => p.status === "paused").length;
    const risk = rows.filter((p) => p.overdueTasks > 0 && p.status !== "done").length;
    return { total, active, done, paused, risk };
  }, [rows]);

  const selectedProject = rows.find((p) => p.id === selectedProjectId) ?? null;

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
      <div className="prj01 pb-8">
        {/* PAGE HEADER */}
        <div className="page-header">
          <div>
            <h1>Projetos</h1>
            <p>Acompanhe o andamento dos projetos, prazos, equipe e resultados em um só lugar.</p>
          </div>
          <div className="header-actions">
            <div className="view-switch">
              <button type="button" className={view === "cards" ? "active" : ""} onClick={() => setView("cards")}>
                <LayoutGrid /> Cards
              </button>
              <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
                <List /> Lista
              </button>
              <button type="button" className={view === "kanban" ? "active" : ""} onClick={() => setView("kanban")}>
                <Columns /> Kanban
              </button>
            </div>
            <button type="button" className="btn-primary" onClick={() => setNewOpen(true)}>
              <Plus /> Novo projeto
            </button>
          </div>
        </div>

        {/* KPI ROW */}
        <div className="kpi-row">
          <Kpi label="Total" value={kpis.total} sub={`${kpis.active} em andamento`} tone="neutral" icon={Folder} iconBg="#E8EFFE" iconColor="#2F6BEF" />
          <Kpi label="Ativos" value={kpis.active} sub={pct(kpis.active, kpis.total)} tone="neutral" icon={FolderOpen} iconBg="#E8EFFE" iconColor="#2F6BEF" />
          <Kpi label="Concluídos" value={kpis.done} sub={pct(kpis.done, kpis.total)} tone="up" icon={CheckCircle2} iconBg="#E6F7EF" iconColor="#1FA971" />
          <Kpi label="Pausados" value={kpis.paused} sub={pct(kpis.paused, kpis.total)} tone="neutral" icon={PauseCircle} iconBg="#FDF1E0" iconColor="#E0912E" />
          <Kpi label="Em risco" value={kpis.risk} sub={pct(kpis.risk, kpis.total)} tone="neutral" icon={AlertTriangle} iconBg="#FCE9E9" iconColor="#E14545" />
        </div>

        {/* FILTER ROW */}
        <div className="filter-row">
          <div className="search-input">
            <Search />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar projetos..." />
          </div>

          <div className="dropdown-pill">
            Status:
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Todos</option>
              {(Object.keys(STATUS_META) as ProjectStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>

          <div className="dropdown-pill">
            Cliente:
            <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
              <option value="all">Todos</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="dropdown-pill">
            Responsável:
            <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
              <option value="all">Todos</option>
              {allMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sort-control">
            <ArrowUpDown />
            Ordenar por:
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recent">Mais recentes</option>
              <option value="name">Nome</option>
              <option value="deadline">Prazo</option>
              <option value="revenue">Receita</option>
            </select>
          </div>
        </div>

        {/* CONTEÚDO */}
        {isLoading ? (
          <div className="grid-cards">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="card skeleton" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">Nenhum projeto encontrado. Ajuste os filtros ou crie um novo projeto.</div>
        ) : view === "cards" ? (
          <div className="grid-cards">
            {paged.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                members={membersByProject[project.id] ?? []}
                onOpen={() => setSelectedProjectId(project.id)}
              />
            ))}
          </div>
        ) : view === "list" ? (
          <ProjectTable rows={paged} membersByProject={membersByProject} onOpen={setSelectedProjectId} />
        ) : (
          <ProjectKanban rows={filtered} onOpen={setSelectedProjectId} />
        )}

        {/* FOOTER */}
        {view !== "kanban" && filtered.length > 0 && (
          <div className="list-footer">
            <span className="showing">
              Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} de{" "}
              {filtered.length} projetos
            </span>
            <div className="pagination">
              <button type="button" className="page-btn" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                <ChevronLeft />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1)
                .map((n, idx, arr) => (
                  <span key={n} className="pagination">
                    {idx > 0 && arr[idx - 1] !== n - 1 && <span className="page-btn dots">...</span>}
                    <button
                      type="button"
                      className={cn("page-btn", n === currentPage && "active")}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                ))}
              <button
                type="button"
                className="page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight />
              </button>
            </div>
            <div className="per-page">
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n} por página
                  </option>
                ))}
              </select>
            </div>
          </div>
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

/* ---------- Blocos (réplica PRJ-01) ---------- */

function Kpi({
  label,
  value,
  sub,
  tone,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: number;
  sub: string;
  tone: "up" | "down" | "neutral";
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <div className="kpi-icon" style={{ background: iconBg }}>
          <Icon style={{ color: iconColor }} />
        </div>
      </div>
      <span className="kpi-value">{value}</span>
      <span className={cn("kpi-sub", tone)}>{sub}</span>
    </div>
  );
}

function Avatars({ members }: { members: Member[] }) {
  const shown = members.slice(0, 3);
  const rest = members.length - shown.length;
  if (members.length === 0) {
    return (
      <div className="avatars">
        <div className="av more">
          <User style={{ width: 11, height: 11 }} />
        </div>
      </div>
    );
  }
  return (
    <div className="avatars">
      {shown.map((m) => (
        <div key={m.user_id} className="av" title={m.name}>
          {m.avatar ? <img src={m.avatar} alt={m.name} /> : initials(m.name)}
        </div>
      ))}
      {rest > 0 && <div className="av more">+{rest}</div>}
    </div>
  );
}

function ProjectCard({
  project,
  members,
  onOpen,
}: {
  project: ProjectPreviewData & { doneTasks?: number };
  members: Member[];
  onOpen: () => void;
}) {
  const health = healthOf(project);
  const due = dueInfo(project.endDate, project.status);
  const typeTag =
    project.projectType && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(project.projectType) ? project.projectType : null;

  return (
    <div className="card" role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => (e.key === "Enter" ? onOpen() : undefined)}>
      <div className="card-title">{project.name}</div>
      <div className="card-row1">
        <div className="client-tags">
          <User className="person-ic" />
          <span className="tag">{project.clientName || "Interno"}</span>
          {typeTag && <span className="tag">{typeTag}</span>}
        </div>
        <div className={cn("status", health.tone)}>
          <span className="dot" />
          {health.label}
        </div>
      </div>

      <div className="progress-row">
        <span className="pct-left">{project.progress}%</span>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${project.progress}%` }} />
        </div>
        <span className="pct-right">{project.progress}%</span>
      </div>

      <div className="meta-row">
        <div className={cn("meta", due.tone)}>
          <CalendarDays />
          {due.label}
        </div>
      </div>

      <div className="team-row">
        <Avatars members={members} />
        <div className="task-count">
          <ListChecks />
          {project.doneTasks ?? 0}/{project.totalTasks} tarefas
        </div>
      </div>

      {project.overdueTasks > 0 && (
        <div className="overdue-flag">
          <AlertTriangle />
          {project.overdueTasks} tarefa{project.overdueTasks > 1 ? "s" : ""} em atraso
        </div>
      )}

      <div className="divider" />
      <div className="fin-row">
        <span className="fin-label">Receita prevista</span>
        <div className="fin-value-wrap">
          <span className="fin-value">{formatMoney(project.revenue)}</span>
          <button type="button" className="more-btn" onClick={(e) => e.stopPropagation()}>
            ···
          </button>
        </div>
      </div>
    </div>
  );
}


function ProjectTable({
  rows,
  membersByProject,
  onOpen,
}: {
  rows: (ProjectPreviewData & { doneTasks?: number })[];
  membersByProject: Record<string, Member[]>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border text-left text-[11.5px] text-muted-foreground">
            <th className="px-4 py-3 font-medium">Projeto</th>
            <th className="px-4 py-3 font-medium">Cliente</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Progresso</th>
            <th className="px-4 py-3 font-medium">Prazo final</th>
            <th className="px-4 py-3 font-medium">Equipe</th>
            <th className="px-4 py-3 text-right font-medium">Receita prevista</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((project) => {
            const due = dueInfo(project.endDate, project.status);
            return (
              <tr
                key={project.id}
                onClick={() => onOpen(project.id)}
                className="cursor-pointer border-b border-border/60 transition last:border-0 hover:bg-muted/50"
              >
                <td className="px-4 py-3 font-medium">{project.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{project.clientName || "Interno"}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "rounded-md px-2 py-1 text-[11px] font-medium",
                      STATUS_META[project.status].className,
                    )}
                  >
                    {STATUS_META[project.status].label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span className="text-[12px]">{project.progress}%</span>
                    <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-[#1769F6]" style={{ width: `${project.progress}%` }} />
                    </span>
                  </span>
                </td>
                <td className={cn("px-4 py-3 text-[12px]", due.className)}>{due.label}</td>
                <td className="px-4 py-3">
                  <Avatars members={membersByProject[project.id] ?? []} />
                </td>
                <td className="px-4 py-3 text-right font-semibold">{formatMoney(project.revenue)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProjectKanban({
  rows,
  onOpen,
}: {
  rows: ProjectPreviewData[];
  onOpen: (id: string) => void;
}) {
  const columns = Object.keys(STATUS_META) as ProjectStatus[];
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {columns.map((status) => {
        const list = rows.filter((p) => p.status === status);
        return (
          <div key={status} className="rounded-xl border border-border bg-card p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[12.5px] font-semibold">{STATUS_META[status].label}</span>
              <span className="text-[11.5px] text-muted-foreground">{list.length}</span>
            </div>
            <div className="space-y-2">
              {list.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => onOpen(project.id)}
                  className="w-full rounded-lg border border-border bg-background p-3 text-left transition hover:border-[#1769F6]/40"
                >
                  <p className="truncate text-[13px] font-medium">{project.name}</p>
                  <p className="mt-1 truncate text-[11.5px] text-muted-foreground">{project.clientName || "Interno"}</p>
                  <p className="mt-2 text-[11.5px] font-semibold">{formatMoney(project.revenue)}</p>
                </button>
              ))}
              {list.length === 0 && <p className="py-4 text-center text-[11.5px] text-muted-foreground">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PagerButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-muted disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/* ---------- Utils ---------- */

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

function pct(value: number, total: number) {
  if (!total) return "0% do total";
  return `${((value / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do total`;
}

function healthOf(project: ProjectPreviewData) {
  if (project.status === "done")
    return { label: "Concluído", tone: "healthy", dot: "bg-emerald-500", text: "text-muted-foreground" };
  if (project.overdueTasks >= 3)
    return { label: "Crítico", tone: "danger", dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" };
  if (project.overdueTasks > 0)
    return { label: "Atenção", tone: "warning", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" };
  return { label: "Saudável", tone: "healthy", dot: "bg-emerald-500", text: "text-muted-foreground" };
}

function dueInfo(endDate: string | null, status: ProjectStatus) {
  if (!endDate) return { label: "Sem prazo definido", tone: "", className: "text-muted-foreground" };
  const date = parseDate(endDate);
  const formatted = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  if (status === "done") return { label: `Concluído em ${formatted}`, tone: "done", className: "text-muted-foreground" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days < 0)
    return { label: `Venceu há ${Math.abs(days)} dias (${formatted})`, tone: "overdue", className: "text-rose-600 dark:text-rose-400" };
  if (days <= 7)
    return { label: `Vence em ${days} dias (${formatted})`, tone: "warning", className: "text-amber-600 dark:text-amber-400" };
  return { label: `Vence em ${days} dias (${formatted})`, tone: "", className: "text-muted-foreground" };
}


function parseDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? new Date(+match[1], +match[2] - 1, +match[3]) : new Date(value);
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

