import { useMemo, useState } from "react";
import { List as ListIcon, LayoutGrid, Columns3, GanttChartSquare, Circle } from "lucide-react";
import "@/tsk01.css";
import { UserAvatar } from "@/components/user-avatar";

export type TskView = "list" | "board" | "kanban" | "gantt";

export type TskTask = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent" | "critical";
  project_id: string | null;
  due_date: string | null;
  start_date?: string | null;
  progress: number;
  billing_value: number | null;
  assignee_id?: string | null;
};

const STATUS_LABEL: Record<TskTask["status"], string> = {
  todo: "A fazer", in_progress: "Em andamento", review: "Revisão", done: "Concluída",
};
const STATUS_DOT: Record<TskTask["status"], string> = {
  todo: "#8A93A3", in_progress: "#2F6BEF", review: "#F59E0B", done: "#10B981",
};
const PRIORITY_LABEL: Record<TskTask["priority"], string> = {
  low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente", critical: "Crítica",
};
const ORDER: TskTask["status"][] = ["todo", "in_progress", "review", "done"];

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (d: string | null | undefined) =>
  d ? new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";
const isLate = (t: TskTask) => !!t.due_date && t.status !== "done" && new Date(t.due_date) < new Date(new Date().toDateString());

export function TaskViewSwitcher({ view, onChange }: { view: TskView; onChange: (v: TskView) => void }) {
  const items: { v: TskView; label: string; icon: typeof ListIcon }[] = [
    { v: "list", label: "Lista", icon: ListIcon },
    { v: "board", label: "Quadro", icon: LayoutGrid },
    { v: "kanban", label: "Kanban", icon: Columns3 },
    { v: "gantt", label: "Gantt", icon: GanttChartSquare },
  ];
  return (
    <div className="tskv">
      <div className="t-switch">
        {items.map(({ v, label, icon: Icon }) => (
          <button key={v} className={view === v ? "on" : ""} onClick={() => onChange(v)} type="button">
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

type ViewsProps = {
  view: TskView;
  tasks: TskTask[];
  projectName: (id: string | null) => string;
  assigneeName?: (id: string | null | undefined) => { name: string; role?: string | null };
  onOpen: (id: string) => void;
  onQuickCreate?: (status: TskTask["status"], title: string) => void;
  onStatusChange?: (id: string, status: TskTask["status"]) => void;
};

export function TaskViews(props: ViewsProps) {
  const { view } = props;
  return (
    <div className="tskv">
      {view === "list" && <ListView {...props} />}
      {view === "board" && <BoardView {...props} />}
      {view === "kanban" && <KanbanView {...props} />}
      {view === "gantt" && <GanttView {...props} />}
    </div>
  );
}

/* ------------------------- LISTA (TSK-01 tabela) ------------------------- */
const initials = (s: string) =>
  s.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "?";

const avatarHue = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
};

const dueMeta = (t: TskTask) => {
  if (!t.due_date) return { text: "—", aux: "", late: false };
  const d = new Date(t.due_date + "T12:00:00");
  const today = new Date(new Date().toDateString());
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  const late = days < 0 && t.status !== "done";
  const aux = t.status === "done" ? "" : late ? `${Math.abs(days)} d de atraso` : days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} d`;
  return { text: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }), aux, late };
};

function ListView({ tasks, projectName, assigneeName, onOpen, onQuickCreate, onStatusChange }: ViewsProps) {
  const [draft, setDraft] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const total = tasks.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(page, pages);
  const rows = tasks.slice((current - 1) * perPage, current * perPage);
  const allChecked = rows.length > 0 && rows.every(t => sel.has(t.id));

  const toggle = (id: string) =>
    setSel(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="t-card t-table" onClick={() => setMenu(null)}>
      <div className="t-thead">
        <label className="t-chk">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={() => setSel(allChecked ? new Set() : new Set(rows.map(t => t.id)))}
          />
        </label>
        <div>Tarefa</div>
        <div>Projeto</div>
        <div>Etapa / Status</div>
        <div>Responsável</div>
        <div>Prioridade</div>
        <div>Prazo</div>
        <div>Progresso</div>
        <div />
      </div>

      {rows.length === 0 && <div className="t-empty">Nenhuma tarefa encontrada.</div>}

      {rows.map(t => {
        const proj = projectName(t.project_id);
        const who = assigneeName?.(t.assignee_id) ?? { name: "Não atribuído", role: null };
        const d = dueMeta(t);
        return (
          <div key={t.id} className={`t-trow ${sel.has(t.id) ? "on" : ""}`} onClick={() => onOpen(t.id)}>
            <label className="t-chk" onClick={e => e.stopPropagation()}>
              <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} />
            </label>

            <div className="t-tcell">
              <div className="t-name" title={t.title}>{t.title}</div>
              <div className="t-sub">{t.billing_value ? brl(t.billing_value) : "Sem faturamento"}</div>
            </div>

            <div className="t-tcell t-with-av">
              <span className="t-av" style={{ background: `hsl(${avatarHue(proj)} 62% 92%)`, color: `hsl(${avatarHue(proj)} 55% 32%)` }}>
                {initials(proj)}
              </span>
              <div>
                <div className="t-name t-name-sm">{proj}</div>
                <div className="t-sub">{STATUS_LABEL[t.status]}</div>
              </div>
            </div>

            <div className="t-tcell">
              <span className={`t-pill ${t.status}`}>
                <i className="t-dot" style={{ background: STATUS_DOT[t.status] }} />
                {STATUS_LABEL[t.status]}
              </span>
            </div>

            <div className="t-tcell t-with-av">
              <UserAvatar userId={t.assignee_id} name={who.name} size="css" className="t-av" />
              <div>
                <div className="t-name t-name-sm">{who.name}</div>
                {who.role ? <div className="t-sub">{who.role}</div> : null}
              </div>
            </div>

            <div className="t-tcell">
              <span className={`t-pill ${t.priority}`}>{PRIORITY_LABEL[t.priority]}</span>
            </div>

            <div className="t-tcell">
              <div className={`t-name t-name-sm ${d.late ? "t-late" : ""}`}>{d.text}</div>
              {d.aux ? <div className={`t-sub ${d.late ? "t-late" : ""}`}>{d.aux}</div> : null}
            </div>

            <div className="t-tcell">
              <div className="t-bar"><i style={{ width: `${Math.min(100, t.progress ?? 0)}%` }} /></div>
              <div className="t-sub t-num">{t.progress ?? 0}%</div>
            </div>

            <div className="t-tcell t-actions" onClick={e => e.stopPropagation()}>
              <button type="button" className="t-iconbtn" onClick={() => setMenu(m => (m === t.id ? null : t.id))}>⋮</button>
              {menu === t.id && (
                <div className="t-menu">
                  <button type="button" onClick={() => { setMenu(null); onOpen(t.id); }}>Abrir tarefa</button>
                  {ORDER.filter(s => s !== t.status).map(s => (
                    <button key={s} type="button" onClick={() => { setMenu(null); onStatusChange?.(t.id, s); }}>
                      Mover para {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {onQuickCreate && (
        <input
          className="t-quick"
          placeholder="+ Digite e pressione Enter para criar uma tarefa…"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && draft.trim()) { onQuickCreate("todo", draft.trim()); setDraft(""); }
          }}
        />
      )}

      <div className="t-pager">
        <span className="t-sub">
          {total === 0 ? "0 tarefas" : `${(current - 1) * perPage + 1}–${Math.min(current * perPage, total)} de ${total} tarefas`}
        </span>
        <div className="t-pager-r">
          <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}>
            {[10, 15, 25, 50].map(n => <option key={n} value={n}>{n} por página</option>)}
          </select>
          <button type="button" disabled={current <= 1} onClick={() => setPage(current - 1)}>Anterior</button>
          <span className="t-page">{current} / {pages}</span>
          <button type="button" disabled={current >= pages} onClick={() => setPage(current + 1)}>Próxima</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- QUADRO ------------------------------ */
function BoardView({ tasks, projectName, onOpen }: ViewsProps) {
  const groups = useMemo(() => {
    const m = new Map<string, TskTask[]>();
    tasks.forEach(t => {
      const key = t.project_id ?? "__none";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(t);
    });
    return [...m.entries()];
  }, [tasks]);

  if (!groups.length) return <div className="t-card t-empty">Nenhuma tarefa encontrada.</div>;

  return (
    <div className="t-board">
      {groups.map(([pid, list]) => {
        const done = list.filter(t => t.status === "done").length;
        const value = list.reduce((a, t) => a + (t.billing_value ?? 0), 0);
        return (
          <div key={pid} className="t-card t-bcard">
            <div>
              <h4>{pid === "__none" ? "Sem projeto" : projectName(pid)}</h4>
              <div className="t-bmeta">{done}/{list.length} concluídas · {brl(value)}</div>
            </div>
            <div className="t-bar"><i style={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }} /></div>
            <div style={{ display: "grid", gap: 6 }}>
              {list.slice(0, 6).map(t => (
                <div key={t.id} className="t-bitem" onClick={() => onOpen(t.id)}>
                  <span className="t-dot" style={{ background: STATUS_DOT[t.status] }} />
                  <span className="tt">{t.title}</span>
                  <span className={`t-when ${isLate(t) ? "t-late" : ""}`}>{fmt(t.due_date)}</span>
                </div>
              ))}
              {list.length > 6 && <div className="t-bmeta">+ {list.length - 6} tarefas</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------- KANBAN ------------------------------ */
function KanbanView({ tasks, projectName, onOpen, onStatusChange }: ViewsProps) {
  const [over, setOver] = useState<string | null>(null);
  const groups = useMemo(() => {
    const m: Record<string, TskTask[]> = { todo: [], in_progress: [], review: [], done: [] };
    tasks.forEach(t => m[t.status].push(t));
    return m;
  }, [tasks]);

  return (
    <div className="t-kb">
      {ORDER.map(status => (
        <div
          key={status}
          className={`t-col ${over === status ? "over" : ""}`}
          onDragOver={e => { e.preventDefault(); setOver(status); }}
          onDragLeave={() => setOver(o => (o === status ? null : o))}
          onDrop={e => {
            e.preventDefault();
            setOver(null);
            const id = e.dataTransfer.getData("text/plain");
            if (id) onStatusChange?.(id, status);
          }}
        >
          <div className="t-col-h">
            <span className="t-dot" style={{ background: STATUS_DOT[status] }} />
            <strong style={{ fontSize: 12.5 }}>{STATUS_LABEL[status]}</strong>
            <span className="t-count" style={{ marginLeft: "auto" }}>{groups[status].length}</span>
          </div>
          {groups[status].map(t => (
            <div
              key={t.id}
              className="t-kcard"
              draggable
              onDragStart={e => e.dataTransfer.setData("text/plain", t.id)}
              onClick={() => onOpen(t.id)}
            >
              <div className="kt">{t.title}</div>
              <div className="km">
                <span className={`t-pill ${t.priority}`}>{PRIORITY_LABEL[t.priority]}</span>
                <span className={`t-when t-cell ${isLate(t) ? "t-late" : ""}`} style={{ fontSize: 11 }}>{fmt(t.due_date)}</span>
                {t.billing_value ? <span className="kv">{brl(t.billing_value)}</span> : null}
              </div>
              <div className="t-bmeta" style={{ marginTop: 6 }}>{projectName(t.project_id)}</div>
            </div>
          ))}
          {!groups[status].length && (
            <div className="t-bmeta" style={{ padding: "12px 6px", display: "flex", gap: 6, alignItems: "center" }}>
              <Circle size={11} /> Arraste tarefas para cá
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------- GANTT ------------------------------ */
function GanttView({ tasks, onOpen }: ViewsProps) {
  const rows = useMemo(() => tasks.filter(t => t.due_date || t.start_date), [tasks]);

  const range = useMemo(() => {
    const dates: number[] = [];
    rows.forEach(t => {
      if (t.start_date) dates.push(new Date(t.start_date + "T12:00:00").getTime());
      if (t.due_date) dates.push(new Date(t.due_date + "T12:00:00").getTime());
    });
    const now = Date.now();
    dates.push(now);
    const min = Math.min(...dates), max = Math.max(...dates);
    const pad = 3 * 86400000;
    return { min: min - pad, max: Math.max(max + pad, min + 14 * 86400000) };
  }, [rows]);

  const span = range.max - range.min;
  const pct = (ms: number) => ((ms - range.min) / span) * 100;

  const ticks = useMemo(() => {
    const out: { label: string; at: number }[] = [];
    const start = new Date(range.min);
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur.getTime() <= range.max) {
      out.push({ label: cur.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), at: cur.getTime() });
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }, [range]);

  if (!rows.length) return <div className="t-card t-empty">Nenhuma tarefa com datas para exibir no Gantt.</div>;

  return (
    <div className="t-card t-gantt">
      <div className="t-gwrap">
        <div className="t-grow t-ghead">
          <div className="t-glabel">Tarefa</div>
          <div className="t-gscale">
            {ticks.map(t => <div key={t.at}>{t.label}</div>)}
          </div>
        </div>
        {rows.map(t => {
          const end = new Date((t.due_date ?? t.start_date!) + "T12:00:00").getTime();
          const startRaw = t.start_date ? new Date(t.start_date + "T12:00:00").getTime() : end - 3 * 86400000;
          const left = pct(Math.min(startRaw, end));
          const width = Math.max(1.5, pct(end) - left);
          return (
            <div key={t.id} className="t-grow">
              <div className="t-glabel" title={t.title}>{t.title}</div>
              <div className="t-gtrack">
                <div className="t-gticks">{ticks.map(k => <div key={k.at} />)}</div>
                <div className="t-gtoday" style={{ left: `${pct(Date.now())}%` }} />
                <div
                  className={`t-gbar ${t.status === "done" ? "done" : isLate(t) ? "late" : ""}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  onClick={() => onOpen(t.id)}
                  title={`${t.title} · ${fmt(t.due_date)}`}
                >
                  <span>{fmt(t.due_date)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
