import { useMemo, useState } from "react";
import { List as ListIcon, LayoutGrid, Columns3, GanttChartSquare, Circle } from "lucide-react";
import "@/tsk01.css";

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

/* ------------------------------- LISTA ------------------------------- */
function ListView({ tasks, projectName, onOpen, onQuickCreate }: ViewsProps) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const groups = useMemo(() => {
    const m: Record<string, TskTask[]> = { todo: [], in_progress: [], review: [], done: [] };
    tasks.forEach(t => m[t.status].push(t));
    return m;
  }, [tasks]);

  return (
    <>
      {ORDER.map(status => (
        <div key={status} className="t-card t-group">
          <div className="t-group-h">
            <span className="t-dot" style={{ background: STATUS_DOT[status] }} />
            {STATUS_LABEL[status]}
            <span className="t-count">{groups[status].length}</span>
            <span className="t-right">
              {brl(groups[status].reduce((a, t) => a + (t.billing_value ?? 0), 0))}
            </span>
          </div>
          {groups[status].map(t => (
            <div key={t.id} className="t-row" onClick={() => onOpen(t.id)}>
              <span className="t-dot" style={{ background: STATUS_DOT[t.status] }} />
              <div>
                <div className="t-name">{t.title}</div>
                <div className="t-sub">{projectName(t.project_id)}</div>
              </div>
              <span className={`t-pill ${t.priority}`}>{PRIORITY_LABEL[t.priority]}</span>
              <span className={`t-cell ${isLate(t) ? "t-late" : ""}`}>{fmt(t.due_date)}</span>
              <div>
                <div className="t-bar"><i style={{ width: `${Math.min(100, t.progress ?? 0)}%` }} /></div>
              </div>
              <span className="t-cell t-num">{t.progress ?? 0}%</span>
              <span className="t-cell t-num" style={{ textAlign: "right" }}>
                {t.billing_value ? brl(t.billing_value) : "—"}
              </span>
            </div>
          ))}
          {onQuickCreate && (
            <input
              className="t-quick"
              placeholder="+ Digite e pressione Enter para criar…"
              value={draft[status] ?? ""}
              onChange={e => setDraft(p => ({ ...p, [status]: e.target.value }))}
              onKeyDown={e => {
                if (e.key === "Enter" && (draft[status] ?? "").trim()) {
                  onQuickCreate(status, draft[status].trim());
                  setDraft(p => ({ ...p, [status]: "" }));
                }
              }}
            />
          )}
        </div>
      ))}
    </>
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
