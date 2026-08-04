import { useMemo, useState } from "react";
import {
  MoreHorizontal, Plus, Calendar, MessageSquare, Paperclip, CheckSquare,
  X, Folder, Pencil, Check,
} from "lucide-react";
import { hashColor, initials, daysDiff, fmtDate, type TskTask } from "./tsk02-list";
import "@/tsk0304.css";
import { useStageIndex, stageInfoOf } from "@/lib/task-types";


const COLS: { key: TskTask["status"]; label: string; color: string }[] = [
  { key: "todo", label: "A fazer", color: "#98A2B3" },
  { key: "in_progress", label: "Em andamento", color: "#1769F6" },
  { key: "review", label: "Em revisão", color: "#F79009" },
  { key: "done", label: "Concluídas", color: "#12B76A" },
];
const PRIORITY_LABEL: Record<TskTask["priority"], string> = {
  low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente", critical: "Crítica",
};
const STATUS_LABEL: Record<TskTask["status"], string> = {
  todo: "A fazer", in_progress: "Em andamento", review: "Em revisão", done: "Concluída",
};

type Props = {
  tasks: TskTask[];
  projectName: (id: string | null) => string;
  person: (id: string | null) => { name: string; role: string };
  onOpen: (id: string) => void;
  onNew: () => void;
  onStatusChange: (id: string, status: TskTask["status"]) => void;
};

