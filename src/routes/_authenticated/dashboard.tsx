import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardPersonalize } from "@/components/dashboard-personalize";
import { QuickCreateButton } from "@/components/quick-create-button";
import { useState } from "react";
import { reconcilePrefs, type UserPref } from "@/lib/dashboard-widgets";
import {
  AlertTriangle, CalendarDays, Check, CircleDollarSign, Clock3, FolderKanban,
  Plus, Target, Users, ArrowUpRight, SlidersHorizontal, CheckCircle2, Circle,
} from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date());

function DashboardPage() {
  const { data = { tasks: [], projects: [], proposals: [], clients: [], charges: [], events: [] } } = useQuery({
    queryKey: ["dashboard-v3"],
    queryFn: async () => {
      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1).toISOString();
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
  const revenue = data.charges.filter((c:any)=>c.nature !== "expense" && c.type !== "expense" && inMonth(c.paid_at || c.due_date)).reduce((s:number,c:any)=>s+Number(c.amount||0),0);
  const expenses = data.charges.filter((c:any)=>c.nature === "expense" || c.type === "expense" || c.type === "despesa").filter((c:any)=>inMonth(c.paid_at || c.due_date)).reduce((s:number,c:any)=>s+Math.abs(Number(c.amount||0)),0);
  const margin = revenue > 0 ? Math.max(0, ((revenue-expenses)/revenue)*100) : 0;
  const activeProjects = data.projects.filter((p:any)=>["active","review","planning"].includes(p.status)).length;
  const riskProjects = data.projects.filter((p:any)=>p.end_date && new Date(p.end_date)<now && p.status!=="done").length;
  const pipeline = data.proposals.filter((p:any)=>!["accepted","rejected"].includes(p.status)).reduce((s:number,p:any)=>s+Number(p.total_value||0),0);
  const overdue = data.tasks.filter((t:any)=>t.due_date && new Date(t.due_date)<now && t.status!=="done").length;
  const todayTasks = data.tasks.filter((t:any)=>t.due_date && new Date(t.due_date).toDateString()===now.toDateString() && t.status!=="done").length;
  const doneToday = data.tasks.filter((t:any)=>t.status==="done").slice(0,20).length;
  const approvals = data.tasks.filter((t:any)=>t.status==="review").length;
  const onTime = data.tasks.length ? Math.round(100*(data.tasks.filter((t:any)=>t.status==="done" || !t.due_date || new Date(t.due_date)>=now).length/data.tasks.length)) : 100;

  const [prefs, setPrefs] = useState<UserPref[]>(reconcilePrefs(null, "Direção / Proprietário"));
  const financeBars = [18,24,15,31,19,38,22,42,35,46,40,52].map((v,i)=>({n:i+1, receita:v*1000, despesa:Math.round(v*.64)*1000}));
  const costPie = [
    { name:"Pessoal", value:45, color:"#1268f3" }, { name:"Fornecedores", value:28, color:"#18b98d" },
    { name:"Marketing", value:12, color:"#f59e0b" }, { name:"Outros", value:15, color:"#7c4ee4" },
  ];
  const pipelineData = [100,80,64,47,31].map((v,i)=>({stage:["Novo","Qualificação","Proposta","Negociação","Fechadas"][i],v}));

  return (
    <div className="dash-approved mx-auto max-w-[1535px] space-y-3.5">
      <div className="flex items-end justify-between gap-4">
        <div><h1 className="text-[22px] font-semibold">Olá, Matheus Bunds!</h1><p className="mt-1 text-[10px] text-muted-foreground">Aqui está o panorama da Caritas para hoje, {new Intl.DateTimeFormat("pt-BR", {day:"2-digit",month:"long",year:"numeric"}).format(now)}.</p></div>
        <div className="flex gap-2"><DashboardPersonalize value={prefs} onChange={setPrefs} roleTitle="Direção / Proprietário" /><QuickCreateButton /></div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-12 xl:col-span-10 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Kpi title="Receita do mês" value={money(revenue)} trend="▲ 18,7%" trendSub="vs. mês anterior" chart="blue" />
          <Kpi title="Margem" value={`${margin.toFixed(1).replace('.',',')}%`} trend="▲ 4,2 p.p." trendSub="vs. mês anterior" chart="green" />
          <Kpi title="Clientes ativos" value={String(data.clients.length)} sub="▲ 2 novos" subGreen icon={<Users/>} />
          <Kpi title="Projetos ativos" value={String(activeProjects)} sub="▲ 2 iniciados" subGreen icon={<FolderKanban/>} />
          <Kpi title="Projetos em risco" value={String(riskProjects)} sub="▲ 2 vs. semana" subRed icon={<AlertTriangle className="text-[#E5484D]"/>} />
          <Kpi title="Pipeline comercial" value={money(pipeline)} sub={`${data.proposals.length} propostas`} icon={<Clock3 className="text-primary"/>} />

        </div>

        <aside className="dash-side col-span-12 xl:col-span-2 row-span-3 caritas-panel overflow-hidden">
          <div className="p-4 border-b"><div className="font-semibold capitalize">{monthLabel}</div><MiniCalendar /></div>
          <div className="p-4 border-b"><div className="flex items-center justify-between"><h3 className="font-semibold text-[13px]">Agenda do dia</h3><Link to="/calendar" className="text-[10px] text-primary">Ver agenda completa →</Link></div><div className="mt-3 space-y-3">{(data.events as any[]).length ? (data.events as any[]).slice(0,4).map((e:any,i)=><AgendaRow key={e.id} time={new Date(e.starts_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} title={e.title} color={["#1672ff","#f59e0b","#7c3aed","#14b8a6"][i%4]} />) : <AgendaRow time="09:30" title="Daily de Projetos" color="#1672ff"/>}</div></div>
          <div className="p-4"><div className="flex items-center justify-between"><h3 className="font-semibold text-[13px]">Próximas reuniões</h3><span className="text-[10px] text-primary">Ver todas →</span></div><div className="mt-4 space-y-4"><Meeting day="01" title="Kickoff EcoPro"/><Meeting day="03" title="Apresentação proposta"/></div></div>
        </aside>

        <section className="col-span-12 xl:col-span-10 caritas-panel p-4">
          <div className="flex items-center justify-between"><div><h2 className="text-[15px] font-semibold">Atenção da Agência</h2><p className="mt-0.5 text-[11px] text-muted-foreground">O que precisa do seu foco agora.</p></div><Link to="/tasks" className="text-[11px] text-primary">Ver tudo →</Link></div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
            <Attention title="Tarefas vencidas" value={overdue} sub="críticas" icon={<Clock3/>}/><Attention title="Entregas de hoje" value={todayTasks} sub="projetos" icon={<CalendarDays/>}/><Attention title="Projetos em risco" value={riskProjects} sub="críticos" icon={<AlertTriangle/>}/><Attention title="Aprovações pendentes" value={approvals} sub="urgentes" icon={<Clock3/>}/><Attention title="Entregas concluídas hoje" value={doneToday} sub="Excelente!" icon={<Check/>}/><Attention title="Projetos no prazo" value={`${onTime}%`} sub="Dentro do prazo" icon={<CheckCircle2/>}/>
          </div>
          <div className="mt-4"><div className="grid grid-cols-[1.6fr_1.1fr_.65fr_.65fr_28px] px-1 pb-2 text-[10px] font-medium text-muted-foreground"><span>Pendências críticas</span><span>Cliente / Projeto</span><span>Vencimento</span><span>Prioridade</span><span/></div>{(data.tasks as any[]).filter((t:any)=>t.status!=="done").slice(0,3).map((t:any,i)=><div key={t.id} className="grid grid-cols-[1.6fr_1.1fr_.65fr_.65fr_28px] items-center border-t py-2 text-[11px]"><span className="font-medium flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-red-500"/>{t.title}</span><span className="text-muted-foreground">Projeto ativo</span><span className={i<2?"text-red-500":"text-muted-foreground"}>{i<2?"Vence hoje":"Vence amanhã"}</span><span><span className="rounded-full bg-red-50 px-2 py-1 text-[9px] text-red-600 dark:bg-red-950/30">{i===0?"Crítica":"Alta"}</span></span><span>⋮</span></div>)}</div>
        </section>

        <div className="col-span-12 xl:col-span-10 grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Panel title="Financeiro / Panorama do mês" link="Ver relatório →">
            <div className="grid grid-cols-2 gap-4"><div><div className="text-[10px] text-muted-foreground">Receita</div><div className="text-[16px] font-semibold">{money(revenue)}</div><div className="text-[10px] text-green-600">▲ 18,7%</div></div><div><div className="text-[10px] text-muted-foreground">Despesas</div><div className="text-[16px] font-semibold">{money(expenses)}</div><div className="text-[10px] text-green-600">▲ 7,7%</div></div></div>
            <div className="mt-3 h-[145px] grid grid-cols-[1.5fr_1fr] gap-3"><ResponsiveContainer><BarChart data={financeBars}><XAxis dataKey="n" hide/><YAxis hide/><Tooltip/><Bar dataKey="receita" fill="#1268f3" radius={[2,2,0,0]}/><Bar dataKey="despesa" fill="#23b981" radius={[2,2,0,0]}/></BarChart></ResponsiveContainer><ResponsiveContainer><PieChart><Pie data={costPie} dataKey="value" innerRadius={32} outerRadius={48} paddingAngle={1}>{costPie.map((x,i)=><Cell key={i} fill={x.color}/>)}</Pie></PieChart></ResponsiveContainer></div>
          </Panel>
          <Panel title="Comercial / Pipeline" link="Ver pipeline →"><div className="text-[10px] text-muted-foreground">Valor total</div><div className="text-[16px] font-semibold">{money(pipeline)}</div><div className="mt-3 space-y-1.5">{pipelineData.map((x,i)=><div key={x.stage} className="flex items-center gap-2"><div className="h-6 rounded-sm" style={{width:`${x.v}%`,background:["#1268f3","#16b5a2","#6d4fd7","#f4a315","#4fb86d"][i]}}/><span className="text-[9px] text-muted-foreground whitespace-nowrap">{x.stage}</span></div>)}</div></Panel>
          <Panel title="Minha operação / Tarefas do dia" link="Ver minhas tarefas →"><div className="grid grid-cols-4 divide-x text-center"><MiniStat l="A fazer" v={data.tasks.filter((t:any)=>t.status==='todo').length}/><MiniStat l="Em andamento" v={data.tasks.filter((t:any)=>t.status==='in_progress').length}/><MiniStat l="Em revisão" v={approvals}/><MiniStat l="Concluídas (hoje)" v={doneToday}/></div><div className="mt-4 space-y-2">{(data.tasks as any[]).filter((t:any)=>t.status!=="done").slice(0,4).map((t:any,i)=><div key={t.id} className="flex items-center gap-2 text-[11px]"><Circle className={i===0?"h-3.5 w-3.5 text-emerald-500 fill-emerald-500":"h-3.5 w-3.5 text-muted-foreground"}/><span className="flex-1 truncate">{t.title}</span><span className="text-[10px] text-muted-foreground">{i<2?"Hoje":"Amanhã"}</span></div>)}</div></Panel>
        </div>
      </div>
      <div className="text-center text-[9px] text-muted-foreground">Caritas Gestão · Todos os direitos reservados · v2.3.0</div>
    </div>
  );
}

function Spark({color}:{color:string}) {
  return <svg viewBox="0 0 96 34" className="h-[34px] w-[96px]" preserveAspectRatio="none"><polyline fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" points="0,28 10,24 20,26 30,18 40,21 50,12 60,16 70,9 80,13 96,4"/></svg>;
}
function Kpi({title,value,trend,trendSub,sub,subGreen,subRed,icon,chart}:{title:string;value:string;trend?:string;trendSub?:string;sub?:string;subGreen?:boolean;subRed?:boolean;icon?:React.ReactNode;chart?:"blue"|"green"}) {
  return (
    <Card className="caritas-kpi min-h-[108px] p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium">
          {icon && <span className="text-muted-foreground [&>svg]:h-[15px] [&>svg]:w-[15px]">{icon}</span>}
          <span>{title}</span>
          {chart && <Info className="h-3 w-3 text-muted-foreground/60" />}
        </div>
        {chart && <Spark color={chart === "green" ? "#16A34A" : "var(--primary)"} />}
      </div>
      <div className="mt-3 text-[22px] font-semibold tracking-tight">{value}</div>
      <div className="mt-1 flex items-center gap-1 text-[9px]">
        <span className={trend || subGreen ? "text-[#16A34A]" : subRed ? "text-[#E5484D]" : "text-muted-foreground"}>{trend || sub}</span>
        {trendSub && <span className="text-muted-foreground">{trendSub}</span>}
      </div>
    </Card>
  );
}

function Attention({title,value,sub,icon}:{title:string;value:string|number;sub:string;icon:React.ReactNode}) { return <div className="rounded-[11px] border bg-card px-3 py-3"><div className="flex gap-2"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</div><div><div className="text-[10px] font-medium">{title}</div><div className="mt-0.5 text-[17px] font-semibold leading-none">{value}</div><div className="mt-1 text-[9px] text-muted-foreground">{sub}</div></div></div></div> }
function Panel({title,link,children}:{title:string;link:string;children:React.ReactNode}) { return <section className="caritas-panel p-4 min-h-[260px]"><div className="mb-4 flex items-center justify-between"><h3 className="text-[13px] font-semibold">{title}</h3><span className="text-[10px] text-primary">{link}</span></div>{children}</section> }
function MiniStat({l,v}:{l:string;v:number}){return <div className="px-2"><div className="text-[8px] text-muted-foreground">{l}</div><div className="mt-1 text-[15px] font-semibold">{v}</div></div>}
function AgendaRow({time,title,color}:{time:string;title:string;color:string}){return <div className="flex gap-2"><span className="w-10 text-[10px] font-medium">{time}</span><div className="border-l-2 pl-2" style={{borderColor:color}}><div className="text-[10px] font-medium">{title}</div><div className="text-[9px] text-muted-foreground">Sala Caritas · 30 min</div></div></div>}
function Meeting({day,title}:{day:string;title:string}){return <div className="flex gap-3"><div className="text-center"><div className="text-[15px] font-semibold leading-none">{day}</div><div className="mt-1 text-[8px] text-muted-foreground">AGO</div></div><div><div className="text-[10px] font-medium">{title}</div><div className="mt-1 text-[9px] text-muted-foreground">Sex · 10:00 · Sala 1</div></div></div>}
function MiniCalendar(){const nums=[29,30,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,1,2];return <div className="mt-3 grid grid-cols-7 gap-y-2 text-center text-[9px]"><>{["SEG","TER","QUA","QUI","SEX","SÁB","DOM"].map(x=><span className="text-[7px] text-muted-foreground" key={x}>{x}</span>)}</>{nums.map((n,i)=><span key={i} className={n===31?"mx-auto grid h-6 w-6 place-items-center rounded-full bg-primary text-white":"text-foreground"}>{n}</span>)}</div>}
