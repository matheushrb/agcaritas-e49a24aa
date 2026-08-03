import { useState } from "react";
import {
  BookOpen, Pencil, LayoutGrid, Users, Filter, Target, ListChecks,
  ThumbsUp, ThumbsDown, ArrowUpCircle, AlertOctagon, Check, Calendar,
  ChevronLeft, ChevronRight, ArrowRight,
} from "lucide-react";
import "@/prj05.css";

const initials = (n: string) =>
  n.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

const SWOT = [
  {
    key: "f", title: "Forças", color: "#10B981", icon: ThumbsUp,
    items: ["Equipe experiente e multidisciplinar", "Portfólio com cases relevantes", "Metodologia própria validada", "Relacionamento próximo com clientes"],
  },
  {
    key: "w", title: "Fraquezas", color: "#F59E0B", icon: ThumbsDown,
    items: ["Marca pouco conhecida fora do network", "Presença digital ainda inconsistente", "Processos comerciais informais", "Dependência de poucos clientes"],
  },
  {
    key: "o", title: "Oportunidades", color: "#2F6BEF", icon: ArrowUpCircle,
    items: ["Crescimento do mercado de branding", "Demanda por posicionamento autêntico", "Expansão para novos segmentos", "Parcerias estratégicas"],
  },
  {
    key: "t", title: "Ameaças", color: "#EF4444", icon: AlertOctagon,
    items: ["Concorrência de grandes agências", "Commoditização de serviços criativos", "Mudanças rápidas de comportamento", "Pressão por preço"],
  },
];

const PERSONAS = [
  {
    name: "Juliana Nascimento", role: "CMO | Tech B2B",
    tags: ["Estratégica", "Exigente", "Orientada a ROI"],
    goals: "Fortalecer marca e gerar demanda qualificada.",
    pains: "Provar impacto e alinhar stakeholders.",
    help: "Estratégia clara, identidade forte e mensuração.",
  },
  {
    name: "Rafael Souza", role: "Founder | Scale-up",
    tags: ["Visionário", "Pragmático", "Inovador"],
    goals: "Construir marca sólida para escalar.",
    pains: "Recursos limitados e time enxuto.",
    help: "Soluções ágeis com foco em crescimento.",
  },
  {
    name: "Marina Alves", role: "Head de Growth | Varejo",
    tags: ["Analítica", "Rápida", "Data-driven"],
    goals: "Aumentar conversão e recorrência.",
    pains: "Campanhas sem consistência de marca.",
    help: "Narrativa consistente e criativos performáticos.",
  },
  {
    name: "Pedro Lima", role: "Diretor Comercial | Serviços",
    tags: ["Direto", "Focado", "Comercial"],
    goals: "Encurtar o ciclo de vendas.",
    pains: "Materiais desalinhados com o discurso.",
    help: "Posicionamento e materiais de venda claros.",
  },
];

const COMPETITORS = [
  { name: "BrandHaus", short: "BH", pos: "Agência full-service", strong: "Time grande, presença nacional", gap: "Menos foco em estratégia e personalização", threat: "Alta" },
  { name: "Oito Branding", short: "OB", pos: "Branding estratégico", strong: "Metodologia forte, reconhecimento", gap: "Capacidade limitada de execução", threat: "Média" },
  { name: "Estúdio Delta", short: "ED", pos: "Design e identidade", strong: "Design autoral, premiações", gap: "Menos foco em negócio e performance", threat: "Baixa" },
  { name: "Agência Uno", short: "AU", pos: "Marketing integrado", strong: "Performance e mídia", gap: "Branding não é o core", threat: "Baixa" },
];
const threatClass = (t: string) => (t === "Alta" ? "red" : t === "Média" ? "amber" : "green");

const KPIS = [
  { kpi: "Reconhecimento de marca", goal: "+35%", value: 62, label: "62%", status: "No caminho" },
  { kpi: "NPS de clientes", goal: "≥ 70", value: 68, label: "68", status: "No caminho" },
  { kpi: "Novos leads qualificados/mês", goal: "+50%", value: 41, label: "41%", status: "Em atenção" },
  { kpi: "Taxa de conversão proposta", goal: "≥ 25%", value: 24, label: "24%", status: "Em atenção" },
  { kpi: "Receita vinda de novos clientes", goal: "+40%", value: 32, label: "32%", status: "No caminho" },
  { kpi: "Share of wallet médio", goal: "≥ 60%", value: 58, label: "58%", status: "Risco" },
];
const statusClass = (s: string) => (s === "No caminho" ? "blue" : s === "Em atenção" ? "amber" : "red");