/** TSK-03 — Quadro (kanban) com painel lateral de detalhe. */
export function Tsk03Board({ tasks, projectName, person, onOpen, onNew, onStatusChange }: Props) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [panel, setPanel] = useState<string | null>(null);

  const byStatus = useMemo(() => {
    const m: Record<string, TskTask[]> = { todo: [], in_progress: [], review: [], done: [] };
    for (const t of tasks) m[t.status]?.push(t);
    return m;
  }, [tasks]);

  const sel = tasks.find(t => t.id === panel) ?? null;

  return (
    <>
      <div className="b-board">
        {COLS.map(col => (
          <div
            key={col.key}
            className={`b-col ${over === col.key ? "over" : ""}`}
            onDragOver={e => { e.preventDefault(); setOver(col.key); }}
            onDragLeave={() => setOver(o => (o === col.key ? null : o))}
            onDrop={() => {
              if (drag) {
                const t = tasks.find(x => x.id === drag);
                if (t && t.status !== col.key) onStatusChange(drag, col.key);
              }
              setDrag(null); setOver(null);
            }}
          >
            <div className="b-colh">
              <span className="k-av" style={{ width: 8, height: 8, flex: "0 0 8px", background: col.color }} />
              <span className="ttl">{col.label}</span>
              <span className="cnt">{byStatus[col.key].length}</span>
              <button className="dots" onClick={onNew} title="Nova tarefa"><MoreHorizontal size={16} /></button>
            </div>

            {byStatus[col.key].map(t => {
              const pn = projectName(t.project_id);
              const per = person(t.assignee_id);
              const late = !!t.due_date && t.status !== "done" && daysDiff(t.due_date) < 0;
              const subs = t.subtasks ?? [];
              const doneSubs = subs.filter(s => s.done).length;
              return (
                <div
                  key={t.id}
                  className={`b-card ${panel === t.id ? "on" : ""}`}
                  draggable
                  onDragStart={() => setDrag(t.id)}
                  onDragEnd={() => { setDrag(null); setOver(null); }}
                  onClick={() => setPanel(t.id)}
                >
                  <div className="ct">{t.title}</div>
                  <div className="cp"><Folder size={12} /> {pn}</div>
                  <div className="cm">
                    {(() => { const si = stageInfoOf(t, stageIndex); return (
                      <span className="k-stagename"><i style={{ background: si.color }} />{si.name}</span>
                    ); })()}
                    <span className={`k-pill pr-${t.priority}`}>{PRIORITY_LABEL[t.priority]}</span>
                  </div>

                  <div className="cm">
                    <span className="av-sm" style={{ background: hashColor(per.name) }}>{initials(per.name)}</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{per.name}</span>
                    {t.due_date && (
                      <span className={`cdate ${late ? "late" : ""}`}><Calendar size={12} /> {fmtDate(t.due_date)}</span>
                    )}
                  </div>
                  <div className="cfoot">
                    <span><MessageSquare size={12} /> {t.comments_count ?? 0}</span>
                    <span><Paperclip size={12} /> {t.attachments_count ?? 0}</span>
                    <span className={subs.length > 0 && doneSubs === subs.length ? "ok" : ""}>
                      <CheckSquare size={12} /> {doneSubs}/{subs.length}
                    </span>
                  </div>
                </div>
              );
            })}

            <button className="b-newtask" onClick={onNew}><Plus size={14} /> Nova tarefa</button>
          </div>
        ))}
      </div>

      {sel && (
        <div className="b-panelwrap">
          <div className="b-scrim" onClick={() => setPanel(null)} />
          <aside className="b-panel">
            <div className="b-ph">
              <div className="row">
                <h3>{sel.title}</h3>
                <button className="k-iconbtn" onClick={() => onOpen(sel.id)} title="Abrir tarefa completa"><MoreHorizontal size={17} /></button>
                <button className="k-iconbtn" onClick={() => setPanel(null)}><X size={18} /></button>
              </div>
              <div className="pills">
                <span className={`k-pill pr-${sel.priority}`}>{PRIORITY_LABEL[sel.priority]}</span>
                <span className={`k-pill st-${sel.status}`}>{STATUS_LABEL[sel.status]}</span>
                <span className="k-pill st-todo"><Folder size={12} style={{ marginRight: 6 }} />{projectName(sel.project_id)}</span>
              </div>
            </div>

            <div className="b-pbody">
              <div className="b-grid">
                <div>
                  <div className="gl">Responsável</div>
                  <div className="gv">
                    <span className="av-sm" style={{ width: 22, height: 22, flex: "0 0 22px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", background: hashColor(person(sel.assignee_id).name) }}>
                      {initials(person(sel.assignee_id).name)}
                    </span>
                    {person(sel.assignee_id).name}
                  </div>
                  <div className="gs">{person(sel.assignee_id).role}</div>
                </div>
                <div>
                  <div className="gl">Prazo</div>
                  <div className="gv"><Calendar size={13} /> {sel.due_date ? fmtDate(sel.due_date) : "—"}</div>
                  {sel.due_date && (
                    <div className={`gs ${daysDiff(sel.due_date) < 0 && sel.status !== "done" ? "late" : ""}`}>
                      {daysDiff(sel.due_date) < 0 ? `${Math.abs(daysDiff(sel.due_date))} dias de atraso` : `Vence em ${daysDiff(sel.due_date)} dias`}
                    </div>
                  )}
                </div>
                <div>
                  <div className="gl">Criada em</div>
                  <div className="gv">{sel.created_at ? new Date(sel.created_at).toLocaleDateString("pt-BR") : "—"}</div>
                </div>
                <div>
                  <div className="gl">Progresso</div>
                  <div className="gv">{sel.progress}%</div>
                </div>
              </div>

              <div className="b-sec">
                <h4>Descrição</h4>
                <p className="b-desc">{sel.description || "Sem descrição cadastrada."}</p>
              </div>

              <div className="b-sec">
                <h4>
                  Checklist / Subtarefas
                  <span className="r">
                    {(sel.subtasks ?? []).filter(s => s.done).length} de {(sel.subtasks ?? []).length} concluídas
                  </span>
                  <span className="b-progress">
                    <i style={{ width: `${(sel.subtasks?.length ?? 0) ? ((sel.subtasks!.filter(s => s.done).length / sel.subtasks!.length) * 100) : 0}%` }} />
                  </span>
                </h4>
                {(sel.subtasks ?? []).length === 0 ? (
                  <div className="b-empty2">Nenhuma subtarefa cadastrada.</div>
                ) : sel.subtasks!.map(s => (
                  <div key={s.id} className="b-sub">
                    <input type="checkbox" checked={s.done} readOnly />
                    <span className={s.done ? "done" : ""}>{s.title}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="b-pf">
              <button className="k-btn" onClick={() => onOpen(sel.id)}><Pencil size={15} /> Editar tarefa</button>
              <span className="grow" />
              <button
                className="k-btn primary"
                onClick={() => { onStatusChange(sel.id, "done"); setPanel(null); }}
                disabled={sel.status === "done"}
              >
                <Check size={15} /> Marcar como concluída
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
