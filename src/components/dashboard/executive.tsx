import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users, FolderOpen, AlertTriangle, PieChart, Info, ArrowRight, TrendingUp,
  TrendingDown, CheckCircle2, Clock, CalendarCheck, MoreVertical, ChevronLeft,
  ChevronRight, Circle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { computeProjectHealth, isAtRisk } from "@/lib/project-health";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const monthStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const monthEnd = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 1);
const dayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

export const executiveQuery = {
  queryKey: ["dashboard-executive"],
  queryFn: async () => {
    const from = monthStart().toISOString().slice(0, 10);
    const to = monthEnd().toISOString().slice(0, 10);
    const prevFrom = monthStart(new Date(new Date().setMonth(new Date().getMonth() - 1))).toISOString().slice(0, 10);

    const [charges, clients, projects, tasks, leads, events] = await Promise.all([
      supabase.from("charges").select("id,amount,type,status,due_date,paid_at,category,project_id").gte("due_date", prevFrom).lt("due_date", to),
      supabase.from("clients").select("id,name,created_at,status"),
      supabase.from("projects").select("id,name,status,end_date,client_id"),
      supabase.from("tasks").select("id,title,status,priority,due_date,project_id,client_id,assignee_id,updated_at,deliverables").limit(2000),
      supabase.from("leads").select("id,stage,estimated_value"),
      supabase.from("calendar_events").select("id,title,description,kind,starts_at,ends_at").gte("starts_at", dayStart().toISOString()).order("starts_at").limit(40),
    ]);

    return {
      charges: charges.data ?? [],
      clients: clients.data ?? [],
      projects: projects.data ?? [],
      tasks: tasks.data ?? [],
      leads: leads.data ?? [],
      events: events.data ?? [],
      from,
    };
  },
};

type Data = Awaited<ReturnType<typeof executiveQuery.queryFn>>;

/** Faixa executiva + Atenção da Agência + blocos inferiores + coluna de agenda (DASH-01/03). */
export function ExecutiveDashboard({ data }: { data: Data }) {
  const m = useMetrics(data);

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 space-y-4 xl:col-span-9">
        <KpiStrip m={m} />
        <AttentionBlock m={m} data={data} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <FinancePanel m={m} />
          <PipelinePanel m={m} />
          <MyOperationPanel m={m} />
        </div>
      </div>
      <div className="col-span-12 space-y-4 xl:col-span-3">
        <MiniCalendar />
        <DayAgenda data={data} />
        <NextMeetings data={data} />
      </div>
    </div>
  );
}

