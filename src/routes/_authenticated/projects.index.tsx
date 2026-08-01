import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewProjectWizard, type ProjectWizardValue } from "@/components/new-project-wizard";
import {
  Search, Plus, Briefcase, Calendar, LayoutGrid, List, Columns,
  Folder, FolderOpen, CheckCircle2, PauseCircle, AlertTriangle, User, ListChecks, MoreHorizontal, ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/projects/")({
  validateSearch: (s: Record<string, unknown>) => ({
    new: s.new === 1 || s.new === "1" ? 1 : undefined,
  }),
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
type Charge = { id: string; project_id: string | null; amount: number };

const STATUS_META: Record<ProjectStatus, { label: string; color: string }> = {
  planning: { label: "Planejamento", color: "bg-muted text-muted-foreground" },
  active:   { label: "Ativo",         color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  review:   { label: "Revisão",       color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  done:     { label: "Concluído",     color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  paused:   { label: "Pausado",       color: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

function ProjectsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [sort, setSort] = useState<string>("recent");
  const [view, setView] = useState<"cards" | "list" | "kanban">("cards");
  const [newOpen, setNewOpen] = useState(false);

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

  const { data: membersByProject = {} } = useQuery<Record<string, Member[]>>({
    queryKey: ["projects-members"],
    queryFn: async () => {
      const [{ data: pm, error: e1 }, { data: profs, error: e2 }] = await Promise.all([
        supabase.from("project_members").select("project_id,user_id"),
        supabase.from("profiles").select("id,full_name,display_name,avatar_url"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const pById = Object.fromEntries(
        (profs ?? []).map(p => [p.id, { name: p.display_name || p.full_name || "Membro", avatar: p.avatar_url as string | null }]),
      );
      const map: Record<string, Member[]> = {};
      for (const row of pm ?? []) {
        const info = pById[row.user_id];
        (map[row.project_id] ??= []).push({
          user_id: row.user_id,
          name: info?.name ?? "Membro",
          avatar: info?.avatar ?? null,
        });
      }
      return map;
    },
  });


  const { data: tasksAgg = { counts: {}, projected: {} } } = useQuery<{
    counts: Record<string, { total: number; done: number; overdue: number }>;
    projected: Record<string, number>;
  }>({
    queryKey: ["projects-tasks-agg"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("project_id,status,due_date,billing_enabled,billing_value,broadcast_kind,aired_dates,deliverables");
      if (error) throw error;
      const counts: Record<string, { total: number; done: number; overdue: number }> = {};
      const projected: Record<string, number> = {};
      for (const t of data ?? []) {
        const row = t as {
          project_id: string | null; due_date: string | null; status: string;
          billing_enabled: boolean | null; billing_value: number | null;
          broadcast_kind: string | null; aired_dates: string[] | null;
          deliverables: Array<{ billing_enabled?: boolean; billing_value?: number | null }> | null;
        };
        const pid = row.project_id;
        if (!pid) continue;
        counts[pid] ??= { total: 0, done: 0, overdue: 0 };
        counts[pid].total += 1;
        if (row.status === "done") counts[pid].done += 1;
        if (row.due_date && new Date(row.due_date) < new Date() && row.status !== "done") counts[pid].overdue += 1;
        const base = row.billing_enabled && row.billing_value != null ? Number(row.billing_value) : 0;
        const mult = row.broadcast_kind && (row.aired_dates?.length ?? 0) > 0 ? row.aired_dates!.length : 1;
        const deliv = (row.deliverables ?? [])
          .filter(d => d.billing_enabled && d.billing_value != null)
          .reduce((s, d) => s + Number(d.billing_value ?? 0), 0);
        projected[pid] = (projected[pid] ?? 0) + base * mult + deliv;
      }
      return { counts, projected };
    },
  });
  const taskCounts = tasksAgg.counts;
  const revenueByProject = tasksAgg.projected;


  const clientById = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c.name])), [clients]);

  const allMembers = useMemo(() => {
    const map = new Map<string, Member>();
    for (const list of Object.values(membersByProject)) for (const m of list) map.set(m.user_id, m);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [membersByProject]);

  const filtered = useMemo(() => {
    let arr = projects;
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter(p => p.name.toLowerCase().includes(s) || (p.description ?? "").toLowerCase().includes(s));
    }
    if (statusFilter !== "all") arr = arr.filter(p => p.status === statusFilter);
    if (clientFilter !== "all") arr = arr.filter(p => p.client_id === clientFilter);
    if (ownerFilter !== "all") arr = arr.filter(p => (membersByProject[p.id] ?? []).some(m => m.user_id === ownerFilter));
    const rev = tasksAgg.projected;
    arr = [...arr].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
      if (sort === "deadline") return (a.end_date ?? "9999").localeCompare(b.end_date ?? "9999");
      if (sort === "revenue") return (rev[b.id] ?? 0) - (rev[a.id] ?? 0);
      return b.created_at.localeCompare(a.created_at);
    });
    return arr;
  }, [projects, search, statusFilter, clientFilter, ownerFilter, membersByProject, sort, tasksAgg.projected]);

  const kpis = useMemo(() => {
    const total = projects.length;
    const active = projects.filter(p => p.status === "active").length;
    const done = projects.filter(p => p.status === "done").length;
    const paused = projects.filter(p => p.status === "paused").length;
    const risk = projects.filter(p => (taskCounts[p.id]?.overdue ?? 0) > 0 && p.status !== "done").length;
    return { total, active, done, paused, risk };
  }, [projects, taskCounts]);


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
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="cv-page-head">
        <div>
          <h1>Projetos</h1>
          <p>Acompanhe o andamento dos projetos, prazos, equipe e resultados em um só lugar.</p>
        </div>
        <div className="cv-page-actions">
          <div className="cv-viewswitch">
            <button className={view === "cards" ? "active" : ""} onClick={() => setView("cards")}><LayoutGrid className="h-3.5 w-3.5" />Cards</button>
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><List className="h-3.5 w-3.5" />Lista</button>
            <button className={view === "kanban" ? "active" : ""} onClick={() => setView("kanban")}><Columns className="h-3.5 w-3.5" />Kanban</button>
          </div>
          <Button className="gap-1.5 rounded-[10px] h-9" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> Novo projeto
          </Button>
        </div>
      </div>

      <div className="cv-prj-kpis">
        <PrjKpi label="Total" value={kpis.total} sub={`${kpis.active} em andamento`} icon={<Folder className="h-4 w-4" />} />
        <PrjKpi label="Ativos" value={kpis.active} sub={pct(kpis.active, kpis.total)} tone="blue" icon={<FolderOpen className="h-4 w-4" />} />
        <PrjKpi label="Concluídos" value={kpis.done} sub={pct(kpis.done, kpis.total)} tone="green" icon={<CheckCircle2 className="h-4 w-4" />} />
        <PrjKpi label="Pausados" value={kpis.paused} sub={pct(kpis.paused, kpis.total)} tone="amber" icon={<PauseCircle className="h-4 w-4" />} />
        <PrjKpi label="Em risco" value={kpis.risk} sub={pct(kpis.risk, kpis.total)} tone="red" icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      <div className="cv-prj-filters">
        <div className="cv-field grow">
          <Search className="h-3.5 w-3.5 k" />
          <input placeholder="Buscar projetos..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <label className="cv-field">
          <span className="k">Status:</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Todos</option>
            {(Object.keys(STATUS_META) as ProjectStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </label>
        <label className="cv-field">
          <span className="k">Cliente:</span>
          <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
            <option value="all">Todos</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="cv-field">
          <span className="k">Responsável:</span>
          <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)}>
            <option value="all">Todos</option>
            {allMembers.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
          </select>
        </label>
        <label className="cv-field cv-field--sort">
          <ArrowUpDown className="h-3.5 w-3.5 k" />
          <span className="k">Ordenar por:</span>

          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="recent">Mais recentes</option>
            <option value="name">Nome</option>
            <option value="deadline">Prazo</option>
            <option value="revenue">Receita</option>
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="cv-empty">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="cv-empty">
          <Briefcase className="h-6 w-6 mx-auto mb-2" />
          Nenhum projeto por aqui. Crie o primeiro para começar a organizar as entregas.
        </div>
      ) : view === "cards" ? (
        <div className="cv-prj-grid">
          {filtered.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              clientName={p.client_id ? clientById[p.client_id] ?? "Cliente" : null}
              counts={taskCounts[p.id] ?? { total: 0, done: 0, overdue: 0 }}
              revenue={revenueByProject[p.id] ?? 0}
              members={membersByProject[p.id] ?? []}
            />
          ))}
        </div>
      ) : view === "list" ? (
        <div className="cv-card" style={{ padding: "6px 15px 10px" }}>
          <div className="cv-table">
            <div className="cv-table-row cv-table-head">
              <span>Projeto</span><span>Cliente</span><span>Prazo</span><span>Receita prevista</span>
            </div>
            {filtered.map(p => (
              <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }} className="cv-table-row">
                <span><b>{p.name}</b><small>{STATUS_META[p.status].label}</small></span>
                <span>{p.client_id ? clientById[p.client_id] ?? "—" : "—"}</span>
                <span>{deadlineText(p.end_date, taskCounts[p.id]?.overdue ?? 0).text}</span>
                <span><b>{money(revenueByProject[p.id] ?? 0)}</b></span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="cv-prj-grid" style={{ gridTemplateColumns: "repeat(5, minmax(0,1fr))", alignItems: "start" }}>
          {(Object.keys(STATUS_META) as ProjectStatus[]).map(s => (
            <div key={s} className="cv-card" style={{ padding: "12px 12px 14px", display: "grid", gap: 9 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
                {STATUS_META[s].label} · {filtered.filter(p => p.status === s).length}
              </div>
              {filtered.filter(p => p.status === s).map(p => (
                <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }}
                  style={{ display: "grid", gap: 4, padding: "10px 11px", border: "1px solid var(--border)", borderRadius: 9, color: "inherit", textDecoration: "none" }}>
                  <b style={{ fontSize: 12.5 }}>{p.name}</b>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{money(revenueByProject[p.id] ?? 0)}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}

      <NewProjectWizard
        open={newOpen}
        onOpenChange={setNewOpen}
        clients={clients}
        onCreate={(v) => createProject.mutate(v)}
        pending={createProject.isPending}
      />
    </>
  );
}

const money = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;
const pct = (n: number, total: number) => total ? `${((n / total) * 100).toFixed(1).replace(".", ",")}% do total` : "0% do total";

function deadlineText(end: string | null, overdue: number) {
  if (!end) return { text: "Sem prazo definido", tone: "muted" as const };
  const d = new Date(`${end}T00:00:00`);
  const days = Math.ceil((d.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  if (days < 0) return { text: `Vence em ${days} dias (${label})`, tone: "danger" as const };
  if (days <= 7 || overdue > 0) return { text: `Vence em ${days} dias (${label})`, tone: "warn" as const };
  return { text: `Vence em ${days} dias (${label})`, tone: "muted" as const };
}

function PrjKpi({ label, value, sub, icon, tone }: { label: string; value: number; sub: string; icon: React.ReactNode; tone?: "blue" | "green" | "amber" | "red" }) {
  return (
    <div className="cv-prj-kpi">
      <div>
        <div className="lbl">{label}</div>
        <div className="val">{value}</div>
        <div className="sub">{sub}</div>
      </div>
      <div className={cn("ico", tone)}>{icon}</div>
    </div>
  );
}

type Member = { user_id: string; name: string; avatar: string | null };

function Avatars({ members }: { members: Member[] }) {
  const shown = members.slice(0, 3);
  const rest = members.length - shown.length;
  if (!members.length) {
    return (
      <div className="cv-avatars">
        <span className="more" title="Sem equipe definida"><User className="h-3 w-3" /></span>
      </div>
    );
  }
  return (
    <div className="cv-avatars">
      {shown.map(m => (
        <span key={m.user_id} title={m.name}>
          {m.avatar ? <img src={m.avatar} alt={m.name} loading="lazy" /> : initials(m.name)}
        </span>
      ))}
      {rest > 0 && <span className="more" title={members.slice(3).map(m => m.name).join(", ")}>+{rest}</span>}
    </div>
  );
}

const initials = (n: string) =>
  n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "?";

function ProjectCard({ project, clientName, counts, revenue, members }: {
  project: Project; clientName: string | null;
  counts: { total: number; done: number; overdue: number }; revenue: number;
  members: Member[];
}) {
  const progress = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;
  const dl = deadlineText(project.end_date, counts.overdue);
  const health = project.status === "done"
    ? { label: "Concluído", color: "var(--success)" }
    : counts.overdue > 2 ? { label: "Crítico", color: "var(--danger)" }
    : counts.overdue > 0 ? { label: "Atenção", color: "var(--warning)" }
    : { label: "Saudável", color: "var(--success)" };
  const toneColor = dl.tone === "danger" ? "var(--danger)" : dl.tone === "warn" ? "var(--warning)" : "var(--muted)";

  return (
    <Link to="/projects/$projectId" params={{ projectId: project.id }} className="cv-prj-card">
      <h3>{project.name}</h3>
      <div className="cv-prj-meta">
        <User className="h-3.5 w-3.5" />
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{clientName ?? "Interno"}</span>
        <i className="cv-tag" style={{ fontStyle: "normal" }}>{STATUS_META[project.status].label}</i>
      </div>
      <div className="cv-health"><span className="dot" style={{ background: health.color }} />{health.label}</div>
      <div className="cv-progress-line">
        <span>{progress}%</span>
        <div className="cv-progress"><i style={{ width: `${progress}%` }} /></div>
        <span>{progress}%</span>
      </div>
      <div className="cv-prj-line" style={{ color: toneColor }}>
        <Calendar className="h-3.5 w-3.5" />{dl.text}
      </div>
      <div className="cv-prj-line" style={{ gap: 12 }}>
        <Avatars members={members} />
        <span className="inline-flex items-center gap-1.5">
          <ListChecks className="h-3.5 w-3.5" />{counts.done}/{counts.total} tarefas
        </span>
      </div>
      {counts.overdue > 0 && (
        <div className="cv-prj-alert">
          <AlertTriangle className="h-3.5 w-3.5" />{counts.overdue} {counts.overdue === 1 ? "tarefa em atraso" : "tarefas em atraso"}
        </div>
      )}
      <div className="cv-prj-foot">
        <span>Receita prevista</span>
        <span className="val">
          <b>{money(revenue)}</b>
          <button
            type="button"
            className="more"
            aria-label="Mais ações"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    </Link>
  );
}



