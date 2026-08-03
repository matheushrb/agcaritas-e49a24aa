import { useMemo, useState } from "react";
import {
  Info, TrendingUp, TrendingDown, Download, PenLine, Plus, ChevronDown, ChevronRight,
  ChevronLeft, Search, SlidersHorizontal, MoreHorizontal, ArrowRight,
} from "lucide-react";
import "@/fin02.css";

/* ================= tipos ================= */
export type F2Invoice = {
  id: string;
  number: string | null;
  client_id: string | null;
  project_id: string | null;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  total: number | string | null;
  amount: number | string | null;
  payment_method?: string | null;
};
export type F2Named = { id: string; name: string };

/* ================= helpers ================= */
const n = (v: number | string | null | undefined) => Number(v ?? 0) || 0;
const total = (i: F2Invoice) => n(i.total ?? i.amount);
const money = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const money2 = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct1 = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const fmt = (s: string | null) =>
  s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—";
const mk = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const MONTHS_ABBR = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const daysTo = (s: string | null) => {
  if (!s) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const d = new Date(`${s.slice(0, 10)}T12:00:00`); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
};
const dueLabel = (s: string | null) => {
  const d = daysTo(s);
  if (d === null) return { text: "Sem data", tone: "" };
  if (d < 0) return { text: `Venceu há ${Math.abs(d)}d`, tone: "danger" };
  if (d === 0) return { text: "Vence hoje", tone: "danger" };
  return { text: `Vence em ${d} dia${d > 1 ? "s" : ""}`, tone: d <= 7 ? "warn" : "" };
};

/** Status derivado: pagas / a receber / vencidas / rascunho / canceladas */
type Derived = "paid" | "receivable" | "overdue" | "draft" | "canceled";
const derive = (i: F2Invoice): Derived => {
  if (i.status === "paid" || i.paid_at) return "paid";
  if (i.status === "canceled" || i.status === "cancelled") return "canceled";
  if (i.status === "draft") return "draft";
  return (daysTo(i.due_date) ?? 1) < 0 ? "overdue" : "receivable";
};
const D_META: Record<Derived, { label: string; cls: string; color: string }> = {
  paid: { label: "Paga", cls: "green", color: "#10B981" },
  receivable: { label: "A receber", cls: "amber", color: "#F59E0B" },
  overdue: { label: "Vencida", cls: "red", color: "#EF4444" },
  draft: { label: "Rascunho", cls: "blue", color: "#2F6BEF" },
  canceled: { label: "Cancelada", cls: "gray", color: "#9AA3B2" },
};

const PAY_LABEL: Record<string, string> = {
  pix: "Pix", boleto: "Boleto", transfer: "Transferência",
  card: "Cartão", cash: "Dinheiro", other: "Outra",
};

function Spark({ points, color }: { points: number[]; color: string }) {
  const w = 96, h = 34;
  const vals = points.length > 1 ? points : [0, 0];
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const d = vals.map((v, i) =>
    `${i === 0 ? "M" : "L"}${(i / (vals.length - 1)) * w},${h - ((v - min) / span) * (h - 6) - 3}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Donut({ size, stroke, segments, center, label }: {
  size: number; stroke: number; segments: { v: number; color: string }[]; center: string; label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const sum = segments.reduce((s, x) => s + x.v, 0) || 1;
  let acc = 0;
  return (
    <div className="f2-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF1F6" strokeWidth={stroke} />
        {segments.filter(s => s.v > 0).map((s, i) => {
          const len = (s.v / sum) * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${Math.max(len - 2, 0)} ${c}`} strokeDashoffset={-acc}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="f2-donut-c">
        <span className="f2-donut-v">{center}</span>
        <span className="f2-donut-l">{label}</span>
      </div>
    </div>
  );
}

