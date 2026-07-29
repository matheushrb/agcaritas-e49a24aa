import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckSquare, Calendar, DollarSign, ShieldCheck, Clock, ArrowUpRight,
  FolderKanban, Users, TrendingUp, Flame, Star, CalendarDays, CalendarRange,
} from "lucide-react";

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const hhmm = (d: string | Date) =>
  new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const isOpen = (t: any) => !["done", "completed", "cancelled"].includes(String(t.status));

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/* ------------------------------------------------------------------ *
 * Faixa de indicadores rápidos (pills)                                *
 * ------------------------------------------------------------------ */

export function DayQuickStatsPanel({ data }: { data: any }) {
  const { data: pendingAmount = 0 } = useQuery({
    queryKey: ["dashboard-pending-receivables"],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoices")
        .select("total, amount, status")
        .not("status", "in", "(paid,cancelled)");
      return (data ?? []).reduce(
        (s: number, i: any) => s + (Number(i.total ?? i.amount) || 0),
        0,
      );
    },
  });

  const today = startOfToday();
  const limit = new Date(today); limit.setDate(today.getDate() + 1);

  const tasksToday = (data.tasks ?? []).filter((t: any) => {
    if (!isOpen(t) || !t.due_date) return false;
    const d = new Date(t.due_date); d.setHours(0, 0, 0, 0);
    return d.getTime() < limit.getTime();
  }).length;

  const meetings = (data.events ?? []).length;
  const approvals = (data.proposals ?? []).filter(
    (p: any) => p.status === "sent" || p.status === "viewed" || p.status === "pending",
  ).length;

  const pills = [
    { icon: CheckSquare, value: String(tasksToday), label: "tarefas para hoje", tone: "bg-primary/10 text-primary", to: "/tasks" },
    { icon: Calendar, value: String(meetings), label: "reuniões agendadas", tone: "bg-info/15 text-info", to: "/calendar" },
    { icon: DollarSign, value: BRL(pendingAmount), label: "pendente de recebimento", tone: "bg-success/10 text-success", to: "/finance" },
    { icon: ShieldCheck, value: String(approvals), label: "aguardando você", tone: "bg-warning/15 text-warning", to: "/proposals" },
  ];

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {pills.map((p, i) => (
        <Link
          key={i}
          to={p.to as any}
          className="card-surface flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
        >
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${p.tone}`}>
            <p.icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-display text-lg font-bold leading-none">{p.value}</span>
            <span className="mt-1 block truncate text-[11px] text-muted-foreground">{p.label}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Central do dia — timeline unificada com abas por tipo               *
 * ------------------------------------------------------------------ */

type FeedKind = "task" | "meeting" | "finance" | "approval";

const KIND_META: Record<FeedKind, { icon: any; tone: string; label: string; dot: string }> = {
  task:     { icon: CheckSquare, tone: "bg-primary/10 text-primary", label: "Tarefa",     dot: "bg-primary" },
  meeting:  { icon: Calendar,    tone: "bg-info/15 text-info",       label: "Reunião",    dot: "bg-info" },
  finance:  { icon: DollarSign,  tone: "bg-success/10 text-success", label: "Financeiro", dot: "bg-success" },
  approval: { icon: ShieldCheck, tone: "bg-warning/15 text-warning", label: "Aprovação",  dot: "bg-warning" },
};

type FeedItem = {
  id: string; kind: FeedKind; time: string; title: string;
  sub?: string; urgent?: boolean; to: any;
};

export function DayCenterPanel({ data }: { data: any }) {
  const [tab, setTab] = useState<"all" | FeedKind>("all");

  const all = useMemo<FeedItem[]>(() => {
    const today = startOfToday();
    const limit = new Date(today); limit.setDate(today.getDate() + 1);
    const feed: FeedItem[] = [];

    for (const ev of data.events ?? []) {
      feed.push({
        id: `ev-${ev.id}`, kind: "meeting", time: hhmm(ev.starts_at),
        title: ev.title, sub: ev.description ?? "Reunião",
        to: { to: "/calendar", search: { d: String(ev.starts_at).slice(0, 10) } },
      });
    }

    for (const t of (data.tasks ?? []).filter(isOpen)) {
      if (!t.due_date) continue;
      const d = new Date(t.due_date); d.setHours(0, 0, 0, 0);
      if (d.getTime() >= limit.getTime()) continue;
      const late = d.getTime() < today.getTime();
      feed.push({
        id: `t-${t.id}`, kind: "task",
        time: late ? "Atrasada" : "Hoje",
        title: t.title,
        sub: `${t.progress ?? 0}% concluída`,
        urgent: true,
        to: { to: "/tasks", search: { open: t.id } },
      });
    }

    for (const p of (data.proposals ?? []).filter(
      (p: any) => p.status === "sent" || p.status === "viewed" || p.status === "pending",
    )) {
      feed.push({
        id: `p-${p.id}`, kind: "approval", time: "Pendente",
        title: "Proposta aguardando aprovação",
        sub: p.total_value ? BRL(Number(p.total_value)) : undefined,
        to: { to: "/proposals" },
      });
    }

    const pipeline = (data.proposals ?? [])
      .filter((p: any) => p.status !== "approved" && p.status !== "declined")
      .reduce((s: number, p: any) => s + (Number(p.total_value) || 0), 0);
    if (pipeline > 0) {
      feed.push({
        id: "fin-pipeline", kind: "finance", time: "Mês",
        title: "Pipeline em negociação", sub: BRL(pipeline), to: { to: "/finance" },
      });
    }

    return feed;
  }, [data]);

  const countOf = (k: FeedKind) => all.filter(i => i.kind === k).length;
  const items = tab === "all" ? all : all.filter(i => i.kind === tab);

  const tabs: Array<{ id: "all" | FeedKind; label: string; count: number }> = [
    { id: "all", label: "Tudo", count: all.length },
    { id: "task", label: "Tarefas", count: countOf("task") },
    { id: "meeting", label: "Reuniões", count: countOf("meeting") },
    { id: "finance", label: "Financeiro", count: countOf("finance") },
    { id: "approval", label: "Aprovações", count: countOf("approval") },
  ];

  return (
    <Card className="card-surface flex h-full flex-col p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">Central do dia</h3>
          <p className="text-[11px] capitalize text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Hoje
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-medium transition-colors ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                tab === t.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-3 flex-1 space-y-1">
        {items.length === 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" /> Nada por aqui neste filtro.
          </div>
        )}
        {items.slice(0, 8).map(it => {
          const meta = KIND_META[it.kind];
          const Icon = meta.icon;
          return (
            <Link
              key={it.id}
              {...(it.to as any)}
              className="grid grid-cols-[auto_auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-transparent px-2 py-2.5 transition-colors hover:border-border hover:bg-muted/40"
            >
              <span className="w-12 shrink-0 text-[11px] font-medium text-muted-foreground">{it.time}</span>
              <span className={`h-2 w-2 shrink-0 rounded-full ${it.urgent ? "bg-destructive" : meta.dot}`} />
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${meta.tone}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{it.title}</span>
                {it.sub && <span className="block truncate text-[11px] text-muted-foreground">{it.sub}</span>}
              </span>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ${meta.tone}`}>
                {meta.label}
              </span>
            </Link>
          );
        })}
      </div>

      <Link
        to="/tasks"
        className="mt-3 flex items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary"
      >
        Ver todas as atividades <ArrowUpRight className="h-3 w-3" />
      </Link>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Prioridades do dia — agrupadas por nível                            *
 * ------------------------------------------------------------------ */

