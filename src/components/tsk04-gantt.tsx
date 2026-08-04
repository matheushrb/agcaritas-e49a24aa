import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Minus, Plus } from "lucide-react";
import { hashColor, initials, daysDiff, fmtDate, type TskTask } from "./tsk02-list";
import "@/tsk0304.css";

const STATUS_LABEL: Record<TskTask["status"], string> = {
  todo: "A fazer", in_progress: "Em andamento", review: "Em revisão", done: "Concluída",
};
const MS_DAY = 86400000;

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

type Props = {
  tasks: TskTask[];
  projectName: (id: string | null) => string;
  person: (id: string | null) => { name: string; role: string };
  onOpen: (id: string) => void;
};

/** TSK-04 — Gantt agrupado por projeto com timeline semanal. */
export function Tsk04Gantt({ tasks, projectName, person, onOpen }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [weekPx, setWeekPx] = useState(92);

  const dated = tasks.filter(t => t.due_date || t.start_date);

  const { weeks, from } = useMemo(() => {
    const times: number[] = [];
    for (const t of dated) {
      if (t.start_date) times.push(new Date(t.start_date).getTime());
      if (t.due_date) times.push(new Date(t.due_date).getTime());
    }
    times.push(Date.now());
    const min = startOfWeek(new Date(Math.min(...times)));
    const max = startOfWeek(new Date(Math.max(...times)));
    const count = Math.max(6, Math.round((max.getTime() - min.getTime()) / (7 * MS_DAY)) + 2);
    return {
      from: min,
      weeks: Array.from({ length: count }, (_, i) => new Date(min.getTime() + i * 7 * MS_DAY)),
    };
  }, [dated]);

  const groups = useMemo(() => {
    const m = new Map<string, TskTask[]>();
    for (const t of dated) {
      const k = t.project_id ?? "none";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return [...m.entries()].map(([id, list]) => ({
      id,
      name: projectName(id === "none" ? null : id),
      list: list.sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")),
    }));
  }, [dated, projectName]);

  const totalW = weeks.length * weekPx;
  const pos = (dateStr: string) =>
    ((new Date(dateStr).getTime() - from.getTime()) / (7 * MS_DAY)) * weekPx;
  const todayX = ((Date.now() - from.getTime()) / (7 * MS_DAY)) * weekPx;

  if (dated.length === 0) {
    return <div className="k-empty" style={{ marginTop: 18 }}>Nenhuma tarefa com datas para exibir no Gantt.</div>;
  }

  return (
    <div className="g-wrap">
      <div className="g-scroll">
        <div className="g-inner" style={{ minWidth: 640 + totalW }}>
          <div className="g-row" style={{ gridTemplateColumns: `640px ${totalW}px` }}>
            {/* ------- painel esquerdo ------- */}
            <div className="g-left">
              <div className="g-lhead">
                <div>Tarefa</div><div>Responsável</div><div>Status</div><div /><div>Início</div><div>Prazo</div>
              </div>
              {groups.map(g => (
                <div key={g.id}>
                  <button className="g-group" onClick={() => setCollapsed(c => ({ ...c, [g.id]: !c[g.id] }))}>
                    {collapsed[g.id] ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                    {g.name}
                    <span className="cnt">{g.list.length}</span>
                  </button>
                  {!collapsed[g.id] && g.list.map(t => {
                    const per = person(t.assignee_id);
                    return (
                      <div key={t.id} className="g-lrow" onClick={() => onOpen(t.id)}>
                        <div className="g-name">{t.title}</div>
                        <div className="g-user">
                          <span className="av-sm" style={{ background: hashColor(per.name) }}>{initials(per.name)}</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{per.name}</span>
                        </div>
                        <div><span className={`k-pill st-${t.status}`}>{STATUS_LABEL[t.status]}</span></div>
                        <div />
                        <div className="g-date">{t.start_date ? fmtDate(t.start_date) : "—"}</div>
                        <div className="g-date">{t.due_date ? fmtDate(t.due_date) : "—"}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* ------- timeline ------- */}
            <div className="g-right">
              <div className="g-scale">
                {weeks.map((w, i) => {
                  const end = new Date(w.getTime() + 6 * MS_DAY);
                  const isNow = Date.now() >= w.getTime() && Date.now() < w.getTime() + 7 * MS_DAY;
                  return (
                    <div className="g-w" key={i} style={{ flex: `1 0 ${weekPx}px` }}>
                      <div className="m">{i === 0 || w.getDate() <= 7 ? w.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "") : ""}</div>
                      {isNow ? <div className="now">Hoje</div> : <div className="s">S{i + 1}</div>}
                      <div className="d">{w.getDate()}–{end.getDate()}</div>
                    </div>
                  );
                })}
              </div>

              {groups.map(g => (
                <div key={g.id}>
                  <div className="g-track" style={{ background: "transparent" }}>
                    <div className="g-ticks">{weeks.map((_, i) => <i key={i} style={{ flex: `1 0 ${weekPx}px` }} />)}</div>
                  </div>
                  {!collapsed[g.id] && g.list.map(t => {
                    const s = t.start_date ?? t.due_date!;
                    const e = t.due_date ?? t.start_date!;
                    const x = Math.max(0, pos(s));
                    const w = Math.max(14, pos(e) - x + weekPx / 7);
                    const late = t.status !== "done" && !!t.due_date && daysDiff(t.due_date) < 0;
                    const cls = t.status === "done" ? "done" : late ? "late" : t.status === "todo" ? "todo" : t.status === "review" ? "warn" : "";
                    return (
                      <div className="g-track" key={t.id}>
                        <div className="g-ticks">{weeks.map((_, i) => <i key={i} style={{ flex: `1 0 ${weekPx}px` }} />)}</div>
                        <div className={`g-bar ${cls}`} style={{ left: x, width: w }} onClick={() => onOpen(t.id)} title={t.title} />
                        <div className="g-blabel" style={{ left: x + w + 8 }}>{t.progress}%</div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="g-today" style={{ left: todayX }} />
            </div>
          </div>
        </div>
      </div>

      <div className="g-legend">
        <span><i style={{ background: "#C4CBD8" }} /> A fazer</span>
        <span><i style={{ background: "#1769F6" }} /> Em andamento</span>
        <span><i style={{ background: "#F79009" }} /> Em revisão</span>
        <span><i style={{ background: "#12B76A" }} /> Concluída</span>
        <span><i style={{ background: "#E23A3A" }} /> Atrasada</span>
        <div className="g-zoom">
          <button onClick={() => setWeekPx(p => Math.max(56, p - 16))}><Minus size={14} /></button>
          <span style={{ fontSize: 12 }}>Zoom</span>
          <button onClick={() => setWeekPx(p => Math.min(180, p + 16))}><Plus size={14} /></button>
        </div>
      </div>
    </div>
  );
}