function useMetrics(data: Data) {
  return useMemo(() => {
    const today = dayStart();
    const ms = monthStart();
    const me = monthEnd();
    const inMonth = (s?: string | null) => !!s && new Date(s) >= ms && new Date(s) < me;
    const inPrev = (s?: string | null) => {
      if (!s) return false;
      const d = new Date(s);
      const ps = new Date(ms.getFullYear(), ms.getMonth() - 1, 1);
      return d >= ps && d < ms;
    };

    const income = data.charges.filter(c => (c.type ?? "income") !== "expense");
    const expense = data.charges.filter(c => c.type === "expense");

    const revenue = income.filter(c => inMonth(c.due_date)).reduce((s, c) => s + Number(c.amount || 0), 0);
    const revenuePrev = income.filter(c => inPrev(c.due_date)).reduce((s, c) => s + Number(c.amount || 0), 0);
    const expenses = expense.filter(c => inMonth(c.due_date)).reduce((s, c) => s + Number(c.amount || 0), 0);
    const hasExpenses = expense.length > 0;
    const margin = revenue > 0 && hasExpenses ? ((revenue - expenses) / revenue) * 100 : null;

    const revDelta = revenuePrev > 0 ? ((revenue - revenuePrev) / revenuePrev) * 100 : null;

    const activeClients = data.clients.filter(c => (c as any).status !== "inactive").length;
    const newClients = data.clients.filter(c => inMonth((c as any).created_at)).length;

    const CLOSED_PROJECT = ["done", "completed", "archived", "closed"];
    const activeProjects = data.projects.filter(p => !CLOSED_PROJECT.includes(String(p.status)));
    const health = new Map(data.projects.map(p => [p.id, computeProjectHealth(p, data.tasks)]));
    const atRisk = activeProjects.filter(p => isAtRisk(health.get(p.id)!));
    const critical = activeProjects.filter(p => health.get(p.id) === "critical");
    const onTime = activeProjects.length
      ? Math.round(((activeProjects.length - atRisk.length) / activeProjects.length) * 100)
      : 100;

    const openLeads = data.leads.filter(l => String(l.stage) !== "closed");
    const pipeline = openLeads.reduce((s, l) => s + Number(l.estimated_value || 0), 0);
    const stages: { key: string; label: string }[] = [
      { key: "lead", label: "Novo" },
      { key: "contact", label: "Contato" },
      { key: "proposal", label: "Proposta" },
      { key: "negotiation", label: "Negociação" },
      { key: "closed", label: "Fechadas" },
    ];

    const funnel = stages.map(s => ({
      ...s,
      value: data.leads.filter(l => l.stage === (s.key as any)).reduce((a, l) => a + Number(l.estimated_value || 0), 0),
      count: data.leads.filter(l => l.stage === (s.key as any)).length,
    }));

    const open = data.tasks.filter(t => t.status !== "done");
    const overdue = open.filter(t => t.due_date && new Date(t.due_date) < today);
    const dueToday = open.filter(t => t.due_date && sameDay(new Date(t.due_date), today));
    const doneToday = data.tasks.filter(t => t.status === "done" && t.updated_at && sameDay(new Date(t.updated_at), today));
    const approvals = open.filter(t => t.status === "review");

    const byStatus = (s: string) => data.tasks.filter(t => t.status === s).length;

    const critPend = [...overdue, ...dueToday]
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
      .slice(0, 5)
      .map(t => ({
        ...t,
        projectName: data.projects.find(p => p.id === t.project_id)?.name ?? "Sem projeto",
        clientName: data.clients.find(c => c.id === t.client_id)?.name ?? null,
        overdue: !!(t.due_date && new Date(t.due_date) < today),
      }));

    // Receita por dia do mês (barras) e categorias de despesa (donut)
    const days = new Date(me.getTime() - 86_400_000).getDate();
    const perDay = Array.from({ length: days }, (_, i) => {
      const d = i + 1;
      return income
        .filter(c => inMonth(c.due_date) && new Date(c.due_date).getDate() === d)
        .reduce((s, c) => s + Number(c.amount || 0), 0);
    });
    const catMap = new Map<string, number>();
    expense.filter(c => inMonth(c.due_date)).forEach(c => {
      const k = c.category || "Outros";
      catMap.set(k, (catMap.get(k) ?? 0) + Number(c.amount || 0));
    });
    const categories = [...catMap.entries()].map(([label, value]) => ({ label, value }));

    return {
      revenue, revDelta, expenses, hasExpenses, margin,
      activeClients, newClients,
      activeProjects: activeProjects.length,
      startedThisMonth: data.projects.filter(p => inMonth((p as any).created_at)).length,
      atRisk: atRisk.length, critical: critical.length, onTime,
      pipeline, proposalsCount: openLeads.length, funnel,
      overdue: overdue.length, criticalTasks: overdue.filter(t => t.priority === "urgent" || t.priority === "critical").length,
      dueToday: dueToday.length,
      dueTodayProjects: new Set(dueToday.map(t => t.project_id)).size,
      doneToday: doneToday.length,
      approvals: approvals.length,
      urgentApprovals: approvals.filter(t => t.priority === "urgent" || t.priority === "high").length,
      critPend,
      taskCounts: { todo: byStatus("todo"), doing: byStatus("in_progress"), review: byStatus("review"), done: doneToday.length },
      nextTasks: open
        .filter(t => t.due_date)
        .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
        .slice(0, 4),
      perDay, categories,
    };
  }, [data]);
}
type Metrics = ReturnType<typeof useMetrics>;

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-border bg-card ${className}`}>{children}</div>;
}

function PanelHead({ title, action, to }: { title: string; action?: string; to?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
      <h2 className="min-w-0 truncate text-[14px] font-semibold">{title}</h2>
      {action && to && (
        <Link to={to} className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-medium text-primary hover:underline">
          {action} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

/* ---------------- Faixa executiva ---------------- */

function KpiStrip({ m }: { m: Metrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        title="Receita do mês"
        value={brl(m.revenue)}
        delta={m.revDelta}
        deltaLabel="vs. mês anterior"
        spark={m.perDay}
      />
      <KpiCard
        title="Margem"
        value={m.margin === null ? "—" : `${m.margin.toFixed(1).replace(".", ",")}%`}
        hint={m.margin === null ? "Sem despesas lançadas" : undefined}
        spark={m.margin === null ? undefined : m.perDay}
        sparkColor="var(--color-success)"
      />
      <KpiCard icon={Users} title="Clientes ativos" value={String(m.activeClients)} foot={`${m.newClients} novos`} />
      <KpiCard icon={FolderOpen} title="Projetos ativos" value={String(m.activeProjects)} foot={`${m.startedThisMonth} iniciados`} />
      <KpiCard icon={AlertTriangle} title="Projetos em risco" value={String(m.atRisk)} foot={`${m.critical} críticos`} tone="danger" />
      <KpiCard icon={PieChart} title="Pipeline comercial" value={brl(m.pipeline)} foot={`${m.proposalsCount} oportunidades`} />
    </div>
  );
}

function KpiCard({
  title, value, delta, deltaLabel, foot, hint, icon: Icon, spark, sparkColor, tone,
}: {
  title: string; value: string; delta?: number | null; deltaLabel?: string; foot?: string;
  hint?: string; icon?: typeof Users; spark?: number[]; sparkColor?: string; tone?: "danger";
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3.5 py-3">
      <div className="flex min-h-[32px] items-start gap-1.5 text-[12px] leading-tight text-muted-foreground">
        {Icon ? <Icon className={`mt-px h-3.5 w-3.5 shrink-0 ${tone === "danger" ? "text-destructive" : ""}`} /> : null}
        <span className="line-clamp-2">{title}</span>
        {!Icon && <Info className="mt-px h-3 w-3 shrink-0 opacity-50" />}
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <span className="font-display text-[22px] font-semibold tabular-nums leading-none">{value}</span>
        {spark && spark.length > 1 && <Sparkline points={spark} color={sparkColor} />}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        {typeof delta === "number" ? (
          <span className={`inline-flex items-center gap-1 ${delta >= 0 ? "text-success" : "text-destructive"}`}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1).replace(".", ",")}%
          </span>
        ) : null}
        {typeof delta === "number" && deltaLabel ? <span className="ml-1">{deltaLabel}</span> : null}
        {foot ? <span>{foot}</span> : null}
        {hint ? <span className="italic">{hint}</span> : null}
      </div>
    </div>
  );
}

function Sparkline({ points, color = "var(--color-primary)" }: { points: number[]; color?: string }) {
  const max = Math.max(...points, 1);
  const w = 68, h = 26;
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (p / max) * (h - 3) - 1.5).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} className="shrink-0 overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ---------------- Atenção da Agência ---------------- */

function AttentionBlock({ m, data }: { m: Metrics; data: Data }) {
  const chips = [
    { icon: Clock, label: "Tarefas vencidas", value: m.overdue, foot: `${m.criticalTasks} críticas`, tone: "danger" as const },
    { icon: CalendarCheck, label: "Entregas de hoje", value: m.dueToday, foot: `${m.dueTodayProjects} projetos` },
    { icon: AlertTriangle, label: "Projetos em risco", value: m.atRisk, foot: `${m.critical} críticos`, tone: "danger" as const },
    { icon: Clock, label: "Aprovações pendentes", value: m.approvals, foot: `${m.urgentApprovals} urgentes` },
    { icon: CheckCircle2, label: "Entregas concluídas hoje", value: m.doneToday, foot: m.doneToday > 0 ? "Excelente!" : "Nada ainda", tone: "success" as const },
    { icon: CheckCircle2, label: "Projetos no prazo", value: `${m.onTime}%`, foot: "Dentro do prazo", tone: "success" as const },
  ];

  return (
    <Panel>
      <div className="flex items-start justify-between px-4 pb-3 pt-3.5">
        <div>
          <h2 className="text-[15px] font-semibold">Atenção da Agência</h2>
          <p className="text-[12px] text-muted-foreground">O que precisa do seu foco agora.</p>
        </div>
        <Link to="/tasks" className="flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
          Ver tudo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 md:grid-cols-3 xl:grid-cols-6">
        {chips.map(c => (
          <div key={c.label} className="rounded-lg border border-border px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <c.icon className={`h-3.5 w-3.5 ${c.tone === "danger" ? "text-destructive" : c.tone === "success" ? "text-success" : ""}`} />
              <span className="truncate">{c.label}</span>
            </div>
            <div className="mt-1 font-display text-[20px] font-semibold tabular-nums leading-none">{c.value}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">{c.foot}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 px-4 pb-4">
        <div className="grid grid-cols-[minmax(0,1fr)_150px_110px_90px_24px] items-center gap-3 border-b border-border pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Pendências críticas</span>
          <span>Cliente / Projeto</span>
          <span>Vencimento</span>
          <span>Prioridade</span>
          <span />
        </div>
        {m.critPend.length === 0 && (
          <p className="py-4 text-center text-[12px] text-muted-foreground">Nenhuma pendência crítica. Bom trabalho.</p>
        )}
        {m.critPend.map(t => (
          <Link
            key={t.id}
            to="/tasks"
            search={{ open: t.id } as any}
            className="grid grid-cols-[minmax(0,1fr)_150px_110px_90px_24px] items-center gap-3 border-b border-border py-2.5 text-[13px] last:border-0 hover:bg-muted/50"
          >
            <span className="flex min-w-0 items-center gap-2">
              <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${t.overdue ? "text-destructive" : "text-warning"}`} />
              <span className="truncate">{t.title}</span>
            </span>
            <span className="min-w-0 text-[12px] text-muted-foreground">
              <span className="block truncate">{t.projectName}</span>
              {t.clientName && <span className="block truncate text-[11px]">Cliente: {t.clientName}</span>}
            </span>
            <span className={`text-[12px] ${t.overdue ? "text-destructive" : ""}`}>
              {t.overdue ? "Vencida" : "Vence hoje"}
            </span>
            <span>
              <PriorityBadge value={t.priority} />
            </span>
            <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </Panel>
  );
}

