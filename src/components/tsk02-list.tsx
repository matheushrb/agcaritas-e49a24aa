import { useMemo, useState, useEffect } from "react";
import {
  Search, Plus, Download, List as ListIcon, LayoutGrid, GanttChartSquare,
  CalendarDays, Clock, Timer, CheckCircle2, AlertTriangle, MoreVertical,
  ChevronLeft, ChevronRight, FilterX,
} from "lucide-react";
import "@/tsk02.css";
import { useStageIndex, stageInfoOf } from "@/lib/task-types";


export type TskTask = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent" | "critical";
  project_id: string | null;
  assignee_id: string | null;
  due_date: string | null;
  progress: number;
  billing_value?: number | null;
  description?: string | null;
  start_date?: string | null;
  created_at?: string;
  subtasks?: { id: string; title: string; done: boolean }[];
  comments_count?: number;
  attachments_count?: number;
  archived_at?: string | null;
  stage?: "briefing" | "creation" | "review" | "approval" | "delivery" | null;
  current_stage_id?: string | null;

};


export type TskView2 = "list" | "board" | "gantt";

const STATUS_LABEL: Record<TskTask["status"], string> = {
  todo: "A fazer",
  in_progress: "Em andamento",
  review: "Em revisão",
  done: "Concluída",
};
const PRIORITY_LABEL: Record<TskTask["priority"], string> = {
  low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente", critical: "Crítica",
};

const AV_COLORS = ["#1769F6", "#7A5AF8", "#12B76A", "#F79009", "#E23A3A", "#0BA5EC", "#EE46BC", "#4E5BA6"];
export function hashColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}
export function initials(name: string, max = 2) {
  return name.split(/\s+/).filter(Boolean).slice(0, max).map(w => w[0]).join("").toUpperCase() || "—";
}

/** Código curto da tarefa no padrão #XX-000 (iniciais do projeto + hash do id). */
export function taskCode(t: TskTask, projName: string) {
  const pre = (projName.replace(/[^A-Za-zÀ-ú0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2)
    .map(w => w[0]).join("") || "TK").toUpperCase();
  let h = 0;
  for (let i = 0; i < t.id.length; i++) h = (h * 31 + t.id.charCodeAt(i)) >>> 0;
  return `#${pre}-${String(h % 1000).padStart(3, "0")}`;
}

export function daysDiff(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}
export function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .replace(".", "");
}

type Props = {
  view: TskView2;
  onViewChange: (v: TskView2) => void;
  tasks: TskTask[];
  projects: { id: string; name: string }[];
  people: { id: string; full_name: string | null; display_name: string | null; role_title: string | null }[];
  projectSub?: (id: string | null) => string;
  onOpen: (id: string) => void;
  onNew: () => void;
  onQuickCreate: (title: string) => void;
  onStatusChange: (id: string, status: TskTask["status"]) => void;
  onArchiveChange?: (id: string, archived: boolean) => void;
  children?: (rows: TskTask[]) => React.ReactNode;
};

