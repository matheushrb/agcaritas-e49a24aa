import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckSquare, Calendar, DollarSign, ShieldCheck, Clock, ArrowUpRight,
  FolderKanban, Users, TrendingUp, CircleDot,
} from "lucide-react";

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const hhmm = (d: string | Date) =>
  new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const isOpen = (t: any) => !["done", "completed", "cancelled"].includes(String(t.status));

/* ------------------------------------------------------------------ *
 * Central do dia — timeline unificada com filtros por tipo            *
 * ------------------------------------------------------------------ */

type FeedKind = "task" | "meeting" | "finance" | "approval";

const TABS: Array<{ id: "all" | FeedKind; label: string }> = [
  { id: "all", label: "Tudo" },
  { id: "task", label: "Tarefas" },
  { id: "meeting", label: "Reuniões" },
  { id: "finance", label: "Financeiro" },
  { id: "approval", label: "Aprovações" },
];

const KIND_META: Record<FeedKind, { icon: any; tone: string; label: string }> = {
  task:     { icon: CheckSquare, tone: "bg-primary/10 text-primary",   label: "Tarefa" },
  meeting:  { icon: Calendar,    tone: "bg-info/15 text-info",         label: "Reunião" },
  finance:  { icon: DollarSign,  tone: "bg-success/10 text-success",   label: "Financeiro" },
  approval: { icon: ShieldCheck, tone: "bg-warning/15 text-warning",   label: "Aprovação" },
};

