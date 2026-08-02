import { useMemo, useState } from "react";
import {
  ListChecks, Activity, AlertTriangle, CheckCircle2, Eye, Search, ChevronDown,
  SlidersHorizontal, Calendar, MoreVertical, Plus, Settings2,
} from "lucide-react";
import "@/prj03.css";

export type P3Task = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high";
  due_date: string | null;
  assignee_id: string | null;
  estimated_hours: number | null;
  progress: number;
  stage: "briefing" | "creation" | "review" | "approval" | "delivery";
};
export type P3Person = { id: string; full_name: string | null; role: string | null };

const STAGE_LABEL: Record<P3Task["stage"], string> = {
  briefing: "Briefing",
  creation: "Criação",
  review: "Revisão",
  approval: "Aprovação",
  delivery: "Entrega",
};
const STAGE_ORDER: P3Task["stage"][] = ["briefing", "creation", "review", "approval", "delivery"];
const STAGE_COLOR: Record<P3Task["stage"], string> = {
  briefing: "#2F6BEF",
  creation: "#14B8A6",
  review: "#F59E0B",
  approval: "#8B5CF6",
  delivery: "#10B981",
};
const PRIORITY: Record<P3Task["priority"], { label: string; cls: string }> = {
  high: { label: "Alta", cls: "high" },
  medium: { label: "Média", cls: "med" },
  low: { label: "Baixa", cls: "low" },
};
const STATUS_LABEL: Record<P3Task["status"], string> = {
  todo: "A fazer",
  in_progress: "Em andamento",
  review: "Em revisão",
  done: "Concluída",
};

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
}
function toDate(d: string | null) {
  if (!d) return null;
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
}
function fmtDate(d: string | null) {
  const dt = toDate(d);
  if (!dt) return "—";
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
}
function daysFromToday(d: string | null) {
  const dt = toDate(d);
  if (!dt) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.round((dt.getTime() - t.getTime()) / 86400000);
}

