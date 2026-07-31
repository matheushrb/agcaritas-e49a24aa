export type HealthLevel = "healthy" | "attention" | "risk" | "critical";

export const HEALTH_META: Record<HealthLevel, { label: string; className: string; dot: string }> = {
  healthy: { label: "Saudável", className: "bg-success/12 text-success", dot: "bg-success" },
  attention: { label: "Atenção", className: "bg-warning/15 text-warning", dot: "bg-warning" },
  risk: { label: "Em risco", className: "bg-destructive/12 text-destructive", dot: "bg-destructive" },
  critical: { label: "Crítico", className: "bg-destructive text-destructive-foreground", dot: "bg-destructive" },
};

type ProjectLike = { id: string; status?: string | null; end_date?: string | null };
type TaskLike = { project_id?: string | null; status?: string | null; due_date?: string | null };

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Saúde do projeto computada (não há campo no banco):
 * - atraso do prazo final e % de tarefas atrasadas definem o nível.
 * Usada no Dashboard (KPI "Projetos em risco") e na listagem/página de Projetos.
 */
export function computeProjectHealth(project: ProjectLike, tasks: TaskLike[]): HealthLevel {
  if (project.status === "done" || project.status === "completed") return "healthy";

  const today = startOfToday();
  const mine = tasks.filter(t => t.project_id === project.id);
  const open = mine.filter(t => t.status !== "done");
  const late = open.filter(t => t.due_date && new Date(t.due_date) < today);
  const lateRatio = open.length ? late.length / open.length : 0;

  const end = project.end_date ? new Date(project.end_date) : null;
  const daysToEnd = end ? Math.ceil((end.getTime() - today.getTime()) / 86_400_000) : null;

  if (daysToEnd !== null && daysToEnd < 0 && open.length > 0) return "critical";
  if (lateRatio >= 0.5 && late.length >= 2) return "critical";
  if (lateRatio >= 0.25 || (daysToEnd !== null && daysToEnd <= 3 && open.length > 0)) return "risk";
  if (late.length > 0 || (daysToEnd !== null && daysToEnd <= 7 && open.length > 0)) return "attention";
  return "healthy";
}

export function isAtRisk(level: HealthLevel) {
  return level === "risk" || level === "critical";
}