const PRIORITY_LABEL: Record<string, string> = {
  low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente", critical: "Crítica",
};

function PriorityBadge({ value }: { value?: string | null }) {
  const v = value ?? "medium";
  const tone =
    v === "critical" || v === "urgent" ? "bg-destructive/12 text-destructive"
      : v === "high" ? "bg-warning/15 text-warning"
      : "bg-secondary text-secondary-foreground";
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${tone}`}>{PRIORITY_LABEL[v] ?? v}</span>;
}

/* ---------------- Blocos inferiores ---------------- */

function FinancePanel({ m }: { m: Metrics }) {
  const max = Math.max(...m.perDay, 1);
  const palette = ["var(--color-primary)", "var(--color-success)", "var(--color-warning)", "var(--color-info)", "var(--color-destructive)"];
  const total = m.categories.reduce((s, c) => s + c.value, 0);
  let acc = 0;
  const stops = m.categories.map((c, i) => {
    const from = (acc / (total || 1)) * 100;
    acc += c.value;
    const to = (acc / (total || 1)) * 100;
    return `${palette[i % palette.length]} ${from}% ${to}%`;
  });

  return (
    <Panel>
      <PanelHead title="Financeiro / Panorama do mês" action="Ver relatório" to="/finance" />
      <div className="grid grid-cols-2 gap-4 p-4">
        <div>
          <p className="text-[11px] text-muted-foreground">Receita</p>
          <p className="font-display text-[18px] font-semibold tabular-nums">{brl(m.revenue)}</p>
          {typeof m.revDelta === "number" && (
            <p className={`text-[11px] ${m.revDelta >= 0 ? "text-success" : "text-destructive"}`}>
              {m.revDelta >= 0 ? "▲" : "▼"} {Math.abs(m.revDelta).toFixed(1).replace(".", ",")}% vs. mês anterior
            </p>
          )}
          <div className="mt-3 flex h-24 items-end gap-[2px]">
            {m.perDay.map((v, i) => (
              <div key={i} className="flex-1 rounded-t-[2px] bg-primary/80" style={{ height: `${Math.max((v / max) * 100, 2)}%` }} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Despesas</p>
          <p className="font-display text-[18px] font-semibold tabular-nums">{m.hasExpenses ? brl(m.expenses) : "—"}</p>
          {!m.hasExpenses && <p className="text-[11px] italic text-muted-foreground">Sem despesas lançadas ainda</p>}
          {m.categories.length > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <div
                className="grid h-20 w-20 place-items-center rounded-full"
                style={{ background: `conic-gradient(${stops.join(",")})` }}
              >
                <div className="grid h-14 w-14 place-items-center rounded-full bg-card text-[12px] font-semibold tabular-nums">
                  {total > 0 ? `${Math.round((m.categories[0].value / total) * 100)}%` : "—"}
                </div>
              </div>
              <ul className="space-y-1 text-[11px]">
                {m.categories.slice(0, 4).map((c, i) => (
                  <li key={c.label} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: palette[i % palette.length] }} />
                    <span className="truncate">{c.label}</span>
                    <span className="ml-auto tabular-nums text-muted-foreground">{Math.round((c.value / total) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

function PipelinePanel({ m }: { m: Metrics }) {
  const colors = ["var(--color-primary)", "var(--color-info)", "var(--color-success)", "var(--color-warning)", "var(--color-primary-glow)"];
  const max = Math.max(...m.funnel.map(f => f.value), 1);
  return (
    <Panel>
      <PanelHead title="Comercial / Pipeline" action="Ver pipeline" to="/crm" />
      <div className="p-4">
        <p className="text-[11px] text-muted-foreground">Valor total</p>
        <p className="font-display text-[18px] font-semibold tabular-nums">{brl(m.pipeline)}</p>
        <p className="text-[11px] text-muted-foreground">{m.proposalsCount} oportunidades abertas</p>

        <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-4">
          <div className="space-y-1">
            {m.funnel.map((f, i) => (
              <div key={f.key} className="flex justify-center">
                <div
                  className="h-5 rounded-[2px]"
                  style={{ width: `${Math.max((f.value / max) * 100, 12)}%`, background: colors[i % colors.length] }}
                />
              </div>
            ))}
          </div>
          <ul className="space-y-1 text-[11px]">
            {m.funnel.map((f, i) => (
              <li key={f.key} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: colors[i % colors.length] }} />
                <span>{f.label}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">{brl(f.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

function MyOperationPanel({ m }: { m: Metrics }) {
  const cols = [
    { label: "A fazer", value: m.taskCounts.todo },
    { label: "Em andamento", value: m.taskCounts.doing },
    { label: "Em revisão", value: m.taskCounts.review },
    { label: "Concluídas (hoje)", value: m.taskCounts.done },
  ];
  return (
    <Panel>
      <PanelHead title="Minha operação / Tarefas do dia" action="Ver tarefas" to="/tasks" />
      <div className="p-4">
        <div className="grid grid-cols-4 divide-x divide-border">
          {cols.map(c => (
            <div key={c.label} className="px-2 first:pl-0">
              <p className="truncate text-[11px] text-muted-foreground">{c.label}</p>
              <p className="font-display text-[18px] font-semibold tabular-nums">{c.value}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Próximas tarefas</p>
        <ul className="mt-1.5 space-y-1.5">
          {m.nextTasks.length === 0 && <li className="text-[12px] text-muted-foreground">Nenhuma tarefa com prazo.</li>}
          {m.nextTasks.map(t => (
            <li key={t.id}>
              <Link to="/tasks" search={{ open: t.id } as any} className="flex items-center gap-2 text-[13px] hover:text-primary">
                <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{t.title}</span>
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{relDate(t.due_date)}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link to="/tasks" className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
          Ver todas as tarefas <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </Panel>
  );
}

function relDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  const t = dayStart();
  const diff = Math.round((new Date(d.toDateString()).getTime() - t.getTime()) / 86_400_000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff < 0) return "Vencida";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/* ---------------- Coluna de agenda ---------------- */

function MiniCalendar() {
  const [ref, setRef] = useState(() => new Date());
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // segunda = 0
  const days = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  return (
    <Panel className="p-3">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold capitalize">
          {ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </span>
        <div className="flex gap-1">
          <button onClick={() => setRef(new Date(year, month - 1, 1))} className="grid h-6 w-6 place-items-center rounded border border-border text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setRef(new Date(year, month + 1, 1))} className="grid h-6 w-6 place-items-center rounded border border-border text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-y-1 text-center text-[10px] uppercase text-muted-foreground">
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(d => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-y-1 text-center text-[12px]">
        {Array.from({ length: offset }).map((_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: days }, (_, i) => i + 1).map(d => {
          const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          return (
            <span key={d} className={`mx-auto grid h-6 w-6 place-items-center rounded-full tabular-nums ${isToday ? "bg-primary text-primary-foreground font-semibold" : ""}`}>
              {d}
            </span>
          );
        })}
      </div>
    </Panel>
  );
}

const EVENT_COLORS = ["var(--color-primary)", "var(--color-warning)", "var(--color-info)", "var(--color-success)"];

function DayAgenda({ data }: { data: Data }) {
  const today = new Date();
  const items = data.events.filter(e => sameDay(new Date(e.starts_at), today));
  return (
    <Panel>
      <PanelHead title="Agenda do dia" action="Ver agenda completa" to="/calendar" />
      <div className="space-y-2.5 p-3.5">
        {items.length === 0 && <p className="text-[12px] text-muted-foreground">Nenhum compromisso hoje.</p>}
        {items.map((e, i) => (
          <div key={e.id} className="flex gap-2.5">
            <span className="w-10 shrink-0 pt-0.5 text-[12px] tabular-nums text-muted-foreground">
              {new Date(e.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="w-[3px] shrink-0 rounded-full" style={{ background: EVENT_COLORS[i % EVENT_COLORS.length] }} />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{e.title}</p>
              {e.description && <p className="truncate text-[11px] text-muted-foreground">{e.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function NextMeetings({ data }: { data: Data }) {
  const today = new Date();
  const items = data.events.filter(e => !sameDay(new Date(e.starts_at), today)).slice(0, 4);
  return (
    <Panel>
      <PanelHead title="Próximas reuniões" action="Ver todas" to="/calendar" />
      <div className="space-y-3 p-3.5">
        {items.length === 0 && <p className="text-[12px] text-muted-foreground">Nenhuma reunião futura.</p>}
        {items.map(e => {
          const d = new Date(e.starts_at);
          return (
            <div key={e.id} className="flex gap-3">
              <div className="grid w-9 shrink-0 place-items-center rounded border border-border py-1">
                <span className="text-[13px] font-semibold tabular-nums leading-none">{String(d.getDate()).padStart(2, "0")}</span>
                <span className="text-[9px] uppercase text-muted-foreground">{d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{e.title}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {d.toLocaleDateString("pt-BR", { weekday: "short" })} · {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  {e.description ? ` · ${e.description}` : ""}
                </p>
              </div>
            </div>
          );
        })}
        <Link to="/calendar" className="block rounded-lg border border-border py-2 text-center text-[12px] font-medium hover:bg-muted">
          Ver todas as reuniões
        </Link>
      </div>
    </Panel>
  );
}
