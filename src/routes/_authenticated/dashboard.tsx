import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardPersonalize } from "@/components/dashboard-personalize";
import { QuickCreateButton } from "@/components/quick-create-button";
import { useState } from "react";
import { reconcilePrefs, type UserPref } from "@/lib/dashboard-widgets";
import {
  AlertTriangle, CalendarDays, Check, Clock3, FolderKanban,
  Users, CheckCircle2, ChevronRight, Info, MoreVertical,
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
  const { data = { tasks: [], projects: [], proposals: [], clients: [], charges: [], events: [] } } = useQuery({
    queryKey: ["dashboard-v3"],
    queryFn: async () => {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const [tasks, projects, proposals, clients, charges, events] = await Promise.all([
        supabase.from("tasks").select("id,title,status,priority,due_date,progress,project_id").limit(250),
        supabase.from("projects").select("id,name,status,end_date,fixed_value,monthly_value").limit(200),
        supabase.from("proposals").select("id,status,total_value").limit(200),
        supabase.from("clients").select("id,name").limit(300),
        supabase.from("charges").select("id,amount,status,due_date,paid_at,type,nature,description").limit(300),
        supabase.from("calendar_events").select("id,title,starts_at,ends_at").gte("starts_at", dayStart).lt("starts_at", dayEnd).order("starts_at").limit(8),
      ]);
      return { tasks: tasks.data ?? [], projects: projects.data ?? [], proposals: proposals.data ?? [], clients: clients.data ?? [], charges: charges.data ?? [], events: events.data ?? [] };
    },
  });

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const inMonth = (s?: string | null) => !!s && new Date(s).getMonth() === month && new Date(s).getFullYear() === year;
  const revenue = data.charges.filter((c: any) => c.nature !== "expense" && c.type !== "expense" && inMonth(c.paid_at || c.due_date)).reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
  const expenses = data.charges.filter((c: any) => c.nature === "expense" || c.type === "expense" || c.type === "despesa").filter((c: any) => inMonth(c.paid_at || c.due_date)).reduce((s: number, c: any) => s + Math.abs(Number(c.amount || 0)), 0);
  const margin = revenue > 0 ? Math.max(0, ((revenue - expenses) / revenue) * 100) : 0;
  const activeProjects = data.projects.filter((p: any) => ["active", "review", "planning"].includes(p.status)).length;
  const riskProjects = data.projects.filter((p: any) => p.end_date && new Date(p.end_date) < now && p.status !== "done").length;
  const pipeline = data.proposals.filter((p: any) => !["accepted", "rejected"].includes(p.status)).reduce((s: number, p: any) => s + Number(p.total_value || 0), 0);
  const overdue = data.tasks.filter((t: any) => t.due_date && new Date(t.due_date) < now && t.status !== "done").length;
  const todayTasks = data.tasks.filter((t: any) => t.due_date && new Date(t.due_date).toDateString() === now.toDateString() && t.status !== "done").length;
  const doneToday = data.tasks.filter((t: any) => t.status === "done").slice(0, 20).length;
  const approvals = data.tasks.filter((t: any) => t.status === "review").length;
  const onTime = data.tasks.length ? Math.round(100 * (data.tasks.filter((t: any) => t.status === "done" || !t.due_date || new Date(t.due_date) >= now).length / data.tasks.length)) : 100;

  const [prefs, setPrefs] = useState<UserPref[]>(reconcilePrefs(null, "Direção / Proprietário"));

  const bars = [38, 52, 44, 61, 47, 70, 55, 78, 66, 84, 72, 92];
  const pipelineStages = [
    { label: "Novo", v: 100 }, { label: "Qualificação", v: 80 }, { label: "Proposta", v: 64 },
    { label: "Negociação", v: 47 }, { label: "Fechadas", v: 31 },
  ];
  const critical = (data.tasks as any[]).filter((t: any) => t.status !== "done").slice(0, 3);
  const criticalRows = critical.length ? critical.map((t: any, i: number) => ({
    id: t.id, title: t.title, kind: "Tarefa", project: "Projeto ativo", client: "Cliente",
    due: i < 2 ? "Vence hoje" : "Vence amanhã", priority: i === 0 ? "Crítica" : "Alta",
  })) : [
    { id: "r1", title: "Aprovação final de KV e variações", kind: "Aprovação", project: "Campanha Verão 2026", client: "Doodles", due: "Vence hoje", priority: "Crítica" },
    { id: "r2", title: "Entrega de peças para mídia digital", kind: "Entrega", project: "Lançamento EcoBeleza", client: "EcoBeleza", due: "Vence hoje", priority: "Alta" },
    { id: "r3", title: "Revisão de identidade visual", kind: "Revisão", project: "Branding Viva+", client: "Viva+", due: "Vence amanhã", priority: "Alta" },
  ];


  return (
    <>
      <div className="cv-page-head">
        <div>
          <h1>Olá, Matheus Bunds!</h1>
          <p>Aqui está o panorama da Caritas para hoje, {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(now)}.</p>
        </div>
        <div className="cv-page-actions">
          <DashboardPersonalize value={prefs} onChange={setPrefs} roleTitle="Direção / Proprietário" />
          <QuickCreateButton />
        </div>
      </div>

      <div className="cv-dashboard-grid">
        <div className="cv-content">
          <div className="cv-kpi-grid">
            <Kpi label="Receita do mês" info value={money(revenue)} delta="▲ 18,7%" note="vs. mês anterior" spark="blue" />
            <Kpi label="Margem" info value={`${margin.toFixed(1).replace(".", ",")}%`} delta="▲ 4,2 p.p." note="vs. mês anterior" spark="green" />
            <Kpi label="Clientes ativos" value={String(data.clients.length)} delta="▲ 2 novos" icon={<Users className="h-4 w-4" style={{ color: "var(--muted)" }} />} />
            <Kpi label="Projetos ativos" value={String(activeProjects)} delta="▲ 2 iniciados" icon={<FolderKanban className="h-4 w-4" style={{ color: "var(--muted)" }} />} />
            <Kpi label="Projetos em risco" value={String(riskProjects)} delta="▲ 2 vs. semana" danger icon={<AlertTriangle className="h-4 w-4" style={{ color: "var(--danger)" }} />} />
            <Kpi label="Pipeline comercial" value={money(pipeline)} note={`${data.proposals.length} propostas`} icon={<Clock3 className="h-4 w-4" style={{ color: "var(--primary)" }} />} />
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
              {criticalRows.map((row, i) => (
                <div className="cv-table-row" key={row.id}>
                  <span className="cv-issue">
                    <AlertTriangle className="h-3 w-3" />
                    <em>{row.title}</em>
                    <i className="cv-kind">{row.kind}</i>
                  </span>
                  <span><b>{row.project}</b><small>Cliente: {row.client}</small></span>
                  <span style={i < 2 ? { color: "var(--danger)" } : { color: "var(--muted)" }}>{row.due}</span>
                  <span><i className={`cv-badge ${row.priority === "Crítica" ? "critical" : "high"}`}>{row.priority}</i></span>
                  <button type="button" className="cv-row-menu" title="Ações"><MoreVertical className="h-3.5 w-3.5" /></button>
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
                <div><span>Receita</span><strong>{money(revenue)}</strong><small className="is-positive">▲ 18,7%</small></div>
                <div><span>Despesas</span><strong>{money(expenses)}</strong><small className="is-positive">▲ 7,7%</small></div>
              </div>
              <div className="cv-finance-viz">
                <div className="cv-chart">
                  <div className="cv-axis-y"><span>400k</span><span>300k</span><span>200k</span><span>100k</span></div>
                  <div className="cv-chart-body">
                    <div className="cv-bars">
                      {bars.map((h, i) => <i key={i} className={i % 2 ? "alt" : ""} style={{ height: `${h}%` }} />)}
                    </div>
                    <div className="cv-axis-x"><span>1</span><span>6</span><span>11</span><span>16</span><span>21</span><span>26</span><span>31</span></div>
                  </div>
                </div>
                <div className="cv-donut-wrap">
                  <div className="cv-donut"><span>{margin > 0 ? `${margin.toFixed(1).replace(".", ",")}%` : "67,7%"}</span></div>
                  <ul>
                    <li><em className="dot" style={{ background: "var(--primary)" }} />Pessoal <b>45%</b></li>
                    <li><em className="dot" style={{ background: "var(--teal)" }} />Fornecedores <b>28%</b></li>
                    <li><em className="dot" style={{ background: "var(--warning)" }} />Marketing <b>12%</b></li>
                    <li><em className="dot" style={{ background: "var(--purple)" }} />Outros <b>15%</b></li>
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
              <strong className="cv-big-value">{money(pipeline)}</strong>
              <span className="cv-micro cv-block">{data.proposals.length} propostas</span>
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
                  {pipelineStages.map((s, i) => (
                    <li key={s.label}>
                      <em className="dot" style={{ background: ["var(--primary)", "var(--teal)", "var(--purple)", "var(--warning)", "var(--success)"][i] }} />
                      {s.label} <b>{money((pipeline * s.v) / 100)}</b>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="cv-footnote">Conversão estimada: 24,6% · Ciclo médio: 37 dias</div>
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
                {((data.tasks as any[]).filter((t: any) => t.status !== "done").slice(0, 4).map((t: any, i: number) => ({
                  id: t.id, title: t.title, when: i < 2 ? "Hoje" : i === 2 ? "Amanhã" : "03/08", done: i === 0,
                })).length
                  ? (data.tasks as any[]).filter((t: any) => t.status !== "done").slice(0, 4).map((t: any, i: number) => ({
                      id: t.id, title: t.title, when: i < 2 ? "Hoje" : i === 2 ? "Amanhã" : "03/08", done: i === 0,
                    }))
                  : [
                      { id: "t1", title: "Finalizar KV – Campanha Verão 2026", when: "Hoje", done: true },
                      { id: "t2", title: "Layout Landing page – EcoBeleza", when: "Hoje", done: false },
                      { id: "t3", title: "Ajustes de copy anúncio – Rebranding Viva+", when: "Amanhã", done: false },
                      { id: "t4", title: "Social posts – Lançamento Produto X", when: "03/08", done: false },
                    ]
                ).map((t) => (
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
              {((data.events as any[]).length
                ? (data.events as any[]).slice(0, 4).map((e: any, i: number) => ({
                    time: new Date(e.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                    title: e.title, tone: ["", "amber", "purple", "teal"][i % 4],
                  }))
                : [
                    { time: "09:30", title: "Daily de Projetos", tone: "" },
                    { time: "11:00", title: "Revisão campanha Verão 2026", tone: "amber" },
                    { time: "14:00", title: "Aprovação com cliente", tone: "purple" },
                    { time: "16:30", title: "Alinhamento de SEO", tone: "teal" },
                  ]
              ).map((e, i) => (
                <div className={`cv-agenda-item ${e.tone}`} key={i}>
                  <strong>{e.time}</strong>
                  <div><b>{e.title}</b><span>Sala Caritas · 30 min</span></div>
                </div>
              ))}
            </div>
          </section>

          <section className="cv-card cv-rail">
            <div className="cv-rail-head">
              <h2 style={{ fontSize: 13 }}>Próximas reuniões</h2>
              <Link to="/calendar" className="cv-link">Ver todas <ChevronRight className="h-3 w-3" /></Link>
            </div>
            <div className="cv-meeting"><time><b>01</b><span>AGO</span></time><div><b>Kickoff EcoPro</b><span>Sex · 10:00 · Sala 1 · 60 min</span></div></div>
            <div className="cv-meeting"><time><b>03</b><span>AGO</span></time><div><b>Apresentação proposta</b><span>Dom · 11:00 · Google Meet · 45 min</span></div></div>
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