/* ================= componente ================= */
export function Fin02Invoices({
  invoices, clients, projects, onOpen, onNewInvoice, onNewCharge, onExport,
}: {
  invoices: F2Invoice[];
  clients: F2Named[];
  projects: F2Named[];
  onOpen: (id: string) => void;
  onNewInvoice: () => void;
  onNewCharge: () => void;
  onExport: () => void;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | Derived>("all");
  const [clientId, setClientId] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [pay, setPay] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState(10);

  const clientName = (id: string | null) => clients.find(c => c.id === id)?.name ?? "—";
  const projectName = (id: string | null) => projects.find(p => p.id === id)?.name ?? "Múltiplos";

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return invoices.filter(i => {
      if (status !== "all" && derive(i) !== status) return false;
      if (clientId !== "all" && i.client_id !== clientId) return false;
      if (projectId !== "all" && i.project_id !== projectId) return false;
      if (pay !== "all" && (i.payment_method ?? "") !== pay) return false;
      const ref = (i.issue_date ?? "").slice(0, 10);
      if (from && ref && ref < from) return false;
      if (to && ref && ref > to) return false;
      if (term) {
        const hay = `${i.number ?? ""} ${clientName(i.client_id)} ${projectName(i.project_id)}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [invoices, q, status, clientId, projectId, pay, from, to, clients, projects]);

  /* ---- KPIs (base: todas as faturas, séries 12 meses) ---- */
  const months = useMemo(() => {
    const out: string[] = []; const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 11);
    for (let i = 0; i < 12; i++) { out.push(mk(d)); d.setMonth(d.getMonth() + 1); }
    return out;
  }, []);

  const kpis = useMemo(() => {
    const issuedBy: Record<string, number> = {}, paidBy: Record<string, number> = {};
    const recvBy: Record<string, number> = {}, overBy: Record<string, number> = {};
    for (const m of months) { issuedBy[m] = 0; paidBy[m] = 0; recvBy[m] = 0; overBy[m] = 0; }
    for (const i of invoices) {
      const d = derive(i);
      if (d === "canceled" || d === "draft") continue;
      const v = total(i);
      const ki = (i.issue_date ?? "").slice(0, 7);
      if (ki in issuedBy) issuedBy[ki] += v;
      const kp = (i.paid_at ?? i.due_date ?? "").slice(0, 7);
      if (d === "paid" && kp in paidBy) paidBy[kp] += v;
      const kd = (i.due_date ?? "").slice(0, 7);
      if (d === "receivable" && kd in recvBy) recvBy[kd] += v;
      if (d === "overdue" && kd in overBy) overBy[kd] += v;
    }
    const cur = mk(new Date());
    const prevD = new Date(); prevD.setDate(1); prevD.setMonth(prevD.getMonth() - 1);
    const prev = mk(prevD);
    const delta = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / Math.abs(b)) * 100);

    const open = invoices.filter(i => ["receivable", "overdue"].includes(derive(i)));
    const receivable = open.reduce((s, i) => s + total(i), 0);
    const overdue = invoices.filter(i => derive(i) === "overdue").reduce((s, i) => s + total(i), 0);
    const inad = receivable > 0 ? (overdue / receivable) * 100 : 0;
    const prevOpenBase = (recvBy[prev] ?? 0) + (overBy[prev] ?? 0);
    const inadPrev = prevOpenBase > 0 ? ((overBy[prev] ?? 0) / prevOpenBase) * 100 : 0;

    return {
      issued: issuedBy[cur] ?? 0, dIssued: delta(issuedBy[cur] ?? 0, issuedBy[prev] ?? 0),
      receivable, dRecv: delta(recvBy[cur] ?? 0, recvBy[prev] ?? 0),
      received: paidBy[cur] ?? 0, dPaid: delta(paidBy[cur] ?? 0, paidBy[prev] ?? 0),
      overdue, dOver: delta(overBy[cur] ?? 0, overBy[prev] ?? 0),
      inad, dInad: inad - inadPrev,
      sIssued: months.map(m => issuedBy[m]), sRecv: months.map(m => recvBy[m]),
      sPaid: months.map(m => paidBy[m]), sOver: months.map(m => overBy[m]),
      sInad: months.map(m => {
        const base = (recvBy[m] ?? 0) + (overBy[m] ?? 0);
        return base > 0 ? ((overBy[m] ?? 0) / base) * 100 : 0;
      }),
    };
  }, [invoices, months]);

  /* ---- distribuição por status (período filtrado) ---- */
  const dist = useMemo(() => {
    const order: Derived[] = ["paid", "receivable", "draft", "overdue", "canceled"];
    const counts = order.map(k => ({ k, v: filtered.filter(i => derive(i) === k).length }));
    return { order: counts, total: filtered.length };
  }, [filtered]);

  /* ---- próximos vencimentos ---- */
  const upcoming = useMemo(
    () => filtered.filter(i => ["receivable", "overdue"].includes(derive(i)))
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")).slice(0, 4),
    [filtered],
  );

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const cur = Math.min(page, pages - 1);
  const rows = filtered.slice(cur * perPage, cur * perPage + perPage);
  const reset = () => {
    setQ(""); setStatus("all"); setClientId("all"); setProjectId("all");
    setPay("all"); setFrom(""); setTo(""); setPage(0);
  };

  return (
    <div className="fin02">
      {/* header */}
      <div className="f2-head">
        <div>
          <h1 className="f2-title">Faturas</h1>
          <p className="f2-sub">Controle cobranças, parcelas, recebimentos e vencimentos da agência.</p>
        </div>
        <div className="f2-actions">
          <button className="f2-btn" onClick={onExport}><Download /> Exportar</button>
          <button className="f2-btn ghost" onClick={onNewCharge}><PenLine /> Nova cobrança</button>
          <button className="f2-btn primary" onClick={onNewInvoice}><Plus /> Nova fatura</button>
          <button className="f2-btn primary split" onClick={onNewInvoice} aria-label="Mais opções"><ChevronDown /></button>
        </div>
      </div>

      {/* KPIs */}
      <div className="f2-kpis">
        <Kpi label="Emitidas no mês" value={money(kpis.issued)} delta={kpis.dIssued} spark={kpis.sIssued} color="#2F6BEF" />
        <Kpi label="A receber" value={money(kpis.receivable)} delta={kpis.dRecv} spark={kpis.sRecv} color="#10B981" />
        <Kpi label="Recebidas" value={money(kpis.received)} delta={kpis.dPaid} spark={kpis.sPaid} color="#2F6BEF" />
        <Kpi label="Vencidas" value={money(kpis.overdue)} delta={kpis.dOver} spark={kpis.sOver} color="#EF4444" invert />
        <Kpi label="Inadimplência" value={pct1(kpis.inad)} delta={kpis.dInad} spark={kpis.sInad} color="#EF4444" invert pp />
      </div>

      {/* filtros */}
      <div className="f2-card f2-filters">
        <div className="f2-search">
          <Search />
          <input
            placeholder="Buscar por número da fatura, cliente ou projeto…"
            value={q} onChange={e => { setQ(e.target.value); setPage(0); }}
          />
        </div>
        <div className="f2-field">
          <label htmlFor="f2-st">Status</label>
          <select id="f2-st" value={status} onChange={e => { setStatus(e.target.value as typeof status); setPage(0); }}>
            <option value="all">Todos</option>
            <option value="paid">Pagas</option>
            <option value="receivable">A receber</option>
            <option value="overdue">Vencidas</option>
            <option value="draft">Rascunho</option>
            <option value="canceled">Canceladas</option>
          </select>
        </div>
        <div className="f2-field">
          <label htmlFor="f2-cl">Cliente</label>
          <select id="f2-cl" value={clientId} onChange={e => { setClientId(e.target.value); setPage(0); }}>
            <option value="all">Todos</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="f2-field">
          <label htmlFor="f2-pj">Projeto</label>
          <select id="f2-pj" value={projectId} onChange={e => { setProjectId(e.target.value); setPage(0); }}>
            <option value="all">Todos</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="f2-field">
          <label htmlFor="f2-pm">Forma de pagamento</label>
          <select id="f2-pm" value={pay} onChange={e => { setPay(e.target.value); setPage(0); }}>
            <option value="all">Todas</option>
            {Object.entries(PAY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="f2-field">
          <label htmlFor="f2-from">Período</label>
          <div className="f2-period">
            <input id="f2-from" type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(0); }} />
            <span className="f2-dim">–</span>
            <input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(0); }} />
          </div>
        </div>
        <button className="f2-clear" onClick={reset}><SlidersHorizontal /> Limpar filtros</button>
      </div>

      {/* conteúdo */}
      <div className="f2-main">
        <section className="f2-card">
          <div className="f2-tablewrap">
            <table className="f2-table">
              <thead>
                <tr>
                  <th>Número da fatura</th><th>Cliente</th><th>Projeto</th><th>Parcela</th>
                  <th>Emissão</th><th>Vencimento</th><th>Valor</th><th>Status</th>
                  <th>Recebido</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(i => {
                  const d = derive(i);
                  const meta = D_META[d];
                  const received = d === "paid" ? total(i) : 0;
                  return (
                    <tr key={i.id}>
                      <td>
                        <button className="f2-num" onClick={() => onOpen(i.id)}>
                          {i.number?.trim() ? i.number : "— rascunho"}
                        </button>
                      </td>
                      <td>{clientName(i.client_id)}</td>
                      <td>{projectName(i.project_id)}</td>
                      <td className="f2-dim">1/1</td>
                      <td>{fmt(i.issue_date)}</td>
                      <td>{fmt(i.due_date)}</td>
                      <td className="f2-money">{money2(total(i))}</td>
                      <td><span className={`f2-pill ${meta.cls}`}>{meta.label}</span></td>
                      <td className="f2-money" style={{ color: received ? "#0F9D63" : undefined }}>{money2(received)}</td>
                      <td>
                        <button className="f2-dots" onClick={() => onOpen(i.id)} aria-label="Ações">
                          <MoreHorizontal size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <p className="f2-empty">Nenhuma fatura encontrada com os filtros atuais.</p>
          )}
          {filtered.length > 0 && (
            <div className="f2-foot">
              <span>
                Mostrando {cur * perPage + 1} a {Math.min((cur + 1) * perPage, filtered.length)} de {filtered.length} faturas
              </span>
              <div className="f2-pg">
                <button disabled={cur === 0} onClick={() => setPage(cur - 1)}><ChevronLeft size={14} /></button>
                {Array.from({ length: Math.min(pages, 5) }).map((_, i) => {
                  const start = Math.max(0, Math.min(cur - 2, pages - 5));
                  const idx = pages <= 5 ? i : start + i;
                  return (
                    <button key={idx} className={idx === cur ? "on" : ""} onClick={() => setPage(idx)}>{idx + 1}</button>
                  );
                })}
                <button disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}><ChevronRight size={14} /></button>
              </div>
              <span className="f2-perpage">
                <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(0); }}>
                  <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
                </select>
                por página
              </span>
            </div>
          )}
        </section>

        <div className="f2-right">
          <section className="f2-card">
            <div className="f2-card-h">
              <span className="f2-card-t">Próximos vencimentos</span>
              <button className="f2-link" onClick={() => { setStatus("receivable"); setPage(0); }}>
                Ver todos <ArrowRight />
              </button>
            </div>
            {upcoming.length === 0 ? (
              <p className="f2-empty" style={{ padding: "18px 16px 22px" }}>Nenhum vencimento em aberto.</p>
            ) : (
              <div style={{ paddingBottom: 8 }}>
                {upcoming.map(i => {
                  const due = dueLabel(i.due_date);
                  const d = i.due_date ? new Date(`${i.due_date.slice(0, 10)}T12:00:00`) : null;
                  return (
                    <div className="f2-due" key={i.id}>
                      <div className="f2-date">
                        <b>{d ? String(d.getDate()).padStart(2, "0") : "--"}</b>
                        <span>{d ? MONTHS_ABBR[d.getMonth()] : ""}</span>
                      </div>
                      <div className="f2-due-b">
                        <div className="f2-due-t">{projectName(i.project_id)}</div>
                        <div className="f2-due-s">{clientName(i.client_id)}</div>
                      </div>
                      <div className="f2-due-r">
                        <div className="f2-due-v">{money(total(i))}</div>
                        <div className={`f2-due-d ${due.tone}`}>{due.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="f2-card">
            <div className="f2-card-h">
              <span className="f2-card-t">Distribuição por status</span>
              <button className="f2-link" onClick={onExport}>Ver relatório <ArrowRight /></button>
            </div>
            {dist.total === 0 ? (
              <p className="f2-empty" style={{ padding: "18px 16px 22px" }}>Sem faturas no período.</p>
            ) : (
              <>
                <div className="f2-dist">
                  <Donut
                    size={116} stroke={18}
                    segments={dist.order.map(({ k, v }) => ({ v, color: D_META[k].color }))}
                    center={String(dist.total)} label="Total"
                  />
                  <div className="f2-dist-legend">
                    {dist.order.map(({ k, v }) => (
                      <div className="f2-dist-row" key={k}>
                        <i style={{ background: D_META[k].color }} />
                        {D_META[k].label}
                        <b>{v} <em>({pct1(dist.total ? (v / dist.total) * 100 : 0)})</em></b>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="f2-note">Dados do período filtrado</p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, delta, spark, color, invert, pp }: {
  label: string; value: string; delta: number; spark: number[];
  color: string; invert?: boolean; pp?: boolean;
}) {
  const positive = invert ? delta <= 0 : delta >= 0;
  const Icon = delta >= 0 ? TrendingUp : TrendingDown;
  return (
    <div className="f2-card f2-kpi">
      <div className="f2-kpi-l">{label} <Info /></div>
      <div className="f2-kpi-b">
        <span className="f2-kpi-v">{value}</span>
        <Spark points={spark} color={positive ? color : "#EF4444"} />
      </div>
      <div className="f2-kpi-d">
        <Icon className={positive ? "up" : "down"} />
        <b className={positive ? "up" : "down"}>
          {delta >= 0 ? "" : "-"}
          {Math.abs(delta).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          {pp ? " p.p." : "%"}
        </b>
        vs. mês anterior
      </div>
    </div>
  );
}