export function DayCenterPanel({ data }: { data: any }) {
  const [tab, setTab] = useState<"all" | FeedKind>("all");

  const items = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const limit = new Date(today); limit.setDate(today.getDate() + 1);

    const feed: Array<{ id: string; kind: FeedKind; time: string; title: string; sub?: string; to: any }> = [];

    for (const ev of data.events ?? []) {
      feed.push({
        id: `ev-${ev.id}`, kind: "meeting", time: hhmm(ev.starts_at),
        title: ev.title, sub: ev.description ?? undefined,
        to: { to: "/calendar", search: { d: String(ev.starts_at).slice(0, 10) } },
      });
    }

    for (const t of (data.tasks ?? []).filter(isOpen)) {
      if (!t.due_date) continue;
      const d = new Date(t.due_date); d.setHours(0, 0, 0, 0);
      if (d.getTime() >= limit.getTime()) continue;
      feed.push({
        id: `t-${t.id}`, kind: "task",
        time: d.getTime() < today.getTime() ? "Atrasada" : "Hoje",
        title: t.title,
        sub: `${t.progress ?? 0}% concluída`,
        to: { to: "/tasks", search: { open: t.id } },
      });
    }

    for (const p of (data.proposals ?? []).filter((p: any) => p.status === "sent" || p.status === "pending")) {
      feed.push({
        id: `p-${p.id}`, kind: "approval", time: "Pendente",
        title: "Proposta aguardando aprovação",
        sub: p.total_value ? BRL(Number(p.total_value)) : undefined,
        to: { to: "/proposals" },
      });
    }

    const pipeline = (data.proposals ?? [])
      .filter((p: any) => p.status !== "approved" && p.status !== "rejected")
      .reduce((s: number, p: any) => s + (Number(p.total_value) || 0), 0);
    if (pipeline > 0) {
      feed.push({
        id: "fin-pipeline", kind: "finance", time: "Mês",
        title: "Pipeline em negociação", sub: BRL(pipeline), to: { to: "/finance" },
      });
    }

    return tab === "all" ? feed : feed.filter(f => f.kind === tab);
  }, [data, tab]);

  return (
    <Card className="card-surface flex h-full flex-col p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">Central do dia</h3>
          <p className="text-[11px] text-muted-foreground">Tudo que precisa da sua atenção hoje.</p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {items.length}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
              tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex-1 space-y-2">
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
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-muted/40 px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${meta.tone}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{it.title}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {meta.label}{it.sub ? ` · ${it.sub}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-[11px] font-medium text-muted-foreground">{it.time}</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Prioridades do dia                                                  *
 * ------------------------------------------------------------------ */

export function PrioritiesPanel({ data }: { data: any }) {
  const list = useMemo(() => {
    const rank = (p: string) => (p === "critical" ? 0 : p === "urgent" ? 1 : p === "high" ? 2 : p === "medium" ? 3 : 4);
    return (data.tasks ?? [])
      .filter(isOpen)
      .sort((a: any, b: any) => {
        const r = rank(a.priority ?? "low") - rank(b.priority ?? "low");
        if (r !== 0) return r;
        const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return da - db;
      })
      .slice(0, 5);
  }, [data]);

  const tag = (p: string) =>
    p === "critical" || p === "urgent"
      ? { label: "Urgente", cls: "bg-destructive/10 text-destructive" }
      : p === "high"
        ? { label: "Alta", cls: "bg-warning/15 text-warning" }
        : { label: "Normal", cls: "bg-muted text-muted-foreground" };

  return (
    <Card className="card-surface flex h-full flex-col p-5">
      <h3 className="font-display text-lg font-semibold">Prioridades do dia</h3>
      <p className="text-[11px] text-muted-foreground">Foque nestas primeiro.</p>

      <div className="mt-4 flex-1 space-y-2">
        {list.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            Nenhuma prioridade aberta.
          </p>
        )}
        {list.map((t: any) => {
          const g = tag(String(t.priority ?? "low"));
          return (
            <Link
              key={t.id}
              to="/tasks"
              search={{ open: t.id } as any}
              className="block rounded-2xl border-l-2 border-primary bg-muted/40 py-2 pl-3 pr-2 hover:bg-muted"
            >
              <p className="truncate text-sm font-medium">{t.title}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${g.cls}`}>{g.label}</span>
                <span className="text-[10px] text-muted-foreground">
                  {t.due_date ? new Date(t.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "sem prazo"}
                </span>
              </div>
            </Link>
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
 * Agenda de hoje                                                      *
 * ------------------------------------------------------------------ */

export function AgendaTodayPanel({ data }: { data: any }) {
  const events = data.events ?? [];
  return (
    <Card className="card-surface flex h-full flex-col p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">Agenda de hoje</h3>
          <p className="text-[11px] capitalize text-muted-foreground">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          </p>
        </div>
        <Link to="/calendar" className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground">Abrir</Link>
      </div>

      <div className="mt-4 flex-1 space-y-2">
        {events.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            Nenhum compromisso hoje.
          </p>
        )}
        {events.map((ev: any) => (
          <Link
            key={ev.id}
            to="/calendar"
            search={{ d: String(ev.starts_at).slice(0, 10) } as any}
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl bg-muted/40 px-3 py-2.5 hover:bg-muted"
          >
            <span className="shrink-0 text-xs font-semibold text-primary">{hhmm(ev.starts_at)}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{ev.title}</span>
              {ev.description && (
                <span className="block truncate text-[11px] text-muted-foreground">{ev.description}</span>
              )}
            </span>
          </Link>
        ))}
      </div>

      <Link
        to="/calendar"
        search={{ new: 1 } as any}
        className="mt-3 flex items-center justify-center rounded-2xl border border-dashed border-border py-2 text-[11px] text-muted-foreground hover:border-primary hover:text-primary"
      >
        Novo compromisso
      </Link>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Coluna lateral — Receita, Projetos, Clientes                        *
 * ------------------------------------------------------------------ */

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-14 items-end gap-1">
      {values.map((v, i) => (
        <span
          key={i}
          className={`flex-1 rounded-t-sm ${i === values.length - 1 ? "bg-primary" : "bg-primary/25"}`}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
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
        .select("total, issue_date, status")
        .gte("issue_date", from);
      return data ?? [];
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
    if (b) b.value += Number(inv.total) || 0;
  }
  const current = buckets[buckets.length - 1]?.value ?? 0;
  const previous = buckets[buckets.length - 2]?.value ?? 0;
  const delta = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;

  return (
    <Card className="card-surface p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Receita do mês</p>
          <p className="mt-2 font-display text-2xl font-bold leading-none">{BRL(current)}</p>
        </div>
        <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
          delta < 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
        }`}>
          <TrendingUp className="h-3 w-3" /> {delta}%
        </span>
      </div>
      <div className="mt-4"><Sparkline values={buckets.map(b => b.value)} /></div>
      <div className="mt-1 flex justify-between text-[9px] uppercase text-muted-foreground">
        {buckets.map(b => <span key={b.key}>{b.label.replace(".", "")}</span>)}
      </div>
      <Link to="/finance" className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
        Ver financeiro <ArrowUpRight className="h-3 w-3" />
      </Link>
    </Card>
  );
}

export function ActiveProjectsPanel({ data }: { data: any }) {
  const projects = data.projects ?? [];
  const active = projects.filter((p: any) => !["completed", "archived", "cancelled"].includes(String(p.status)));
  const pct = projects.length ? Math.round((active.length / projects.length) * 100) : 0;

  return (
    <Card className="card-surface p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Projetos ativos</p>
      <div className="mt-4 flex items-center gap-4">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center rounded-full"
          style={{ background: `conic-gradient(var(--primary) ${pct * 3.6}deg, var(--muted) 0deg)` }}
        >
          <div className="grid h-12 w-12 place-items-center rounded-full bg-card font-display text-sm font-bold">
            {active.length}
          </div>
        </div>
        <div className="min-w-0 text-xs text-muted-foreground">
          <p className="flex items-center gap-1"><CircleDot className="h-3 w-3 text-primary" /> {pct}% da carteira</p>
          <p className="mt-1 flex items-center gap-1"><FolderKanban className="h-3 w-3" /> {projects.length} no total</p>
        </div>
      </div>
      <Link to="/projects" className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
        Ver projetos <ArrowUpRight className="h-3 w-3" />
      </Link>
    </Card>
  );
}

export function ActiveClientsPanel() {
  const { data } = useQuery({
    queryKey: ["dashboard-active-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, status, name").limit(500);
      return data ?? [];
    },
  });
  const clients = (data ?? []) as any[];
  const active = clients.filter(c => !["inactive", "archived", "lost"].includes(String(c.status)));

  return (
    <Card className="card-surface p-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Clientes ativos</p>
      <p className="mt-2 font-display text-2xl font-bold leading-none">{active.length}</p>
      <div className="mt-4 space-y-1.5">
        {active.slice(0, 3).map(c => (
          <div key={c.id} className="flex items-center gap-2 rounded-xl bg-muted/40 px-2.5 py-1.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {String(c.name ?? "?").slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 truncate text-xs">{c.name}</span>
          </div>
        ))}
        {active.length === 0 && <p className="text-xs text-muted-foreground">Nenhum cliente cadastrado.</p>}
      </div>
      <Link to="/clients" className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
        <Users className="h-3 w-3" /> Ver clientes
      </Link>
    </Card>
  );
}
