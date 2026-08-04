import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardPersonalize } from "@/components/dashboard-personalize";
import { QuickCreateButton } from "@/components/quick-create-button";
import { useState } from "react";
import { reconcilePrefs, type UserPref } from "@/lib/dashboard-widgets";
import {
  AlertTriangle, CalendarDays, Check, Clock3, FolderKanban,
  Users, CheckCircle2, ChevronRight, Info,
} from "lucide-react";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Caritas Gestão" },
      { name: "description", content: "Panorama executivo da operação da Caritas Gestão." },
      { property: "og:title", content: "Dashboard | Caritas Gestão" },
      { property: "og:description", content: "Panorama executivo da operação da Caritas Gestão." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

const money = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

function DashboardPage() {
  const { data = { tasks: [], projects: [], proposals: [], clients: [], charges: [], events: [], upcoming: [], leads: [] } } = useQuery({
    queryKey: ["dashboard-v3"],
    queryFn: async () => {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const [tasks, projects, proposals, clients, charges, events, upcoming, leads] = await Promise.all([
        supabase.from("tasks").select("id,title,status,priority,due_date,progress,project_id,client_id").limit(250),
        supabase.from("projects").select("id,name,status,end_date,fixed_value,monthly_value,client_id,created_at").limit(200),
        supabase.from("proposals").select("id,status,total_value").limit(200),
        supabase.from("clients").select("id,name,created_at").limit(300),
        supabase.from("charges").select("id,amount,status,due_date,paid_at,type,nature,category,description").limit(300),
        supabase.from("calendar_events").select("id,title,starts_at,ends_at,kind,description").gte("starts_at", dayStart).lt("starts_at", dayEnd).order("starts_at").limit(8),
        supabase.from("calendar_events").select("id,title,starts_at,ends_at,kind,description").gte("starts_at", dayEnd).order("starts_at").limit(6),
        supabase.from("leads").select("id,stage,estimated_value").limit(400),
      ]);
      return {
        tasks: tasks.data ?? [], projects: projects.data ?? [], proposals: proposals.data ?? [],
        clients: clients.data ?? [], charges: charges.data ?? [], events: events.data ?? [],
        upcoming: upcoming.data ?? [], leads: leads.data ?? [],
      };
    },
  });

  const { data: me } = useQuery({
    queryKey: ["dashboard-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("full_name,display_name,role_title").eq("id", u.user.id).maybeSingle();
      return { email: u.user.email ?? "", ...(data ?? {}) } as any;
    },
  });
  const firstName = (me?.display_name || me?.full_name || me?.email?.split("@")[0] || "").split(" ")[0] || "Caritas";
  const roleTitle = me?.role_title || "Direção / Proprietário";

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const inMonth = (s?: string | null) => !!s && new Date(s).getMonth() === month && new Date(s).getFullYear() === year;
  const revenue = data.charges.filter((c: any) => c.nature !== "expense" && c.type !== "expense" && inMonth(c.paid_at || c.due_date)).reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
  const expenses = data.charges.filter((c: any) => c.nature === "expense" || c.type === "expense" || c.type === "despesa").filter((c: any) => inMonth(c.paid_at || c.due_date)).reduce((s: number, c: any) => s + Math.abs(Number(c.amount || 0)), 0);
  const margin = revenue > 0 ? Math.max(0, ((revenue - expenses) / revenue) * 100) : 0;
  const prevDate = new Date(year, month - 1, 1);
  const inPrevMonth = (d?: string | null) => !!d && new Date(d).getMonth() === prevDate.getMonth() && new Date(d).getFullYear() === prevDate.getFullYear();
  const prevRevenue = data.charges.filter((c: any) => c.nature !== "expense" && c.type !== "expense" && inPrevMonth(c.paid_at || c.due_date)).reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
  const prevExpenses = data.charges.filter((c: any) => c.nature === "expense" || c.type === "expense" || c.type === "despesa").filter((c: any) => inPrevMonth(c.paid_at || c.due_date)).reduce((s: number, c: any) => s + Math.abs(Number(c.amount || 0)), 0);
  const prevMargin = prevRevenue > 0 ? ((prevRevenue - prevExpenses) / prevRevenue) * 100 : 0;
  const pctDelta = (curr: number, prev: number) => {
    if (!prev) return curr > 0 ? "▲ novo" : "—";
    const d = ((curr - prev) / prev) * 100;
    return `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1).replace(".", ",")}%`;
  };
  const newClients = data.clients.filter((c: any) => inMonth(c.created_at)).length;
  const newProjects = data.projects.filter((p: any) => inMonth(p.created_at)).length;

  const activeProjects = data.projects.filter((p: any) => ["active", "review", "planning"].includes(p.status)).length;
  const riskProjects = data.projects.filter((p: any) => p.end_date && new Date(p.end_date) < now && p.status !== "done").length;
  const pipeline = data.proposals.filter((p: any) => !["accepted", "rejected"].includes(p.status)).reduce((s: number, p: any) => s + Number(p.total_value || 0), 0);
  const overdue = data.tasks.filter((t: any) => t.due_date && new Date(t.due_date) < now && t.status !== "done").length;
  const todayTasks = data.tasks.filter((t: any) => t.due_date && new Date(t.due_date).toDateString() === now.toDateString() && t.status !== "done").length;
  const doneToday = data.tasks.filter((t: any) => t.status === "done").slice(0, 20).length;
  const approvals = data.tasks.filter((t: any) => t.status === "review").length;
  const onTime = data.tasks.length ? Math.round(100 * (data.tasks.filter((t: any) => t.status === "done" || !t.due_date || new Date(t.due_date) >= now).length / data.tasks.length)) : 100;

  const [prefs, setPrefs] = useState<UserPref[]>(reconcilePrefs(null, "Direção / Proprietário"));

  const clientNameById = Object.fromEntries((data.clients as any[]).map((c: any) => [c.id, c.name]));
  const projectById = Object.fromEntries((data.projects as any[]).map((p: any) => [p.id, p]));

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const bars = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    return (data.charges as any[])
      .filter((c: any) => c.nature !== "expense" && c.type !== "expense")
      .filter((c: any) => {
        const d = c.paid_at || c.due_date;
        return d && new Date(d).getMonth() === month && new Date(d).getFullYear() === year && new Date(d).getDate() === day;
      })
      .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);
  });
  const maxBar = Math.max(1, ...bars);

  const expenseByCategory = (() => {
    const acc: Record<string, number> = {};
    for (const c of data.charges as any[]) {
      const isExpense = c.nature === "expense" || c.type === "expense" || c.type === "despesa";
      if (!isExpense || !inMonth(c.paid_at || c.due_date)) continue;
      const key = c.category || "Outros";
      acc[key] = (acc[key] ?? 0) + Math.abs(Number(c.amount || 0));
    }
    const total = Object.values(acc).reduce((a, b) => a + b, 0);
    const palette = ["var(--primary)", "var(--teal)", "var(--warning)", "var(--purple)", "var(--success)"];
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, v], i) => ({ label, pct: total ? Math.round((v / total) * 100) : 0, color: palette[i % palette.length] }));
  })();

  const LEAD_STAGES: { key: string; label: string }[] = [
    { key: "lead", label: "Novo" },
    { key: "contact", label: "Qualificação" },
    { key: "proposal", label: "Proposta" },
    { key: "negotiation", label: "Negociação" },
    { key: "closed", label: "Fechadas" },
  ];
  const pipelineStages = LEAD_STAGES.map(st => ({
    label: st.label,
    value: (data.leads as any[])
      .filter((l: any) => l.stage === st.key)
      .reduce((sum: number, l: any) => sum + Number(l.estimated_value || 0), 0),
    count: (data.leads as any[]).filter((l: any) => l.stage === st.key).length,
  }));
  const leadsPipeline = pipelineStages.reduce((s, x) => s + x.value, 0);

  const PRIORITY_LABEL: Record<string, string> = {
    critical: "Crítica", urgent: "Urgente", high: "Alta", medium: "Média", low: "Baixa",
  };
  const dueLabel = (due: string | null) => {
    if (!due) return "Sem prazo";
    const d = new Date(`${String(due).slice(0, 10)}T12:00:00`);
    const diff = Math.round((d.getTime() - new Date(now.toDateString()).getTime()) / 86400000);
    if (diff < 0) return `Atrasada ${Math.abs(diff)}d`;
    if (diff === 0) return "Vence hoje";
    if (diff === 1) return "Vence amanhã";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  const criticalRows = (data.tasks as any[])
    .filter((t: any) => t.status !== "done" && t.due_date)
    .sort((a: any, b: any) => String(a.due_date).localeCompare(String(b.due_date)))
    .slice(0, 5)
    .map((t: any) => {
      const proj = t.project_id ? projectById[t.project_id] : null;
      const clientId = t.client_id || proj?.client_id;
      return {
        id: t.id,
        title: t.title,
        kind: t.status === "review" ? "Aprovação" : "Tarefa",
        project: proj?.name ?? "Sem projeto",
        client: clientId ? clientNameById[clientId] ?? "Cliente" : "Sem cliente",
        due: dueLabel(t.due_date),
        late: !!t.due_date && new Date(t.due_date) < new Date(now.toDateString()),
        priority: PRIORITY_LABEL[t.priority] ?? "Média",
      };
    });

  const nextTasks = (data.tasks as any[])
    .filter((t: any) => t.status !== "done")
    .sort((a: any, b: any) => String(a.due_date ?? "9999").localeCompare(String(b.due_date ?? "9999")))
    .slice(0, 4)
    .map((t: any) => ({ id: t.id, title: t.title, when: dueLabel(t.due_date), done: false }));


  return (
    <>
      <div className="cv-page-head">
        <div>
          <h1>Olá, {firstName}!</h1>
          <p>Aqui está o panorama da Caritas para hoje, {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(now)}.</p>
        </div>
        <div className="cv-page-actions">
          <DashboardPersonalize value={prefs} onChange={setPrefs} roleTitle={roleTitle} />
          <QuickCreateButton />
        </div>
      </div>

      <div className="cv-dashboard-grid">
        <div className="cv-content">
          <div className="cv-kpi-grid">
            <Kpi label="Receita do mês" info value={money(revenue)} delta={pctDelta(revenue, prevRevenue)} danger={revenue < prevRevenue} note="vs. mês anterior" spark="blue" />
            <Kpi label="Margem" info value={`${margin.toFixed(1).replace(".", ",")}%`} delta={`${margin - prevMargin >= 0 ? "▲" : "▼"} ${Math.abs(margin - prevMargin).toFixed(1).replace(".", ",")} p.p.`} danger={margin < prevMargin} note="vs. mês anterior" spark="green" />
            <Kpi label="Clientes ativos" value={String(data.clients.length)} delta={`▲ ${newClients} novos`} icon={<Users className="h-4 w-4" style={{ color: "var(--muted)" }} />} />
            <Kpi label="Projetos ativos" value={String(activeProjects)} delta={`▲ ${newProjects} iniciados`} icon={<FolderKanban className="h-4 w-4" style={{ color: "var(--muted)" }} />} />
            <Kpi label="Projetos em risco" value={String(riskProjects)} note="com prazo estourado" danger icon={<AlertTriangle className="h-4 w-4" style={{ color: "var(--danger)" }} />} />
            <Kpi label="Pipeline comercial" value={money(leadsPipeline || pipeline)} note={`${data.leads.length} oportunidades · ${data.proposals.length} propostas`} icon={<Clock3 className="h-4 w-4" style={{ color: "var(--primary)" }} />} />
          </div>


          <section className="cv-card cv-attention">
            <div className="cv-section-head">
              <div>
                <h2>Atenção da Agência</h2>
                <p>O que precisa do seu foco agora.</p>
              </div>
              <Link to="/tasks" className="cv-link">Ver tudo <ChevronRight className="h-3 w-3" /></Link>
            </div>

            <div className="cv-focus-grid">
              <Focus title="Tarefas vencidas" value={overdue} sub="críticas" icon={<Clock3 className="h-4 w-4" style={{ color: "var(--danger)" }} />} />
              <Focus title="Entregas de hoje" value={todayTasks} sub="projetos" icon={<CalendarDays className="h-4 w-4" style={{ color: "var(--primary)" }} />} />
              <Focus title="Projetos em risco" value={riskProjects} sub="críticos" icon={<AlertTriangle className="h-4 w-4" style={{ color: "var(--warning)" }} />} />
              <Focus title="Aprovações pendentes" value={approvals} sub="urgentes" icon={<Clock3 className="h-4 w-4" style={{ color: "var(--purple)" }} />} />
              <Focus title="Entregas concluídas hoje" value={doneToday} sub="Excelente!" icon={<Check className="h-4 w-4" style={{ color: "var(--success)" }} />} />
              <Focus title="Projetos no prazo" value={`${onTime}%`} sub="Dentro do prazo" icon={<CheckCircle2 className="h-4 w-4" style={{ color: "var(--teal)" }} />} />
            </div>

            <div className="cv-table">
              <div className="cv-table-row cv-table-head">
                <span>Pendências críticas</span><span>Cliente / Projeto</span><span>Vencimento</span><span>Prioridade</span><span />
              </div>
              {criticalRows.length === 0 && (
                <div className="cv-table-row"><span style={{ color: "var(--muted)" }}>Nenhuma pendência com prazo definido.</span></div>
              )}
              {criticalRows.map((row) => (
                <div className="cv-table-row" key={row.id}>
                  <span className="cv-issue">
                    <AlertTriangle className="h-3 w-3" />
                    <em>{row.title}</em>
                    <i className="cv-kind">{row.kind}</i>
                  </span>
                  <span><b>{row.project}</b><small>Cliente: {row.client}</small></span>
                  <span style={row.late ? { color: "var(--danger)" } : { color: "var(--muted)" }}>{row.due}</span>
                  <span><i className={`cv-badge ${row.priority === "Crítica" || row.priority === "Urgente" ? "critical" : "high"}`}>{row.priority}</i></span>
                  <Link to="/tasks" className="cv-row-menu" title="Abrir tarefas">⋮</Link>
                </div>
              ))}

            </div>
          </section>

          <div className="cv-lower-grid">
            <section className="cv-card cv-panel">
              <div className="cv-section-head compact">
                <h2>Financeiro / Panorama do mês</h2>
                <Link to="/finance" className="cv-link">Ver relatório <ChevronRight className="h-3 w-3" /></Link>
              </div>
              <div className="cv-finance-values">
                <div><span>Receita</span><strong>{money(revenue)}</strong><small className={revenue >= prevRevenue ? "is-positive" : "is-danger"}>{pctDelta(revenue, prevRevenue)}</small></div>
                <div><span>Despesas</span><strong>{money(expenses)}</strong><small className={expenses <= prevExpenses ? "is-positive" : "is-danger"}>{pctDelta(expenses, prevExpenses)}</small></div>
              </div>
              <div className="cv-finance-viz">
                <div className="cv-chart">
                  <div className="cv-axis-y">
                    {[1, 0.75, 0.5, 0.25].map(f => (
                      <span key={f}>{Math.round((maxBar * f) / 1000)}k</span>
                    ))}
                  </div>
                  <div className="cv-chart-body">
                    <div className="cv-bars">
                      {bars.map((v, i) => (
                        <i key={i} className={i % 2 ? "alt" : ""} title={`Dia ${i + 1}: ${money(v)}`}
                          style={{ height: `${Math.max(2, (v / maxBar) * 100)}%` }} />
                      ))}
                    </div>
                    <div className="cv-axis-x">
                      {[1, 6, 11, 16, 21, 26, daysInMonth].map(d => <span key={d}>{d}</span>)}
                    </div>
                  </div>
                </div>
                <div className="cv-donut-wrap">
                  <div className="cv-donut"><span>{`${margin.toFixed(1).replace(".", ",")}%`}</span></div>
                  <ul>
                    {expenseByCategory.length === 0 && <li style={{ color: "var(--muted)" }}>Sem despesas no mês</li>}
                    {expenseByCategory.map(c => (
                      <li key={c.label}><em className="dot" style={{ background: c.color }} />{c.label} <b>{c.pct}%</b></li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            <section className="cv-card cv-panel">
              <div className="cv-section-head compact">
                <h2>Comercial / Pipeline</h2>
                <Link to="/crm" className="cv-link">Ver pipeline <ChevronRight className="h-3 w-3" /></Link>
              </div>
              <span className="cv-micro cv-block">Valor total</span>
              <strong className="cv-big-value">{money(leadsPipeline)}</strong>
              <span className="cv-micro cv-block">{data.leads.length} oportunidades ativas</span>
              <div className="cv-pipeline">
                <div className="cv-funnel" aria-label="Funil comercial">
                  <svg viewBox="0 0 180 110" role="img">
                    <polygon points="2,2 178,2 164,23 16,23" fill="var(--primary)" />
                    <polygon points="17,25 163,25 150,46 30,46" fill="var(--teal)" />
                    <polygon points="31,48 149,48 136,69 44,69" fill="var(--purple)" />
                    <polygon points="45,71 135,71 122,92 58,92" fill="var(--warning)" />
                    <polygon points="59,94 121,94 111,108 69,108" fill="var(--success)" />
                  </svg>
                </div>
                <ul>
                  {pipelineStages.map((st, i) => (
                    <li key={st.label}>
                      <em className="dot" style={{ background: ["var(--primary)", "var(--teal)", "var(--purple)", "var(--warning)", "var(--success)"][i] }} />
                      {st.label} <b>{money(st.value)}</b> <small style={{ color: "var(--muted)" }}>({st.count})</small>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="cv-footnote">
                {`Fechadas: ${pipelineStages[4]?.count ?? 0} de ${data.leads.length} oportunidades · Conversão ${data.leads.length ? Math.round(((pipelineStages[4]?.count ?? 0) / data.leads.length) * 100) : 0}%`}
              </div>
            </section>

            <section className="cv-card cv-panel">
              <div className="cv-section-head compact">
                <h2>Minha operação / Tarefas do dia</h2>
                <Link to="/tasks" className="cv-link">Ver minhas tarefas <ChevronRight className="h-3 w-3" /></Link>
              </div>
              <div className="cv-task-stats">
                <div><span>A fazer</span><b>{data.tasks.filter((t: any) => t.status === "todo").length}</b></div>
                <div><span>Em andamento</span><b>{data.tasks.filter((t: any) => t.status === "in_progress").length}</b></div>
                <div><span>Em revisão</span><b>{approvals}</b></div>
                <div><span>Concluídas (hoje)</span><b>{doneToday}</b></div>
              </div>
              <h3>Próximas tarefas</h3>
              <div className="cv-task-list">
                {nextTasks.length === 0 && <div style={{ color: "var(--muted)", fontSize: 12 }}>Nenhuma tarefa pendente.</div>}
                {nextTasks.map((t) => (
                  <div key={t.id}>
                    <i className={t.done ? "done" : ""}>{t.done ? "✓" : ""}</i>
                    <span>{t.title}</span>
                    <small>{t.when}</small>
                  </div>
                ))}
              </div>
              <Link to="/tasks" className="cv-link">Ver todas as tarefas <ChevronRight className="h-3 w-3" /></Link>
            </section>

          </div>
        </div>

        <aside className="cv-right-rail">
          <section className="cv-card cv-rail">
            <div className="cv-rail-head">
              <h2 style={{ textTransform: "capitalize" }}>
                {`${new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(now)} ${now.getFullYear()}`}
              </h2>
              <div><button>‹</button><button>›</button></div>
            </div>
            <MiniCalendar now={now} />
          </section>

          <section className="cv-card cv-rail">
            <div className="cv-rail-head">
              <h2 style={{ fontSize: 13 }}>Agenda do dia</h2>
              <Link to="/calendar" className="cv-link">Ver agenda <ChevronRight className="h-3 w-3" /></Link>
            </div>
            <div className="cv-agenda">
              {(data.events as any[]).length === 0 && (
                <div style={{ color: "var(--muted)", fontSize: 12 }}>Nenhum compromisso hoje.</div>
              )}
              {(data.events as any[]).map((e: any, i: number) => {
                const start = new Date(e.starts_at);
                const end = e.ends_at ? new Date(e.ends_at) : null;
                const mins = end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)) : null;
                return (
                  <div className={`cv-agenda-item ${["", "amber", "purple", "teal"][i % 4]}`} key={e.id}>
                    <strong>{start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</strong>
                    <div>
                      <b>{e.title}</b>
                      <span>{[e.description || (e.kind ?? "Compromisso"), mins ? `${mins} min` : null].filter(Boolean).join(" · ")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="cv-card cv-rail">
            <div className="cv-rail-head">
              <h2 style={{ fontSize: 13 }}>Próximas reuniões</h2>
              <Link to="/calendar" className="cv-link">Ver todas <ChevronRight className="h-3 w-3" /></Link>
            </div>
            {(data.upcoming as any[]).length === 0 && (
              <div style={{ color: "var(--muted)", fontSize: 12 }}>Nenhuma reunião agendada.</div>
            )}
            {(data.upcoming as any[]).slice(0, 4).map((e: any) => {
              const start = new Date(e.starts_at);
              const end = e.ends_at ? new Date(e.ends_at) : null;
              const mins = end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)) : null;
              return (
                <div className="cv-meeting" key={e.id}>
                  <time>
                    <b>{String(start.getDate()).padStart(2, "0")}</b>
                    <span>{start.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}</span>
                  </time>
                  <div>
                    <b>{e.title}</b>
                    <span>{[
                      start.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
                      start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                      e.description || null,
                      mins ? `${mins} min` : null,
                    ].filter(Boolean).join(" · ")}</span>
                  </div>
                </div>
              );
            })}
            <Link to="/calendar" className="cv-rail-cta">Ver todas as reuniões</Link>
          </section>
        </aside>
      </div>

      <footer className="cv-footer">
        Caritas Gestão · Todos os direitos reservados · v 2.3.0
      </footer>
    </>

  );
}

function Spark({ tone }: { tone: "blue" | "green" }) {
  return (
    <svg viewBox="0 0 96 34" className={`spark spark-${tone}`} preserveAspectRatio="none">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" strokeLinejoin="round"
        points="0,28 10,24 20,26 30,18 40,21 50,12 60,16 70,9 80,13 96,4" />
    </svg>
  );
}

function Kpi({ label, value, delta, note, spark, icon, danger, info }: {
  label: string; value: string; delta?: string; note?: string;
  spark?: "blue" | "green"; icon?: React.ReactNode; danger?: boolean; info?: boolean;
}) {
  return (
    <article className="cv-card cv-kpi">
      <span className="cv-kpi-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {icon}{label}
        {info && <Info className="h-3 w-3" style={{ color: "var(--muted)", opacity: 0.7 }} />}
      </span>
      <div className="cv-kpi-main">
        <strong>{value}</strong>
        {spark && <Spark tone={spark} />}
      </div>
      <small>
        {delta && <b className={danger ? "is-danger" : "is-positive"} style={{ fontWeight: 600 }}>{delta}</b>}
        {delta && note ? " " : ""}
        {note}
      </small>
    </article>
  );
}


function Focus({ title, value, sub, icon }: { title: string; value: string | number; sub: string; icon: React.ReactNode }) {
  return (
    <div className="cv-focus-card">
      {icon}
      <div><span>{title}</span><strong>{value}</strong><small>{sub}</small></div>
    </div>
  );
}

function MiniCalendar({ now }: { now: Date }) {
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const prevDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const cells: { n: number; muted: boolean }[] = [];
  for (let i = offset - 1; i >= 0; i--) cells.push({ n: prevDays - i, muted: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ n: d, muted: false });
  while (cells.length % 7 !== 0) cells.push({ n: cells.length - offset - daysInMonth + 1, muted: true });
  return (
    <>
      <div className="cv-week">{["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"].map(d => <span key={d}>{d}</span>)}</div>
      <div className="cv-days">
        {cells.map((c, i) => (
          <span key={i} className={c.muted ? "muted" : !c.muted && c.n === now.getDate() ? "selected" : ""}>{c.n}</span>
        ))}
      </div>
    </>
  );
}