export function Tsk02List({
  view, onViewChange, tasks, projects, people, projectSub,
  onOpen, onNew, onQuickCreate, onStatusChange, onArchiveChange, children,
}: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [priority, setPriority] = useState("all");
  const [project, setProject] = useState("all");
  const [deadline, setDeadline] = useState("all");
  const [archived, setArchived] = useState<"hide" | "show" | "only">("hide");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [menu, setMenu] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [quick, setQuick] = useState("");

  useEffect(() => { setPage(1); }, [q, status, assignee, priority, project, deadline, archived, perPage]);
  useEffect(() => {
    const close = () => setMenu(null);
    if (menu) { window.addEventListener("click", close); return () => window.removeEventListener("click", close); }
  }, [menu]);

  const projName = (id: string | null) => (id && projects.find(p => p.id === id)?.name) || "Sem projeto";
  const person = (id: string | null) => {
    const p = id ? people.find(x => x.id === id) : null;
    return {
      name: p?.display_name || p?.full_name || (id ? "Responsável" : "Não atribuído"),
      role: p?.role_title || (id ? "" : "—"),
    };
  };

  const isLate = (t: TskTask) => !!t.due_date && t.status !== "done" && daysDiff(t.due_date) < 0;

  const filtered = useMemo(() => {
    let arr = tasks;
    if (archived === "hide") arr = arr.filter(t => !t.archived_at);
    else if (archived === "only") arr = arr.filter(t => !!t.archived_at);
    const s = q.trim().toLowerCase();
    if (s) arr = arr.filter(t =>
      t.title.toLowerCase().includes(s) ||
      projName(t.project_id).toLowerCase().includes(s) ||
      person(t.assignee_id).name.toLowerCase().includes(s));
    if (status === "late") arr = arr.filter(isLate);
    else if (status !== "all") arr = arr.filter(t => t.status === status);
    if (assignee !== "all") arr = arr.filter(t => assignee === "none" ? !t.assignee_id : t.assignee_id === assignee);
    if (priority !== "all") arr = arr.filter(t => t.priority === priority);
    if (project !== "all") arr = arr.filter(t => project === "none" ? !t.project_id : t.project_id === project);
    if (deadline !== "all") {
      arr = arr.filter(t => {
        if (!t.due_date) return false;
        const d = daysDiff(t.due_date);
        if (deadline === "overdue") return d < 0 && t.status !== "done";
        if (deadline === "today") return d === 0;
        if (deadline === "week") return d >= 0 && d <= 7;
        if (deadline === "month") return d >= 0 && d <= 30;
        return true;
      });
    }
    return arr;
  }, [tasks, q, status, assignee, priority, project, deadline, archived, projects, people]);

  const kpiBase = useMemo(
    () => (archived === "only" ? tasks.filter(t => !!t.archived_at) : tasks.filter(t => !t.archived_at)),
    [tasks, archived],
  );

  const kpis = useMemo(() => {
    const tasks = kpiBase;
    const total = tasks.length || 0;
    const pct = (n: number) => total ? `${(n / total * 100).toFixed(1).replace(".", ",")}% do total` : "0% do total";
    const inProgress = tasks.filter(t => t.status === "in_progress").length;
    const review = tasks.filter(t => t.status === "review").length;
    const done = tasks.filter(t => t.status === "done").length;
    const late = tasks.filter(isLate).length;
    return [
      { key: "total", label: "Total de tarefas", value: total, sub: "100% do total", icon: CalendarDays, color: "#1769F6", bg: "#E8F0FE" },
      { key: "in_progress", label: "Em andamento", value: inProgress, sub: pct(inProgress), icon: Clock, color: "#1769F6", bg: "#E8F0FE" },
      { key: "review", label: "Em revisão", value: review, sub: pct(review), icon: Timer, color: "#F79009", bg: "#FEF3E2" },
      { key: "done", label: "Concluídas", value: done, sub: pct(done), icon: CheckCircle2, color: "#12B76A", bg: "#E7F8F0" },
      { key: "late", label: "Atrasadas", value: late, sub: pct(late), icon: AlertTriangle, color: "#E23A3A", bg: "#FDECEC", danger: late > 0 },
    ];
  }, [kpiBase]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * perPage, current * perPage);
  const from = filtered.length === 0 ? 0 : (current - 1) * perPage + 1;
  const to = Math.min(current * perPage, filtered.length);

  const clearFilters = () => {
    setQ(""); setStatus("all"); setAssignee("all"); setPriority("all"); setProject("all"); setDeadline("all"); setArchived("hide");
  };

  const exportCsv = () => {
    const head = ["Tarefa", "Código", "Projeto", "Status", "Responsável", "Prioridade", "Prazo", "Progresso"];
    const lines = filtered.map(t => [
      t.title, taskCode(t, projName(t.project_id)), projName(t.project_id),
      STATUS_LABEL[t.status], person(t.assignee_id).name, PRIORITY_LABEL[t.priority],
      t.due_date ?? "", `${t.progress}%`,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    const blob = new Blob(["\uFEFF" + [head.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tarefas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pageNumbers = useMemo(() => {
    const max = Math.min(5, totalPages);
    let start = Math.max(1, current - 2);
    if (start + max - 1 > totalPages) start = Math.max(1, totalPages - max + 1);
    return Array.from({ length: max }, (_, i) => start + i);
  }, [current, totalPages]);

  return (
    <div className="tsk2">
      <div className="k-head">
        <div>
          <h1 className="k-title">Tarefas</h1>
          <p className="k-sub">Acompanhe, organize e conclua as tarefas da agência.</p>
        </div>
        <div className="k-headacts">
          <button className="k-btn" onClick={exportCsv}><Download size={16} /> Exportar</button>
          <button className="k-btn primary" onClick={onNew}><Plus size={16} /> Nova tarefa</button>
        </div>
      </div>

      <div className="k-tabs">
        <button className={`k-tab ${view === "list" ? "on" : ""}`} onClick={() => onViewChange("list")}>
          <ListIcon size={16} /> Lista
        </button>
        <button className={`k-tab ${view === "board" ? "on" : ""}`} onClick={() => onViewChange("board")}>
          <LayoutGrid size={16} /> Quadro
        </button>
        <button className={`k-tab ${view === "gantt" ? "on" : ""}`} onClick={() => onViewChange("gantt")}>
          <GanttChartSquare size={16} /> Gantt
        </button>
      </div>

      <div className="k-filters">
        <div className="k-searchbox">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por tarefa, projeto ou responsável..." />
          <Search size={16} />
        </div>
        <div className="k-fgroup">
          <span className="k-flabel">Status</span>
          <select className="k-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="all">Todos</option>
            <option value="todo">A fazer</option>
            <option value="in_progress">Em andamento</option>
            <option value="review">Em revisão</option>
            <option value="done">Concluída</option>
            <option value="late">Atrasada</option>
          </select>
        </div>
        <div className="k-fgroup">
          <span className="k-flabel">Responsável</span>
          <select className="k-select" value={assignee} onChange={e => setAssignee(e.target.value)}>
            <option value="all">Todos</option>
            <option value="none">Não atribuído</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.display_name || p.full_name || "Sem nome"}</option>)}
          </select>
        </div>
        <div className="k-fgroup">
          <span className="k-flabel">Prioridade</span>
          <select className="k-select" value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="all">Todas</option>
            <option value="critical">Crítica</option>
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        </div>
        <div className="k-fgroup">
          <span className="k-flabel">Projeto</span>
          <select className="k-select" value={project} onChange={e => setProject(e.target.value)}>
            <option value="all">Todos</option>
            <option value="none">Sem projeto</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="k-fgroup">
          <span className="k-flabel">Prazo</span>
          <select className="k-select" value={deadline} onChange={e => setDeadline(e.target.value)}>
            <option value="all">Todos</option>
            <option value="overdue">Atrasadas</option>
            <option value="today">Hoje</option>
            <option value="week">Próximos 7 dias</option>
            <option value="month">Próximos 30 dias</option>
          </select>
        </div>
        <div className="k-fgroup">
          <span className="k-flabel">Arquivadas</span>
          <select className="k-select" value={archived} onChange={e => setArchived(e.target.value as "hide" | "show" | "only")}>
            <option value="hide">Ocultar</option>
            <option value="show">Mostrar</option>
            <option value="only">Somente arquivadas</option>
          </select>
        </div>
        <button className="k-clear" onClick={clearFilters}><FilterX size={15} /> Limpar filtros</button>
      </div>

      <div className="k-kpis">
        {kpis.map(k => (
          <div key={k.key} className={`k-kpi ${k.danger ? "danger" : ""}`}>
            <div>
              <div className="kl">{k.label}</div>
              <div className="kv">{k.value}</div>
              <div className="kp">{k.sub}</div>
            </div>
            <span className="ki" style={{ background: k.bg, color: k.color }}><k.icon size={17} /></span>
          </div>
        ))}
      </div>

      {view !== "list" ? children?.(filtered) : (
        <div className="k-table">
          <div className="k-thead">
            <div className="k-chk">
              <input
                type="checkbox"
                checked={rows.length > 0 && rows.every(r => sel[r.id])}
                onChange={e => {
                  const next = { ...sel };
                  rows.forEach(r => { if (e.target.checked) next[r.id] = true; else delete next[r.id]; });
                  setSel(next);
                }}
              />
            </div>
            <div>Tarefa</div>
            <div>Projeto</div>
            <div>Etapa / Status</div>
            <div>Responsável</div>
            <div>Prioridade</div>
            <div>Prazo</div>
            <div>Progresso</div>
            <div style={{ textAlign: "right" }}>Ações</div>
          </div>

          {rows.length === 0 ? (
            <div className="k-empty">Nenhuma tarefa encontrada com os filtros atuais.</div>
          ) : rows.map(t => {
            const pn = projName(t.project_id);
            const per = person(t.assignee_id);
            const late = isLate(t);
            const d = t.due_date ? daysDiff(t.due_date) : null;
            return (
              <div key={t.id} className="k-trow" onClick={() => onOpen(t.id)}>
                <div className="k-chk" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={!!sel[t.id]} onChange={e => setSel(s => ({ ...s, [t.id]: e.target.checked }))} />
                </div>
                <div className="k-cell">
                  <div className="k-tname" title={t.title}>{t.title}</div>
                  <div className="k-tcode">{taskCode(t, pn)}</div>
                </div>
                <div className="k-cell k-proj">
                  <span className="k-pav" style={{ background: hashColor(pn) }}>{initials(pn)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="k-pname" title={pn}>{pn}</div>
                    <div className="k-psub">{projectSub?.(t.project_id) || STATUS_LABEL[t.status]}</div>
                  </div>
                </div>
                <div className="k-cell">
                  {(() => { const si = stageInfoOf(t, stageIndex); return (
                    <div className="k-stagecell">
                      <span className="k-stagename"><i style={{ background: si.color }} />{si.name}</span>
                      <span className={`k-pill ${late ? "st-late" : `st-${t.status}`}`}>
                        {late ? "Atrasada" : STATUS_LABEL[t.status]}
                      </span>
                    </div>
                  ); })()}
                </div>

                <div className="k-cell k-user">
                  <span className="k-av" style={{ background: hashColor(per.name) }}>{initials(per.name)}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="k-uname">{per.name}</div>
                    <div className="k-urole">{per.role}</div>
                  </div>
                </div>
                <div className="k-cell">
                  <span className={`k-pill pr-${t.priority}`}>{PRIORITY_LABEL[t.priority]}</span>
                </div>
                <div className="k-cell">
                  {t.due_date ? (
                    <>
                      <div className={`k-date ${late ? "late" : ""}`}>{fmtDate(t.due_date)}</div>
                      <div className={`k-when ${late ? "late" : ""}`}>
                        {t.status === "done" ? "Concluída"
                          : d === null ? ""
                          : d < 0 ? `${Math.abs(d)} dias atrasado`
                          : d === 0 ? "Vence hoje"
                          : `${d} dias restantes`}
                      </div>
                    </>
                  ) : <span className="k-when">Sem prazo</span>}
                </div>
                <div className="k-cell k-prog">
                  <span className="k-progv">{t.progress}%</span>
                  <span className="k-bar"><i className={t.progress >= 100 ? "done" : ""} style={{ width: `${Math.min(100, t.progress)}%` }} /></span>
                </div>
                <div className="k-cell k-acts" onClick={e => e.stopPropagation()}>
                  <button className="k-iconbtn" onClick={() => setMenu(m => m === t.id ? null : t.id)}><MoreVertical size={16} /></button>
                  {menu === t.id && (
                    <div className="k-menu" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setMenu(null); onOpen(t.id); }}>Abrir tarefa</button>
                      <button onClick={() => { setMenu(null); onStatusChange(t.id, "in_progress"); }}>Marcar em andamento</button>
                      <button onClick={() => { setMenu(null); onStatusChange(t.id, "review"); }}>Enviar para revisão</button>
                      <button onClick={() => { setMenu(null); onStatusChange(t.id, "done"); }}>Marcar como concluída</button>
                      {onArchiveChange && (
                        t.archived_at
                          ? <button onClick={() => { setMenu(null); onArchiveChange(t.id, false); }}>Desarquivar</button>
                          : <button onClick={() => { setMenu(null); onArchiveChange(t.id, true); }}>Arquivar</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div className="k-quick">
            <input
              value={quick}
              onChange={e => setQuick(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && quick.trim()) { onQuickCreate(quick.trim()); setQuick(""); }
              }}
              placeholder="+ Digite e pressione Enter para criar uma tarefa..."
            />
          </div>

          <div className="k-foot">
            <span className="fl">Mostrando {from} a {to} de {filtered.length} tarefas</span>
            <div className="k-pages">
              <button className="k-pg" disabled={current === 1} onClick={() => setPage(current - 1)}><ChevronLeft size={15} /></button>
              {pageNumbers.map(n => (
                <button key={n} className={`k-pg ${n === current ? "on" : ""}`} onClick={() => setPage(n)}>{n}</button>
              ))}
              <button className="k-pg" disabled={current === totalPages} onClick={() => setPage(current + 1)}><ChevronRight size={15} /></button>
              <select className="k-select k-perpage" value={perPage} onChange={e => setPerPage(Number(e.target.value))}>
                <option value={10}>10 por página</option>
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