const STEPS = [
  { id: 1, title: "Validar posicionamento com clientes-chave", date: "28 mai 2026", owner: "Matheus Bunds", done: false },
  { id: 2, title: "Finalizar arquitetura de marca", date: "15 mai 2026", owner: "Ana Prado", done: true },
  { id: 3, title: "Aprovar identidade visual", date: "05 jun 2026", owner: "Carlos Reis", done: false },
  { id: 4, title: "Alinhar narrativa e tom de voz", date: "12 jun 2026", owner: "Bia Souza", done: false },
  { id: 5, title: "Planejar campanha de lançamento", date: "26 jun 2026", owner: "Duda Melo", done: false },
];

export function Prj05Strategy({
  description,
  onSaveDescription,
}: {
  description: string;
  onSaveDescription?: (d: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description);
  const [page, setPage] = useState(0);
  const [steps, setSteps] = useState(STEPS);

  const personas = PERSONAS.slice(page * 2, page * 2 + 2);
  const maxPage = Math.ceil(PERSONAS.length / 2) - 1;

  return (
    <div className="prj05">
      <div className="p5-grid">
        {/* 1. Briefing */}
        <section className="p5-card">
          <div className="p5-card-h">
            <div className="p5-ht"><BookOpen /><span className="p5-card-t">1. Briefing e posicionamento</span></div>
            <button type="button" className="p5-ghost" onClick={() => { setDraft(description); setEditing(v => !v); }}>
              <Pencil />
            </button>
          </div>
          {editing ? (
            <div style={{ padding: "2px 16px 18px" }}>
              <textarea className="p5-ta" value={draft} onChange={e => setDraft(e.target.value)} />
              <button
                type="button" className="p5-save"
                onClick={() => { onSaveDescription?.(draft); setEditing(false); }}
              >
                Salvar
              </button>
            </div>
          ) : (
            <div className="p5-brief">
              <div>
                <div className="p5-bl">Propósito</div>
                <p className="p5-bt">
                  {description?.trim() ||
                    "Reposicionar a marca com parceria estratégica que impulsiona negócios através de soluções criativas, humanas e orientadas a resultados."}
                </p>
              </div>
              <div>
                <div className="p5-bl">Público-alvo principal</div>
                <p className="p5-bt">CMOs, gerentes de marketing e founders de empresas B2B de médio porte, inovadoras e em crescimento.</p>
              </div>
              <div>
                <div className="p5-bl">Essência da marca</div>
                <div className="p5-chips">
                  {["Criativa", "Colaborativa", "Estratégica", "Confiável"].map(c => (
                    <span key={c} className="p5-chip">{c}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="p5-bl">Tom de voz</div>
                <p className="p5-bt">Inspirador, claro e próximo. Do estratégico ao humano, sem perder a objetividade.</p>
              </div>
              <div>
                <div className="p5-bl">Proposta de valor</div>
                <p className="p5-bt">Transformamos ideias em experiências de marca que conectam, engajam e geram resultados reais.</p>
              </div>
              <div>
                <div className="p5-bl">Posicionamento</div>
                <p className="p5-bt">Criatividade com método. Parceria que gera impacto.</p>
              </div>
            </div>
          )}
        </section>

        {/* 2. SWOT */}
        <section className="p5-card">
          <div className="p5-card-h">
            <div className="p5-ht"><LayoutGrid /><span className="p5-card-t">2. Análise SWOT</span></div>
          </div>
          <div className="p5-swot">
            {SWOT.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.key} className="p5-sw">
                  <div className="p5-sw-h">
                    <span className="p5-dot" style={{ background: s.color }}><Icon /></span>
                    <b>{s.title}</b>
                  </div>
                  <ul>{s.items.map(i => <li key={i}>{i}</li>)}</ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. Personas */}
        <section className="p5-card">
          <div className="p5-card-h">
            <div className="p5-ht"><Users /><span className="p5-card-t">3. Personas principais</span></div>
            <button type="button" className="p5-link">Ver todas ({PERSONAS.length})</button>
          </div>
          <div className="p5-personas">
            <div className="p5-pgrid">
              {personas.map(p => (
                <div key={p.name} className="p5-persona">
                  <div className="p5-p-top">
                    <span className="p5-av">{initials(p.name)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="p5-p-name">{p.name}</div>
                      <div className="p5-p-role">{p.role}</div>
                      <div className="p5-chips" style={{ marginTop: 6 }}>
                        {p.tags.map(t => <span key={t} className="p5-chip">{t}</span>)}
                      </div>
                    </div>
                  </div>
                  <div className="p5-p-sec"><b>Objetivos</b><span>{p.goals}</span></div>
                  <div className="p5-p-sec"><b>Desafios</b><span>{p.pains}</span></div>
                  <div className="p5-p-sec"><b>Como ajudamos</b><span>{p.help}</span></div>
                </div>
              ))}
            </div>
            <div className="p5-nav">
              <button type="button" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}><ChevronLeft /></button>
              <button type="button" disabled={page >= maxPage} onClick={() => setPage(p => Math.min(maxPage, p + 1))}><ChevronRight /></button>
            </div>
          </div>
        </section>
      </div>

      <div className="p5-grid">
        {/* 4. Concorrentes */}
        <section className="p5-card">
          <div className="p5-card-h">
            <div className="p5-ht"><Filter /><span className="p5-card-t">4. Concorrentes</span></div>
            <button type="button" className="p5-link">Ver análise completa</button>
          </div>
          <table className="p5-table">
            <thead>
              <tr>
                <th>Concorrente</th><th>Posicionamento</th><th>Pontos fortes</th><th>Gap vs. nós</th><th>Ameaça</th>
              </tr>
            </thead>
            <tbody>
              {COMPETITORS.map(c => (
                <tr key={c.name}>
                  <td>
                    <div className="p5-comp"><span className="p5-logo">{c.short}</span><b>{c.name}</b></div>
                  </td>
                  <td>{c.pos}</td>
                  <td>{c.strong}</td>
                  <td>{c.gap}</td>
                  <td><span className={`p5-badge ${threatClass(c.threat)}`}>{c.threat}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 5. KPIs estratégicos */}
        <section className="p5-card">
          <div className="p5-card-h">
            <div className="p5-ht"><Target /><span className="p5-card-t">5. KPIs estratégicos</span></div>
            <button type="button" className="p5-link">Ver todos</button>
          </div>
          <table className="p5-table">
            <thead>
              <tr><th>KPI</th><th>Meta</th><th>Progresso</th><th>Status</th></tr>
            </thead>
            <tbody>
              {KPIS.map(k => (
                <tr key={k.kpi} className="p5-kpi-row">
                  <td style={{ color: "var(--p5-ink)" }}>{k.kpi}</td>
                  <td>{k.goal}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="p5-num" style={{ width: 32 }}>{k.label}</span>
                      <span className="p5-bar"><i style={{ width: `${k.value}%` }} /></span>
                    </div>
                  </td>
                  <td><span className={`p5-badge ${statusClass(k.status)}`}>{k.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 6. Próximos passos */}
        <section className="p5-card">
          <div className="p5-card-h">
            <div className="p5-ht"><ListChecks /><span className="p5-card-t">6. Próximos passos estratégicos</span></div>
          </div>
          <div className="p5-steps">
            {steps.map(s => (
              <div key={s.id} className={`p5-step${s.done ? " done" : ""}`}>
                <button
                  type="button"
                  className={`p5-check${s.done ? " on" : ""}`}
                  onClick={() => setSteps(list => list.map(x => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                >
                  {s.done && <Check />}
                </button>
                <span className="p5-step-t">{s.title}</span>
                <span className="p5-date"><Calendar />{s.date}</span>
                <span className="p5-mini">{initials(s.owner)}</span>
              </div>
            ))}
          </div>
          <div className="p5-foot">
            <button type="button">Ver todas as iniciativas <ArrowRight /></button>
          </div>
        </section>
      </div>
    </div>
  );
}