type Level = "urgent" | "important" | "today" | "week";

const LEVEL_META: Record<Level, { icon: any; label: string; text: string; border: string }> = {
  urgent:    { icon: Flame,         label: "Urgente",      text: "text-destructive", border: "border-l-destructive" },
  important: { icon: Star,          label: "Importante",   text: "text-warning",     border: "border-l-warning" },
  today:     { icon: CalendarDays,  label: "Hoje",         text: "text-info",        border: "border-l-info" },
  week:      { icon: CalendarRange, label: "Esta semana",  text: "text-muted-foreground", border: "border-l-border" },
};

export function PrioritiesPanel({ data }: { data: any }) {
  const groups = useMemo(() => {
    const today = startOfToday();
    const limit = new Date(today); limit.setDate(today.getDate() + 1);
    const week = new Date(today); week.setDate(today.getDate() + 7);

    const level = (t: any): Level => {
      const p = String(t.priority ?? "low");
      const d = t.due_date ? new Date(t.due_date) : null;
      if (d) d?.setHours(0, 0, 0, 0);
      if (p === "critical" || p === "urgent" || (d && d.getTime() < today.getTime())) return "urgent";
      if (p === "high") return "important";
      if (d && d.getTime() < limit.getTime()) return "today";
      return "week";
    };

    const open = (data.tasks ?? []).filter(isOpen).filter((t: any) => {
      if (!t.due_date) return true;
      const d = new Date(t.due_date); d.setHours(0, 0, 0, 0);
      return d.getTime() < week.getTime();
    });

    const out: Record<Level, any[]> = { urgent: [], important: [], today: [], week: [] };
    for (const t of open) out[level(t)].push(t);
    (Object.keys(out) as Level[]).forEach(k => { out[k] = out[k].slice(0, 3); });
    return out;
  }, [data]);

  const order: Level[] = ["urgent", "important", "today", "week"];
  const empty = order.every(l => groups[l].length === 0);

  return (
    <Card className="card-surface flex h-full flex-col p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">Prioridades do dia</h3>
          <p className="text-[11px] text-muted-foreground">Foque nestas primeiro.</p>
        </div>
        <Link to="/tasks" className="shrink-0 text-[11px] text-primary hover:underline">Editar</Link>
      </div>

      <div className="mt-4 flex-1 space-y-2">
        {empty && (
          <p className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            Nenhuma prioridade aberta.
          </p>
        )}
        {order.map(l => {
          const list = groups[l];
          if (!list.length) return null;
          const m = LEVEL_META[l];
          const Icon = m.icon;
          return (
            <div key={l} className={`rounded-2xl border border-border border-l-2 ${m.border} bg-muted/30 p-3`}>
              <p className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${m.text}`}>
                <Icon className="h-3 w-3" /> {m.label}
              </p>
              <div className="mt-2 space-y-1.5">
                {list.map((t: any) => (
                  <Link
                    key={t.id}
                    to="/tasks"
                    search={{ open: t.id } as any}
                    className="block rounded-lg px-1 py-0.5 hover:bg-muted"
                  >
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {t.due_date
                        ? `Prazo: ${new Date(t.due_date).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}`
                        : "Sem prazo"}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Link to="/tasks" className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
        Ver todas <ArrowUpRight className="h-3 w-3" />
      </Link>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Agenda de hoje — timeline por hora                                  *
 * ------------------------------------------------------------------ */

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export function AgendaTodayPanel({ data }: { data: any }) {
  const events = (data.events ?? []) as any[];

  const byHour = useMemo(() => {
    const map: Record<number, any[]> = {};
    for (const ev of events) {
      const h = new Date(ev.starts_at).getHours();
      const slot = Math.min(Math.max(h, HOURS[0]), HOURS[HOURS.length - 1]);
      (map[slot] ??= []).push(ev);
    }
    return map;
  }, [events]);

  return (
    <Card className="card-surface flex h-full flex-col p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">Agenda de hoje</h3>
          <p className="text-[11px] capitalize text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
        </div>
        <Link to="/calendar" className="shrink-0 text-[11px] text-primary hover:underline">Ver agenda</Link>
      </div>

      <div className="mt-4 flex-1 space-y-1.5">
        {HOURS.map(h => {
          const slot = byHour[h] ?? [];
          const label = `${String(h).padStart(2, "0")}:00`;
          if (!slot.length) {
            return (
              <div key={h} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                <span className="w-10 shrink-0 text-right text-[10px] text-muted-foreground">{label}</span>
                <span className="flex items-center gap-2">
                  <span className="h-px flex-1 bg-border" />
                  {events.length === 0 && h === HOURS[0] && (
                    <span className="text-[11px] text-muted-foreground">Livre</span>
                  )}
                </span>
              </div>
            );
          }
          return (
            <div key={h} className="space-y-1.5">
              {slot.map(ev => (
                <Link
                  key={ev.id}
                  to="/calendar"
                  search={{ d: String(ev.starts_at).slice(0, 10) } as any}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3"
                >
                  <span className="w-10 shrink-0 pt-1.5 text-right text-[10px] text-muted-foreground">
                    {hhmm(ev.starts_at)}
                  </span>
                  <span className="min-w-0 rounded-xl border-l-2 border-primary bg-muted/40 px-3 py-1.5 hover:bg-muted">
                    <span className="block truncate text-sm font-medium">{ev.title}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {ev.description || ev.kind || "Compromisso"}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          );
        })}
      </div>

      <Link
        to="/calendar"
        search={{ new: 1 } as any}
        className="mt-3 flex items-center justify-center rounded-2xl border border-dashed border-border py-2 text-[11px] text-muted-foreground hover:border-primary hover:text-primary"
      >
        + Novo compromisso
      </Link>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Coluna de KPIs — Receita, Projetos, Clientes                        *
 * ------------------------------------------------------------------ */

function AreaSpark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 100, h = 40;
  const pts = values.map((v, i) => {
    const x = values.length > 1 ? (i / (values.length - 1)) * w : 0;
    const y = h - (v / max) * (h - 6) - 3;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-14 w-full overflow-visible">
      <path d={area} fill="var(--primary)" opacity={0.12} />
      <path d={line} fill="none" stroke="var(--primary)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {last && <circle cx={last[0]} cy={last[1]} r={2.5} fill="var(--primary)" />}
    </svg>
  );
}

export function RevenueMonthPanel() {
  const { data } = useQuery({
    queryKey: ["dashboard-revenue-month"],
    queryFn: async () => {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
      const { data } = await supabase
        .from("invoices")
        .select("total, amount, issue_date, status")
        .gte("issue_date", from);
      return data ?? [];
    },
  });

  const { data: goal = 0 } = useQuery({
    queryKey: ["dashboard-revenue-goal"],
    queryFn: async () => {
      const { data } = await supabase.from("organizations").select("pricing_settings").limit(1).maybeSingle();
      const s = (data as any)?.pricing_settings ?? {};
      return Number(s.monthly_revenue_goal ?? s.revenue_goal ?? 0) || 0;
    },
  });

  const now = new Date();
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("pt-BR", { month: "short" }), value: 0 };
  });
  for (const inv of (data ?? []) as any[]) {
    if (!inv.issue_date) continue;
    const d = new Date(inv.issue_date);
    const b = buckets.find(x => x.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (b) b.value += Number(inv.total ?? inv.amount) || 0;
  }
  const current = buckets[buckets.length - 1]?.value ?? 0;
  const previous = buckets[buckets.length - 2]?.value ?? 0;
  const delta = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;
  const progress = goal > 0 ? Math.min(Math.round((current / goal) * 100), 100) : 0;

  return (
    <Card className="card-surface p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Receita do mês</p>
        <Link to="/finance" className="shrink-0 text-[11px] text-primary hover:underline">Ver relatório</Link>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <p className="font-display text-2xl font-bold leading-none">{BRL(current)}</p>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
          delta < 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
        }`}>
          <TrendingUp className="h-3 w-3" /> {delta}%
        </span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">vs. mês anterior</p>

      <div className="mt-3"><AreaSpark values={buckets.map(b => b.value)} /></div>
      <div className="mt-1 flex justify-between text-[9px] uppercase text-muted-foreground">
        {buckets.map(b => <span key={b.key}>{b.label.replace(".", "")}</span>)}
      </div>

      {goal > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Meta: {BRL(goal)}</span>
            <span className={progress >= 100 ? "font-semibold text-success" : "font-semibold"}>{progress}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${progress >= 100 ? "bg-success" : "bg-primary"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

export function ActiveProjectsPanel({ data }: { data: any }) {
  const projects = (data.projects ?? []) as any[];
  const count = (s: string[]) => projects.filter(p => s.includes(String(p.status))).length;

  const slices = [
    { label: "Prospecção", value: count(["planning"]), color: "var(--info)" },
    { label: "Em andamento", value: count(["active", "review", "paused"]), color: "var(--primary)" },
    { label: "Concluídos", value: count(["done"]), color: "var(--success)" },
  ];
  const total = slices.reduce((s, x) => s + x.value, 0);
  const active = count(["active", "review", "planning", "paused"]);

  let acc = 0;
  const stops = slices
    .filter(s => s.value > 0)
    .map(s => {
      const from = (acc / Math.max(total, 1)) * 360;
      acc += s.value;
      const to = (acc / Math.max(total, 1)) * 360;
      return `${s.color} ${from}deg ${to}deg`;
    })
    .join(", ");

  return (
    <Card className="card-surface p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Projetos ativos</p>
        <Link to="/projects" className="shrink-0 text-[11px] text-primary hover:underline">Ver todos</Link>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div
          className="grid h-20 w-20 shrink-0 place-items-center rounded-full"
          style={{ background: total > 0 ? `conic-gradient(${stops})` : "var(--muted)" }}
        >
          <div className="grid h-14 w-14 place-items-center rounded-full bg-card">
            <span className="font-display text-lg font-bold leading-none">{active}</span>
            <span className="text-[9px] text-muted-foreground">ativos</span>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          {slices.map(s => (
            <div key={s.label} className="flex items-center gap-2 text-[11px]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
              <span className="shrink-0 font-semibold">{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function ActiveClientsPanel() {
  const { data } = useQuery({
    queryKey: ["dashboard-active-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, status, name, created_at").limit(500);
      return data ?? [];
    },
  });
  const clients = (data ?? []) as any[];
  const active = clients.filter(c => !["inactive", "archived", "lost"].includes(String(c.status)));

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const newThisMonth = active.filter(c => c.created_at && new Date(c.created_at) >= monthStart).length;

  const shown = active.slice(0, 7);
  const rest = Math.max(active.length - shown.length, 0);

  return (
    <Card className="card-surface p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Clientes ativos</p>
        <Link to="/clients" className="shrink-0 text-[11px] text-primary hover:underline">Ver todos</Link>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <p className="font-display text-2xl font-bold leading-none">{active.length}</p>
        {newThisMonth > 0 && (
          <span className="text-[11px] font-medium text-success">+{newThisMonth} este mês</span>
        )}
      </div>

      <div className="mt-4 flex items-center">
        {shown.map((c, i) => (
          <span
            key={c.id}
            title={c.name}
            className="grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-primary/10 text-[10px] font-bold text-primary"
            style={{ marginLeft: i === 0 ? 0 : -8 }}
          >
            {String(c.name ?? "?").slice(0, 2).toUpperCase()}
          </span>
        ))}
        {rest > 0 && (
          <span
            className="grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-muted text-[10px] font-bold text-muted-foreground"
            style={{ marginLeft: -8 }}
          >
            +{rest}
          </span>
        )}
        {active.length === 0 && <p className="text-xs text-muted-foreground">Nenhum cliente cadastrado.</p>}
      </div>

      <Link to="/clients" className="mt-4 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
        <Users className="h-3 w-3" /> Ver clientes
      </Link>
    </Card>
  );
}

export function KpiColumnPanel({ data }: { data: any }) {
  return (
    <div className="flex h-full flex-col gap-4">
      <RevenueMonthPanel />
      <ActiveProjectsPanel data={data} />
      <ActiveClientsPanel />
    </div>
  );
}

export { FolderKanban };
