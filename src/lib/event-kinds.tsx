import { Calendar, PackageCheck, Building2, Palmtree, CheckSquare, Video } from "lucide-react";

export type EventKind = "meeting" | "delivery" | "internal" | "holiday" | "task";

export type EventKindMeta = {
  label: string;
  /** Descrição curta usada como subtítulo padrão. */
  hint: string;
  icon: any;
  /** Chip/badge com contraste alto (fundo sólido). */
  solid: string;
  /** Chip suave, para fundos claros e escuros. */
  soft: string;
  /** Cor do ponto / barra lateral. */
  dot: string;
  /** Cor de borda esquerda. */
  bar: string;
};

export const EVENT_KINDS: Record<EventKind, EventKindMeta> = {
  meeting: {
    label: "Reunião", hint: "Reunião", icon: Video,
    solid: "bg-blue-600 text-white border-blue-600",
    soft: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40",
    dot: "bg-blue-600", bar: "border-blue-600",
  },
  delivery: {
    label: "Entrega", hint: "Entrega", icon: PackageCheck,
    solid: "bg-emerald-600 text-white border-emerald-600",
    soft: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
    dot: "bg-emerald-600", bar: "border-emerald-600",
  },
  internal: {
    label: "Interno", hint: "Compromisso interno", icon: Building2,
    solid: "bg-violet-600 text-white border-violet-600",
    soft: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/40",
    dot: "bg-violet-600", bar: "border-violet-600",
  },
  holiday: {
    label: "Feriado", hint: "Feriado", icon: Palmtree,
    solid: "bg-amber-500 text-white border-amber-500",
    soft: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40",
    dot: "bg-amber-500", bar: "border-amber-500",
  },
  task: {
    label: "Tarefa", hint: "Tarefa agendada", icon: CheckSquare,
    solid: "bg-slate-700 text-white border-slate-700",
    soft: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/40",
    dot: "bg-slate-600", bar: "border-slate-600",
  },
};

export const FALLBACK_EVENT_KIND: EventKindMeta = {
  label: "Compromisso", hint: "Compromisso", icon: Calendar,
  solid: "bg-primary text-primary-foreground border-primary",
  soft: "bg-primary/15 text-primary border-primary/40",
  dot: "bg-primary", bar: "border-primary",
};

export function eventKindMeta(kind: string | null | undefined): EventKindMeta {
  return EVENT_KINDS[(kind ?? "") as EventKind] ?? FALLBACK_EVENT_KIND;
}

export const EVENT_KIND_LIST = Object.entries(EVENT_KINDS) as [EventKind, EventKindMeta][];
