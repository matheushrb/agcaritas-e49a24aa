import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FolderKanban,
  ListChecks,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type ProjectPreviewStatus = "planning" | "active" | "review" | "done" | "paused";

export type ProjectPreviewData = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectPreviewStatus;
  clientName: string | null;
  startDate: string | null;
  endDate: string | null;
  projectType?: string | null;
  urgency?: string | null;
  billingModel?: string | null;
  fixedValue?: number | null;
  monthlyValue?: number | null;
  totalTasks: number;
  overdueTasks: number;
  revenue: number;
  progress: number;
};

const STATUS_META: Record<ProjectPreviewStatus, { label: string; className: string }> = {
  planning: { label: "Planejamento", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  active: { label: "Ativo", className: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  review: { label: "Revisão", className: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  done: { label: "Concluído", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  paused: { label: "Pausado", className: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match ? new Date(+match[1], +match[2] - 1, +match[3]) : new Date(value);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function ProjectPreviewSheet({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectPreviewData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!project) return null;

  const status = STATUS_META[project.status];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto border-l border-border/80 bg-background p-0 sm:max-w-[520px]">
        <div className="flex min-h-full flex-col">
          <div className="border-b border-border/80 px-7 pb-6 pt-7">
            <SheetHeader className="space-y-4 text-left">
              <div className="flex items-start justify-between gap-4 pr-8">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge className={cn("rounded-md border-0 px-2.5 py-1 text-[11px] font-medium", status.className)}>
                      {status.label}
                    </Badge>
                    {project.urgency && (
                      <span className="text-[11px] font-medium text-muted-foreground">{project.urgency}</span>
                    )}
                  </div>
                  <SheetTitle className="text-2xl font-semibold tracking-[-0.035em]">{project.name}</SheetTitle>
                  <SheetDescription className="mt-2 line-clamp-3 text-sm leading-6">
                    {project.description || "Projeto sem descrição cadastrada."}
                  </SheetDescription>
                </div>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {project.clientName || "Projeto interno"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(project.startDate)} → {formatDate(project.endDate)}
                </span>
              </div>
            </SheetHeader>
          </div>

          <div className="flex-1 space-y-7 px-7 py-6">
            <section>
              <div className="mb-3 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Progresso</p>
                  <div className="mt-1 text-3xl font-semibold tracking-[-0.04em]">{project.progress}%</div>
                </div>
                <span className="text-xs text-muted-foreground">{project.totalTasks} tarefas</span>
              </div>
              <Progress value={project.progress} className="h-2 bg-muted" />
            </section>

            <section className="grid grid-cols-2 gap-3">
              <Metric icon={ListChecks} label="Tarefas" value={project.totalTasks.toString()} />
              <Metric
                icon={TriangleAlert}
                label="Atrasadas"
                value={project.overdueTasks.toString()}
                danger={project.overdueTasks > 0}
              />
              <Metric icon={CircleDollarSign} label="Receita prevista" value={formatMoney(project.revenue)} />
              <Metric icon={CheckCircle2} label="Concluído" value={`${project.progress}%`} />
            </section>

            <section className="rounded-xl border border-border/80 bg-card/70 p-4">
              <h3 className="mb-4 text-sm font-semibold">Informações do projeto</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                <Detail label="Tipo" value={project.projectType || "—"} icon={FolderKanban} />
                <Detail label="Cobrança" value={project.billingModel || "—"} icon={CircleDollarSign} />
                <Detail label="Início" value={formatDate(project.startDate)} icon={CalendarDays} />
                <Detail label="Final" value={formatDate(project.endDate)} icon={Clock3} />
              </div>
            </section>

            {project.overdueTasks > 0 && (
              <section className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Projeto exige atenção</p>
                  <p className="mt-1 text-xs leading-5 opacity-80">
                    Existem {project.overdueTasks} tarefa(s) vencida(s) vinculada(s) a este projeto.
                  </p>
                </div>
              </section>
            )}
          </div>

          <div className="sticky bottom-0 border-t border-border/80 bg-background/95 px-7 py-4 backdrop-blur">
            <Button asChild className="h-11 w-full rounded-lg bg-[#3659E3] text-white hover:bg-[#2F50CE]">
              <Link to="/projects/$projectId" params={{ projectId: project.id }}>
                Entrar no projeto
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  danger = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card p-4">
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-[#E9EDFC] text-[#3659E3] dark:bg-[#7E95F5]/10 dark:text-[#9FB0FF]">
        <Icon className="h-4 w-4" />
      </div>
      <div className={cn("text-xl font-semibold tracking-[-0.03em]", danger && "text-rose-600 dark:text-rose-400")}>{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Detail({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}