function Donut({ value }: { value: number }) {
  const r = 17, c = 2 * Math.PI * r;
  return (
    <svg className="p3-donut" width="46" height="46" viewBox="0 0 46 46">
      <circle cx="23" cy="23" r={r} fill="none" stroke="#E8ECF3" strokeWidth="5" />
      <circle
        cx="23" cy="23" r={r} fill="none" stroke="#2F6BEF" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${(c * value) / 100} ${c}`} transform="rotate(-90 23 23)"
      />
    </svg>
  );
}

function Sel({ label, value, options, onChange }: {
  label: string; value: string; options: { v: string; l: string }[]; onChange: (v: string) => void;
}) {
  const cur = options.find((o) => o.v === value)?.l ?? options[0]?.l;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className={`p3-sel${open ? " open" : ""}`} ref={ref}>
      <button type="button" className="p3-sel-btn" onClick={() => setOpen(o => !o)} aria-label={label} aria-expanded={open}>
        <span className="cv">{label}:</span> <span className="vv">{cur}</span>
        <ChevronDown />
      </button>
      {open && (
        <div className="p3-menu" role="listbox">
          {options.map((o) => (
            <button
              key={o.v}
              type="button"
              role="option"
              aria-selected={o.v === value}
              className={`p3-mi${o.v === value ? " on" : ""}`}
              onClick={() => { onChange(o.v); setOpen(false); }}
            >
              <span>{o.l}</span>
              {o.v === value && <Check />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


export function Prj03Tasks({ tasks, people, onOpen, onQuickCreate, pending }: {
  tasks: P3Task[];
  people: P3Person[];
  onOpen: (id: string) => void;
  onQuickCreate: () => void;
  pending?: boolean;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [priority, setPriority] = useState("all");
  const [deadline, setDeadline] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [checked, setChecked] = useState<string[]>([]);

  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.full_name ?? null;

  const stats = useMemo(() => {
    const total = tasks.length;
    const doing = tasks.filter((t) => t.status === "in_progress").length;
    const review = tasks.filter((t) => t.status === "review").length;
    const done = tasks.filter((t) => t.status === "done").length;
    const late = tasks.filter((t) => t.status !== "done" && (daysFromToday(t.due_date) ?? 1) < 0).length;
    return { total, doing, review, done, late, rate: total ? Math.round((done / total) * 100) : 0 };
  }, [tasks]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q.toLowerCase())) return false;
      if (status !== "all" && t.status !== status) return false;
      if (assignee !== "all" && t.assignee_id !== assignee) return false;
      if (priority !== "all" && t.priority !== priority) return false;
      if (deadline !== "all") {
        const d = daysFromToday(t.due_date);
        if (deadline === "late" && !(t.status !== "done" && d !== null && d < 0)) return false;
        if (deadline === "week" && !(d !== null && d >= 0 && d <= 7)) return false;
        if (deadline === "month" && !(d !== null && d >= 0 && d <= 30)) return false;
        if (deadline === "none" && t.due_date) return false;
      }
      return true;
    });
  }, [tasks, q, status, assignee, priority, deadline]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * perPage, current * perPage);
  const clearFilters = () => { setQ(""); setStatus("all"); setAssignee("all"); setPriority("all"); setDeadline("all"); setPage(1); };

  const upcoming = useMemo(() => tasks
    .filter((t) => t.status !== "done" && (daysFromToday(t.due_date) ?? -1) >= 0)
    .sort((a, b) => (toDate(a.due_date)!.getTime() - toDate(b.due_date)!.getTime()))
    .slice(0, 3), [tasks]);

  const overdue = useMemo(() => tasks
    .filter((t) => t.status !== "done" && (daysFromToday(t.due_date) ?? 1) < 0)
    .sort((a, b) => (toDate(a.due_date)!.getTime() - toDate(b.due_date)!.getTime()))
    .slice(0, 4), [tasks]);

  const byStage = STAGE_ORDER.map((s) => {
    const n = tasks.filter((t) => t.stage === s).length;
    return { stage: s, n, pct: tasks.length ? Math.round((n / tasks.length) * 100) : 0 };
  });

  const chip = (d: string | null, red = false) => {
    const dt = toDate(d);
    return (
      <div className={`p3-chip${red ? " red" : ""}`}>
        <div className="m">{dt ? dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") : "—"}</div>
        <div className="d">{dt ? String(dt.getDate()).padStart(2, "0") : "--"}</div>
      </div>
    );
  };

  return (
    <div className="prj03">
      {/* coluna principal */}
      <div>
        {/* 01 — faixa de indicadores */}
        <div className="p3-card p3-stats">
          <div className="p3-stat"><ListChecks /><div><div className="p3-stat-l">Total de tarefas</div><div className="p3-stat-v">{stats.total}</div></div></div>
          <div className="p3-stat"><Activity /><div><div className="p3-stat-l">Em andamento</div><div className="p3-stat-v">{stats.doing}</div></div></div>
          <div className="p3-stat warn"><Eye /><div><div className="p3-stat-l">Em revisão</div><div className="p3-stat-v">{stats.review}</div></div></div>
          <div className="p3-stat ok"><CheckCircle2 /><div><div className="p3-stat-l">Concluídas</div><div className="p3-stat-v">{stats.done}</div></div></div>
          <div className="p3-stat bad"><AlertTriangle /><div><div className="p3-stat-l">Atrasadas</div><div className="p3-stat-v">{stats.late}</div></div></div>
          <div className="p3-stat"><div><div className="p3-stat-l">Taxa de conclusão</div><div className="p3-stat-v">{stats.rate}%</div></div><Donut value={stats.rate} /></div>
        </div>

        {/* 02 — filtros */}
        <div className="p3-filters">
          <div className="p3-search">
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Buscar tarefas..." />
            <Search />
          </div>
          <Sel label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[
            { v: "all", l: "Todos" }, { v: "todo", l: "A fazer" }, { v: "in_progress", l: "Em andamento" },
            { v: "review", l: "Em revisão" }, { v: "done", l: "Concluídas" },
          ]} />
          <Sel label="Responsável" value={assignee} onChange={(v) => { setAssignee(v); setPage(1); }} options={[
            { v: "all", l: "Todos" }, ...people.map((p) => ({ v: p.id, l: p.full_name ?? "Sem nome" })),
          ]} />
          <Sel label="Prioridade" value={priority} onChange={(v) => { setPriority(v); setPage(1); }} options={[
            { v: "all", l: "Todas" }, { v: "high", l: "Alta" }, { v: "medium", l: "Média" }, { v: "low", l: "Baixa" },
          ]} />
          <Sel label="Prazo" value={deadline} onChange={(v) => { setDeadline(v); setPage(1); }} options={[
            { v: "all", l: "Todos" }, { v: "late", l: "Atrasadas" }, { v: "week", l: "Próx. 7 dias" },
            { v: "month", l: "Próx. 30 dias" }, { v: "none", l: "Sem prazo" },
          ]} />
          <button type="button" className="p3-fbtn" onClick={clearFilters}>Limpar filtros</button>
          <button type="button" className="p3-fbtn" onClick={() => setPerPage(perPage === 10 ? 25 : 10)}>
            <SlidersHorizontal /> Mais filtros
          </button>
        </div>

        {/* 03 — tabela */}
        <div className="p3-card p3-table">
          <table>
            <thead>
              <tr>
                <th className="p3-c-check">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every((r) => checked.includes(r.id))}
                    onChange={(e) => setChecked(e.target.checked ? rows.map((r) => r.id) : [])}
                    aria-label="Selecionar todas"
                  />
                </th>
                <th>Tarefa</th>
                <th>Etapa / Status</th>
                <th>Responsável</th>
                <th>Prioridade</th>
                <th>Prazo</th>
                <th>Progresso</th>
                <th>Esforço est.</th>
                <th className="p3-c-gear"><Settings2 size={15} /></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const name = nameOf(t.assignee_id);
                const late = t.status !== "done" && (daysFromToday(t.due_date) ?? 1) < 0;
                return (
                  <tr key={t.id}>
                    <td className="p3-c-check">
                      <input
                        type="checkbox"
                        checked={checked.includes(t.id)}
                        onChange={(e) => setChecked((c) => e.target.checked ? [...c, t.id] : c.filter((x) => x !== t.id))}
                        aria-label={`Selecionar ${t.title}`}
                      />
                    </td>
                    <td><span className="p3-tname" onClick={() => onOpen(t.id)}>{t.title}</span></td>
                    <td>
                      <span className="p3-stage" title={STATUS_LABEL[t.status]}>
                        <span className="dot" style={{ background: STAGE_COLOR[t.stage] }} />
                        {STAGE_LABEL[t.stage]}
                        <ChevronDown />
                      </span>
                    </td>
                    <td>
                      {name ? (
                        <span className="p3-assignee"><span className="p3-av">{initials(name)}</span>{name}</span>
                      ) : <span className="p3-date">Não atribuída</span>}
                    </td>
                    <td><span className={`p3-pill ${PRIORITY[t.priority].cls}`}>{PRIORITY[t.priority].label}</span></td>
                    <td><span className="p3-date" style={late ? { color: "#D22F2F" } : undefined}>{fmtDate(t.due_date)}</span></td>
                    <td>
                      <div className={`p3-prog${t.progress >= 100 ? " done" : ""}`}>
                        <span className="track"><i style={{ width: `${Math.min(100, Math.max(0, t.progress ?? 0))}%` }} /></span>
                        <b>{Math.round(t.progress ?? 0)}%</b>
                      </div>
                    </td>
                    <td><span className="p3-date">{t.estimated_hours ? `${t.estimated_hours}h` : "—"}</span></td>
                    <td className="p3-c-gear">
                      <button type="button" className="p3-kebab" onClick={() => onOpen(t.id)} aria-label="Abrir tarefa"><MoreVertical size={15} /></button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="p3-empty">Nenhuma tarefa encontrada com os filtros atuais.</td></tr>
              )}
            </tbody>
          </table>

          {/* 04 — rodapé */}
          <div className="p3-foot">
            <span>
              {filtered.length === 0 ? "Nenhuma tarefa" :
                `Mostrando ${(current - 1) * perPage + 1}–${Math.min(current * perPage, filtered.length)} de ${filtered.length} tarefas`}
            </span>
            <div className="p3-pages">
              <button type="button" className="p3-page" disabled={current <= 1} onClick={() => setPage(current - 1)}>‹</button>
              {Array.from({ length: pages }).slice(0, 6).map((_, i) => (
                <button key={i} type="button" className={`p3-page${current === i + 1 ? " on" : ""}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
              ))}
              <button type="button" className="p3-page" disabled={current >= pages} onClick={() => setPage(current + 1)}>›</button>
            </div>
            <div className="p3-rows">
              Linhas por página:
              <div className="p3-sel" style={{ height: 30, fontSize: 12, paddingRight: 26 }}>
                {perPage}
                <ChevronDown />
                <select value={String(perPage)} onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }} aria-label="Linhas por página">
                  {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* coluna lateral */}
      <aside className="p3-side">
        {/* Próximos prazos */}
        <div className="p3-card">
          <div className="p3-side-h">
            <span className="p3-side-t">Próximos prazos</span>
            <button type="button" className="p3-newtask" onClick={onQuickCreate} disabled={pending}>
              <Plus /> Nova tarefa
            </button>
          </div>
          {upcoming.map((t) => (
            <div className="p3-due" key={t.id}>
              {chip(t.due_date)}
              <div className="p3-due-b">
                <div className="p3-due-t" onClick={() => onOpen(t.id)}>{t.title}</div>
                <div className="p3-due-m">
                  <span className={`p3-pill ${PRIORITY[t.priority].cls}`}>{PRIORITY[t.priority].label}</span>
                  <span className="p3-pill blue">{STATUS_LABEL[t.status]}</span>
                </div>
              </div>
              <span className="p3-due-r">{daysFromToday(t.due_date)} dias</span>
            </div>
          ))}
          {upcoming.length === 0 && <div className="p3-due" style={{ color: "#8A93A3", fontSize: 12 }}>Sem prazos futuros.</div>}
          <div className="p3-side-f">
            <button type="button" className="p3-side-link" onClick={() => setDeadline("month")}>Ver todos os próximos prazos</button>
          </div>
        </div>

        {/* Tarefas por etapa */}
        <div className="p3-card">
          <div className="p3-side-h">
            <span className="p3-side-t">Tarefas por etapa</span>
            <button type="button" className="p3-side-link" onClick={clearFilters}>Ver relatório</button>
          </div>
          {byStage.map((s) => (
            <div className="p3-stagerow" key={s.stage}>
              <span className="lbl">{STAGE_LABEL[s.stage]}</span>
              <span className="bar"><i style={{ width: `${s.pct}%`, background: STAGE_COLOR[s.stage] }} /></span>
              <span className="val">{s.n} ({s.pct}%)</span>
            </div>
          ))}
        </div>

        {/* Tarefas atrasadas */}
        <div className="p3-card">
          <div className="p3-side-h">
            <span className="p3-side-t">Tarefas atrasadas<span className="n">{stats.late}</span></span>
            <button type="button" className="p3-side-link" onClick={() => { setDeadline("late"); setPage(1); }}>Ver todas</button>
          </div>
          {overdue.map((t) => (
            <div className="p3-due" key={t.id}>
              {chip(t.due_date, true)}
              <div className="p3-due-b">
                <div className="p3-due-t" onClick={() => onOpen(t.id)}>{t.title}</div>
                <div className="p3-due-m">
                  <span className={`p3-pill ${PRIORITY[t.priority].cls}`}>{PRIORITY[t.priority].label}</span>
                  <span className="p3-due-r red">Atrasada há {Math.abs(daysFromToday(t.due_date) ?? 0)} dias</span>
                </div>
              </div>
            </div>
          ))}
          {overdue.length === 0 && (
            <div className="p3-due" style={{ color: "#8A93A3", fontSize: 12 }}>
              <Calendar size={15} /> Nenhuma tarefa atrasada.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
