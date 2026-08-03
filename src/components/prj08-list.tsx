import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  CircleDot,
  Circle,
  ExternalLink,
  LogIn,
  MoreHorizontal,
  Pencil,
  Rocket,
} from "lucide-react";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ProjectPreviewData, ProjectPreviewStatus } from "@/components/project-preview-sheet";
import "@/prj08.css";

type Member = { user_id: string; name: string };

const STATUS: Record<ProjectPreviewStatus, { label: string; cls: string }> = {
  planning: { label: "Planejamento", cls: "neutral" },
  active: { label: "Em andamento", cls: "info" },
  review: { label: "Revisão", cls: "info" },
  done: { label: "Concluído", cls: "ok" },
  paused: { label: "Pausado", cls: "danger" },
};

const CLIENT_DOTS = ["#e14545", "#2f6bef", "#8b5cf6", "#e0912e", "#1fa971", "#0ea5e9", "#64748b"];

function dotColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return CLIENT_DOTS[h % CLIENT_DOTS.length];
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
function cleanType(v?: string | null) {
  if (!v || UUID.test(v)) return null;
  return v;
}

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function parseDate(value: string) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return parseDate(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function daysInfo(endDate: string | null, status: ProjectPreviewStatus) {
  if (!endDate) return { text: "Sem prazo", over: false };
  if (status === "done") return { text: "Concluído", over: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((parseDate(endDate).getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { text: `${Math.abs(days)} dias em atraso`, over: true };
  return { text: `${days} dias restantes`, over: false };
}

function healthOf(p: ProjectPreviewData) {
  if (p.status === "done") return { label: "Concluído", bg: "#eef1f6", color: "#5b6779", dot: "#5b6779" };
  if (p.overdueTasks >= 3) return { label: "Crítico", bg: "#fdeaea", color: "#e14545", dot: "#e14545" };
  if (p.overdueTasks > 0) return { label: "Atenção", bg: "#fdf1e0", color: "#c9781a", dot: "#e0912e" };
  return { label: "Saudável", bg: "#e6f7ef", color: "#1fa971", dot: "#1fa971" };
}

function Avatars({ members }: { members: Member[] }) {
  const shown = members.slice(0, 3);
  const rest = members.length - shown.length;
  if (members.length === 0) return <span className="text-[11.5px] text-[#98a2b3]">—</span>;
  return (
    <div className="p8-stack">
      {shown.map((m) => (
        <span key={m.user_id} className="p8-av" style={{ background: dotColor(m.name) }} title={m.name}>
          {initials(m.name)}
        </span>
      ))}
      {rest > 0 && <span className="p8-more">+{rest}</span>}
    </div>
  );
}

/* ============================ TABELA (PRJ-08) ============================ */

export function Prj08Table({
  rows,
  membersByProject,
  selectedId,
  onOpen,
}: {
  rows: (ProjectPreviewData & { doneTasks?: number })[];
  membersByProject: Record<string, Member[]>;
  selectedId?: string | null;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="prj08-table">
      <table>
        <thead>
          <tr>
            <th>Projeto</th>
            <th>Cliente</th>
            <th>Status</th>
            <th>Progresso</th>
            <th>Prazo final</th>
            <th>Responsável</th>
            <th>Equipe</th>
            <th className="right">Receita prevista</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const members = membersByProject[p.id] ?? [];
            const owner = members[0];
            const due = daysInfo(p.endDate, p.status);
            const st = STATUS[p.status];
            const billed = p.status === "done" ? p.revenue : Math.round(p.revenue * (p.progress / 100));
            const billedPct = p.revenue > 0 ? Math.round((billed / p.revenue) * 100) : 0;
            return (
              <tr
                key={p.id}
                className={cn(selectedId === p.id && "selected")}
                onClick={() => onOpen(p.id)}
              >
                <td>
                  <div className="p8-proj">
                    <span className="p8-proj-ico">
                      <Rocket />
                    </span>
                    <div>
                      <div className="p8-proj-name">{p.name}</div>
                      <div className="p8-proj-sub">{cleanType(p.projectType) || cleanType(p.description) || "Projeto"}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="p8-client">
                    <i className="p8-dot" style={{ background: dotColor(p.clientName || "Interno") }} />
                    {p.clientName || "Interno"}
                  </span>
                </td>
                <td>
                  <span className={cn("p8-badge", st.cls)}>{st.label}</span>
                </td>
                <td>
                  <div className="p8-progress">
                    <span>{p.progress}%</span>
                    <i className="p8-bar">
                      <i style={{ width: `${p.progress}%` }} />
                    </i>
                  </div>
                </td>
                <td>
                  <div className="p8-date">{formatDate(p.endDate)}</div>
                  <div className={cn("p8-date-sub", due.over && "over")}>{due.text}</div>
                </td>
                <td>
                  {owner ? (
                    <span className="p8-owner">
                      <span className="p8-av" style={{ background: dotColor(owner.name) }}>
                        {initials(owner.name)}
                      </span>
                      {owner.name}
                    </span>
                  ) : (
                    <span className="text-[11.5px] text-[#98a2b3]">—</span>
                  )}
                </td>
                <td>
                  <Avatars members={members} />
                </td>
                <td style={{ textAlign: "right" }}>
                  <div className="p8-rev">{money(p.revenue)}</div>
                  <div className="p8-rev-sub">
                    Faturado: {money(billed)} ({billedPct}%)
                  </div>
                </td>
                <td>
                  <button type="button" className="p8-kebab" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal size={15} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ======================= PREVIEW LATERAL (PRJ-08) ======================= */

export function Prj08Preview({
  project,
  members = [],
  open,
  onOpenChange,
}: {
  project: (ProjectPreviewData & { doneTasks?: number }) | null;
  members?: Member[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!project) return null;
  const health = healthOf(project);
  const due = daysInfo(project.endDate, project.status);
  const owner = members[0];
  const billed = project.status === "done" ? project.revenue : Math.round(project.revenue * (project.progress / 100));
  const billedPct = project.revenue > 0 ? Math.round((billed / project.revenue) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 border-l p-0 sm:max-w-[420px]">
        <div className="prj08-panel">
          <div className="p8-body">
            <div className="flex items-start justify-between gap-3">
              <h2>{project.name}</h2>
            </div>

            <div className="p8-head-row">
              <span className="p8-health" style={{ background: health.bg, color: health.color }}>
                <i style={{ width: 7, height: 7, borderRadius: 99, background: health.dot }} />
                {health.label}
              </span>
              <button type="button" className="p8-kebab" style={{ border: "1px solid #e8ebf1", borderRadius: 9, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", color: "#7b879a" }}>
                <MoreHorizontal size={16} />
              </button>
            </div>

            <div style={{ marginTop: 16 }}>
              <div className="p8-label">Cliente</div>
              <div className="p8-value">{project.clientName || "Interno"}</div>
              {project.description && <p className="p8-desc">{project.description}</p>}
            </div>

            <div className="p8-grid2">
              <div>
                <div className="p8-label">Progresso</div>
                <div className="p8-progress" style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{project.progress}%</span>
                  <i className="p8-bar" style={{ display: "block", width: 84, height: 5, borderRadius: 99, background: "#e8ebf1", overflow: "hidden" }}>
                    <i style={{ display: "block", height: "100%", background: "#2f6bef", width: `${project.progress}%` }} />
                  </i>
                </div>
              </div>
              <div>
                <div className="p8-label">Prazo final</div>
                <div className="p8-value">{formatDate(project.endDate)}</div>
                <div className="p8-act-sub">{due.text}</div>
              </div>
              <div>
                <div className="p8-label">Responsável</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                  {owner ? (
                    <>
                      <span className="p8-av" style={{ background: dotColor(owner.name), width: 28, height: 28, fontSize: 10.5 }}>
                        {initials(owner.name)}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{owner.name}</span>
                    </>
                  ) : (
                    <span className="p8-act-sub">Não definido</span>
                  )}
                </div>
              </div>
              <div>
                <div className="p8-label">Equipe</div>
                <div style={{ marginTop: 8 }}>
                  <Avatars members={members} />
                </div>
              </div>
            </div>

            <div className="p8-sec-head" style={{ marginTop: 4 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Financeiro (resumo)</h3>
              <Link to="/projects/$projectId" params={{ projectId: project.id }} className="p8-link">
                Ver relatório <ExternalLink size={12} />
              </Link>
            </div>
            <div className="p8-fin">
              <div className="p8-fin-box">
                <em>Receita prevista</em>
                <strong>{money(project.revenue)}</strong>
              </div>
              <div className="p8-fin-box">
                <em>Faturado</em>
                <strong>
                  {money(billed)} <span style={{ fontSize: 11, color: "#7b879a", fontWeight: 600 }}>({billedPct}%)</span>
                </strong>
              </div>
            </div>

            <div className="p8-sec">
              <div className="p8-sec-head">
                <h3>Próximas entregas</h3>
              </div>
              <div className="p8-item">
                <CalendarDays color="#2f6bef" />
                <span>Prazo final do projeto</span>
                <span className="p8-when">{formatDate(project.endDate)}</span>
              </div>
              <div className="p8-item">
                {project.overdueTasks > 0 ? <CircleDot color="#e14545" /> : <Check color="#1fa971" />}
                <span>{project.overdueTasks > 0 ? `${project.overdueTasks} tarefa(s) em atraso` : "Nenhuma tarefa atrasada"}</span>
              </div>
              <div className="p8-item">
                <Circle color="#98a2b3" />
                <span>
                  {(project.doneTasks ?? 0)} de {project.totalTasks} tarefas concluídas
                </span>
              </div>
              <Link to="/projects/$projectId" params={{ projectId: project.id }} className="p8-link" style={{ marginTop: 8 }}>
                Ver linha do tempo completa <ArrowUpRight size={12} />
              </Link>
            </div>

            <div className="p8-sec">
              <div className="p8-sec-head">
                <h3>Detalhes</h3>
              </div>
              <div className="p8-item">
                <Building2 color="#7b879a" />
                <span>Tipo</span>
                <span className="p8-when">{cleanType(project.projectType) || "—"}</span>
              </div>
              <div className="p8-item">
                <CalendarDays color="#7b879a" />
                <span>Início</span>
                <span className="p8-when">{formatDate(project.startDate)}</span>
              </div>
              <div className="p8-item">
                <CircleDot color="#7b879a" />
                <span>Urgência</span>
                <span className="p8-when">{project.urgency || "—"}</span>
              </div>
            </div>
          </div>

          <div className="p8-foot">
            <button type="button" className="p8-btn ghost" onClick={() => onOpenChange(false)}>
              <Pencil /> Editar
            </button>
            <Link
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              className="p8-btn primary"
            >
              <LogIn /> Entrar no projeto
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
