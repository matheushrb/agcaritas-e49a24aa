import { useMemo, useState } from "react";
import {
  Info, TrendingUp, TrendingDown, Upload, PenLine, Plus, ChevronDown, ChevronRight,
  ChevronLeft, FileText, CalendarClock, AlertTriangle, MoreHorizontal, ArrowUpRight,
  ArrowDownRight, Building2,
} from "lucide-react";
import "@/fin01.css";

/* ================= tipos ================= */
export type F1Charge = {
  id: string;
  description: string | null;
  amount: number | string;
  status: string;
  type?: string | null;
  category?: string | null;
  due_date: string | null;
  paid_at: string | null;
  client_id: string | null;
  project_id: string | null;
};
export type F1Cost = {
  id: string;
  amount: number | string;
  kind: string;
  status: string;
  description: string | null;
  occurred_on: string;
};
export type F1Named = { id: string; name: string };

/* ================= helpers ================= */
const n = (v: number | string | null | undefined) => Number(v ?? 0) || 0;
const money = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const money2 = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct1 = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const dt = (s: string | null) =>
  s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const dtShort = (s: string | null) =>
  s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
const mk = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[Number(m) - 1]}/${y.slice(2)}`;
};
const daysTo = (s: string | null) => {
  if (!s) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(`${s.slice(0, 10)}T12:00:00`); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
};
const dueLabel = (s: string | null) => {
  const d = daysTo(s);
  if (d === null) return { text: "Sem data", tone: "" };
  if (d < 0) return { text: `Vencida há ${Math.abs(d)} dia${Math.abs(d) > 1 ? "s" : ""}`, tone: "danger" };
  if (d === 0) return { text: "Vence hoje", tone: "danger" };
  if (d === 1) return { text: "Vence amanhã", tone: "warn" };
  return { text: `Vence em ${d} dias`, tone: d <= 7 ? "warn" : "" };
};
const isExpense = (c: F1Charge) => (c.type ?? "income") === "expense" || n(c.amount) < 0;

const CAT_COLORS = ["#2F6BEF", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#9AA3B2"];
const KIND_LABEL: Record<string, string> = {
  team: "Equipe", supplier: "Fornecedores", media: "Mídia paga",
  software: "Software", tax: "Impostos", other: "Outros",
};

/* ================= mini charts ================= */
function Spark({ points, color }: { points: number[]; color: string }) {
  const w = 96, h = 34;
  const vals = points.length ? points : [0, 0];
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const d = vals
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i / (vals.length - 1 || 1)) * w},${h - ((v - min) / span) * (h - 6) - 3}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Donut({
  size, stroke, segments, center, label,
}: { size: number; stroke: number; segments: { v: number; color: string }[]; center: string; label: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.v, 0) || 1;
  let acc = 0;
  return (
    <div className="f1-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF1F6" strokeWidth={stroke} />
        {segments.filter(s => s.v > 0).map((s, i) => {
          const len = (s.v / total) * c;
          const el = (
            <circle
              key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${Math.max(len - 2, 0)} ${c}`}
              strokeDashoffset={-acc} strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="f1-donut-c">
        <span className="f1-donut-v">{center}</span>
        <span className="f1-donut-l">{label}</span>
      </div>
    </div>
  );
}

/* ================= componente ================= */
export function Fin01Overview({
  charges, costs, clients, projects, onNewEntry, onNewInvoice, onExport, onOpenInvoices, onOpenEntries,
}: {
  charges: F1Charge[];
  costs: F1Cost[];
  clients: F1Named[];
  projects: F1Named[];
  onNewEntry: () => void;
  onNewInvoice: () => void;
  onExport: () => void;
  onOpenInvoices: () => void;
  onOpenEntries: () => void;
}) {
  const [page, setPage] = useState(0);
  const [range, setRange] = useState<"Mensal" | "Trimestral">("Mensal");
  const clientName = (id: string | null) => clients.find(c => c.id === id)?.name ?? null;
  const projectName = (id: string | null) => projects.find(p => p.id === id)?.name ?? null;

  const live = useMemo(() => charges.filter(c => c.status !== "cancelled" && c.status !== "draft"), [charges]);

  /* ---- meses (12) ---- */
  const months = useMemo(() => {
    const out: string[] = [];
    const d = new Date(); d.setDate(1);
    d.setMonth(d.getMonth() - 11);
    for (let i = 0; i < 12; i++) { out.push(mk(d)); d.setMonth(d.getMonth() + 1); }
    return out;
  }, []);

  const series = useMemo(() => {
    const inc: Record<string, number> = {}, exp: Record<string, number> = {}, got: Record<string, number> = {};
    for (const m of months) { inc[m] = 0; exp[m] = 0; got[m] = 0; }
    for (const c of live) {
      const key = (c.paid_at ?? c.due_date ?? "").slice(0, 7);
      if (!(key in inc)) continue;
      const amt = Math.abs(n(c.amount));
      if (isExpense(c)) exp[key] += amt;
      else {
        inc[key] += amt;
        if (c.status === "paid") got[key] += amt;
      }
    }
    for (const k of costs) {
      const key = (k.occurred_on ?? "").slice(0, 7);
      if (key in exp) exp[key] += Math.abs(n(k.amount));
    }
    return { inc, exp, got };
  }, [live, costs, months]);

  const thisMonth = mk(new Date());
  const prevMonth = useMemo(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return mk(d); }, []);

  const kpis = useMemo(() => {
    const rev = series.inc[thisMonth] ?? 0;
    const revPrev = series.inc[prevMonth] ?? 0;
    const got = series.got[thisMonth] ?? 0;
    const gotPrev = series.got[prevMonth] ?? 0;
    const exp = series.exp[thisMonth] ?? 0;
    const expPrev = series.exp[prevMonth] ?? 0;
    const recv = live.filter(c => !isExpense(c) && c.status !== "paid").reduce((s, c) => s + Math.abs(n(c.amount)), 0);
    const profit = got - exp;
    const profitPrev = gotPrev - expPrev;
    const margin = got > 0 ? (profit / got) * 100 : 0;
    const marginPrev = gotPrev > 0 ? (profitPrev / gotPrev) * 100 : 0;
    const delta = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / Math.abs(b)) * 100);
    return {
      rev, got, recv, exp, profit, margin,
      dRev: delta(rev, revPrev), dGot: delta(got, gotPrev), dExp: delta(exp, expPrev),
      dProfit: delta(profit, profitPrev), dMargin: margin - marginPrev,
      sRev: months.map(m => series.inc[m]), sGot: months.map(m => series.got[m]),
      sExp: months.map(m => series.exp[m]),
      sRecv: months.map(m => series.inc[m] - series.got[m]),
      sProfit: months.map(m => series.got[m] - series.exp[m]),
      sMargin: months.map(m => (series.got[m] > 0 ? ((series.got[m] - series.exp[m]) / series.got[m]) * 100 : 0)),
    };
  }, [series, months, live, thisMonth, prevMonth]);

  /* ---- categorias de despesa ---- */
  const cats = useMemo(() => {
    const map: Record<string, number> = {};
    for (const k of costs) {
      const label = KIND_LABEL[k.kind] ?? "Outros";
      map[label] = (map[label] ?? 0) + Math.abs(n(k.amount));
    }
    for (const c of live.filter(isExpense)) {
      const label = c.category || "Outros";
      map[label] = (map[label] ?? 0) + Math.abs(n(c.amount));
    }
    const rows = Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 6);
    const total = rows.reduce((s, [, v]) => s + v, 0);
    return { rows, total };
  }, [costs, live]);

  /* ---- fluxo de caixa (12 meses) ---- */
  const flow = useMemo(() => {
    const step = range === "Mensal" ? 1 : 3;
    const keys = range === "Mensal" ? months : months.filter((_, i) => i % step === 0);
    const rows = keys.map((k, i) => {
      const group = range === "Mensal" ? [k] : months.slice(i * 3, i * 3 + 3);
      const prev = group.reduce((s, g) => s + (series.inc[g] ?? 0), 0);
      const real = group.reduce((s, g) => s + (series.got[g] ?? 0), 0);
      const out = group.reduce((s, g) => s + (series.exp[g] ?? 0), 0);
      return { key: k, prev, real, net: real - out };
    });
    let acc = 0;
    return rows.map(r => { acc += r.net; return { ...r, acc }; });
  }, [months, series, range]);

  /* ---- projeção 60 dias ---- */
  const projection = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const pts: { day: number; value: number }[] = [];
    let base = 0;
    for (let d = 0; d <= 60; d += 5) {
      let acc = base;
      for (const c of live) {
        const delta = daysTo(c.due_date);
        if (delta === null || delta < 0 || delta > d) continue;
        if (c.status === "paid") continue;
        acc += isExpense(c) ? -Math.abs(n(c.amount)) : Math.abs(n(c.amount));
      }
      pts.push({ day: d, value: acc });
    }
    void base;
    return pts;
  }, [live]);

  /* ---- listas laterais ---- */
  const upcoming = useMemo(
    () => live.filter(c => !isExpense(c) && c.status !== "paid")
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")).slice(0, 4),
    [live],
  );
  const payables = useMemo(
    () => live.filter(c => isExpense(c) && c.status !== "paid")
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")).slice(0, 4),
    [live],
  );
  const alerts = useMemo(() => {
    const soon = live.filter(c => !isExpense(c) && c.status !== "paid" && (daysTo(c.due_date) ?? 99) >= 0 && (daysTo(c.due_date) ?? 99) <= 7);
    const late = live.filter(c => !isExpense(c) && c.status !== "paid" && (daysTo(c.due_date) ?? 0) < 0);
    const out: { tone: "warn" | "info"; title: string; sub: string }[] = [];
    if (soon.length) out.push({
      tone: "warn",
      title: `${soon.length} cobrança${soon.length > 1 ? "s vencem" : " vence"} nos próximos 7 dias`,
      sub: `Total: ${money2(soon.reduce((s, c) => s + Math.abs(n(c.amount)), 0))}`,
    });
    if (late.length) out.push({
      tone: "warn",
      title: `${late.length} cobrança${late.length > 1 ? "s" : ""} em atraso`,
      sub: `Total: ${money2(late.reduce((s, c) => s + Math.abs(n(c.amount)), 0))}`,
    });
    out.push({
      tone: "info",
      title: "Margem prevista do mês",
      sub: `Meta: 30% · Previsto: ${pct1(kpis.margin)}`,
    });
    return out;
  }, [live, kpis.margin]);

  const inad = useMemo(() => {
    let ok = 0, l30 = 0, g30 = 0;
    for (const c of live.filter(c => !isExpense(c) && c.status !== "paid")) {
      const d = daysTo(c.due_date) ?? 0;
      const amt = Math.abs(n(c.amount));
      if (d >= 0) ok += amt; else if (d >= -30) l30 += amt; else g30 += amt;
    }
    const total = ok + l30 + g30;
    return { ok, l30, g30, total, rate: total > 0 ? (ok / total) * 100 : 0 };
  }, [live]);

  /* ---- lançamentos recentes ---- */
  const entries = useMemo(
    () => [...live].sort((a, b) => (b.due_date ?? "").localeCompare(a.due_date ?? "")),
    [live],
  );
  const pageSize = 5;
  const pages = Math.max(1, Math.ceil(entries.length / pageSize));
  const pageRows = entries.slice(page * pageSize, page * pageSize + pageSize);

  const statusPill = (c: F1Charge) => {
    if (c.status === "paid") return { cls: isExpense(c) ? "green" : "green", label: isExpense(c) ? "Pago" : "Recebido" };
    if (c.status === "overdue") return { cls: "red", label: "Vencido" };
    if (c.status === "pending_invoice") return { cls: "blue", label: "A faturar" };
    if (c.status === "pending") return { cls: "amber", label: isExpense(c) ? "Pendente" : "A receber" };
    return { cls: "gray", label: c.status };
  };

  return (
    <div className="fin01">
      {/* ---------- header ---------- */}
      <div className="f1-head">
        <div>
          <h1 className="f1-title">Financeiro</h1>
          <p className="f1-sub">Visão consolidada da saúde financeira da agência.</p>
        </div>
        <div className="f1-actions">
          <button className="f1-btn" onClick={onExport}><Upload /> Exportar</button>
          <button className="f1-btn ghost" onClick={onNewEntry}><PenLine /> Novo lançamento</button>
          <button className="f1-btn primary" onClick={onNewInvoice}><Plus /> Nova fatura</button>
          <button className="f1-btn primary split" onClick={onOpenInvoices} aria-label="Ver faturas"><ChevronDown /></button>
        </div>
      </div>

      {/* ---------- KPIs ---------- */}
      <div className="f1-kpis">
        <Kpi label="Receita do mês" value={money(kpis.rev)} delta={kpis.dRev} spark={kpis.sRev} color="#2F6BEF" />
        <Kpi label="Recebido no mês" value={money(kpis.got)} delta={kpis.dGot} spark={kpis.sGot} color="#10B981" />
        <Kpi label="A receber" value={money(kpis.recv)} delta={-Math.abs(kpis.dRev) * 0} spark={kpis.sRecv} color="#EF4444" invertDelta />
        <Kpi label="Despesas do mês" value={money(kpis.exp)} delta={kpis.dExp} spark={kpis.sExp} color="#2F6BEF" invertDelta />
        <Kpi label="Lucro líquido" value={money(kpis.profit)} delta={kpis.dProfit} spark={kpis.sProfit} color="#10B981" />
        <Kpi label="Margem" value={pct1(kpis.margin)} delta={kpis.dMargin} spark={kpis.sMargin} color="#10B981" pp />
      </div>

      {/* ---------- grid ---------- */}
      <div className="f1-main">
        <div className="f1-left">
          {/* fluxo de caixa + categorias */}
          <div className="f1-row2">
            <section className="f1-card">
              <div className="f1-card-h">
                <span className="f1-card-t">Fluxo de caixa</span>
                <select className="f1-sel" value={range} onChange={e => setRange(e.target.value as "Mensal" | "Trimestral")}>
                  <option>Mensal</option>
                  <option>Trimestral</option>
                </select>
              </div>
              <div className="f1-legend">
                <span className="f1-lg"><i style={{ background: "#C7D8FB" }} />Previsto</span>
                <span className="f1-lg"><i style={{ background: "#2F6BEF" }} />Realizado</span>
                <span className="f1-lg"><i className="line" style={{ background: "#10B981" }} />Saldo acumulado</span>
              </div>
              <div className="f1-chart"><CashFlowChart rows={flow} /></div>
            </section>

            <section className="f1-card">
              <div className="f1-card-h"><span className="f1-card-t">Contas por categoria</span></div>
              {cats.rows.length === 0 ? (
                <p className="f1-empty">Nenhuma despesa registrada no período.</p>
              ) : (
                <div className="f1-donut-wrap">
                  <Donut
                    size={132} stroke={26}
                    segments={cats.rows.map(([, v], i) => ({ v, color: CAT_COLORS[i % CAT_COLORS.length] }))}
                    center={money(cats.total)} label="Total"
                  />
                  <div className="f1-cats">
                    {cats.rows.map(([label, v], i) => (
                      <div className="f1-cat" key={label}>
                        <i style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                        <span>{label}</span>
                        <b>{money(v)} <em>({pct1(cats.total ? (v / cats.total) * 100 : 0)})</em></b>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* receitas x despesas + projeção */}
          <div className="f1-row2b">
            <section className="f1-card">
              <div className="f1-card-h"><span className="f1-card-t">Receitas x despesas</span></div>
              <div className="f1-legend">
                <span className="f1-lg"><i style={{ background: "#2F6BEF" }} />Receitas</span>
                <span className="f1-lg"><i style={{ background: "#EF4444" }} />Despesas</span>
              </div>
              <div className="f1-chart">
                <RevExpChart rows={months.map(m => ({ key: m, inc: series.inc[m], exp: series.exp[m] }))} />
              </div>
            </section>

            <section className="f1-card">
              <div className="f1-card-h"><span className="f1-card-t">Projeção dos próximos 60 dias</span></div>
              <div className="f1-legend">
                <span className="f1-lg"><i className="line" style={{ background: "#10B981" }} />Saldo projetado</span>
                <span className="f1-lg"><i className="line" style={{ background: "#9AA3B2" }} />Saldo mínimo recomendado</span>
              </div>
              <div className="f1-chart"><ProjectionChart points={projection} /></div>
            </section>
          </div>

          {/* lançamentos recentes */}
          <section className="f1-card">
            <div className="f1-card-h">
              <span className="f1-card-t">Lançamentos recentes</span>
              <button className="f1-link" onClick={onOpenEntries}>Ver todos <ChevronRight /></button>
            </div>
            {entries.length === 0 ? (
              <p className="f1-empty">Nenhum lançamento registrado ainda.</p>
            ) : (
              <>
                <table className="f1-table">
                  <thead>
                    <tr>
                      <th>Descrição</th><th>Categoria</th><th>Tipo</th>
                      <th>Vencimento</th><th>Status</th><th className="num">Valor</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map(c => {
                      const exp = isExpense(c);
                      const pill = statusPill(c);
                      return (
                        <tr key={c.id}>
                          <td>
                            <span className="f1-desc">
                              {exp ? <ArrowDownRight style={{ color: "#EF4444" }} /> : <ArrowUpRight style={{ color: "#10B981" }} />}
                              {c.description || projectName(c.project_id) || clientName(c.client_id) || "Lançamento"}
                            </span>
                          </td>
                          <td>{c.category || (exp ? "Despesa" : "Receita")}</td>
                          <td><span className={`f1-pill ${exp ? "red" : "green"}`}>{exp ? "Despesa" : "Receita"}</span></td>
                          <td>{dt(c.due_date)}</td>
                          <td><span className={`f1-pill ${pill.cls}`}>{pill.label}</span></td>
                          <td className="num" style={{ color: exp ? "#DC3545" : undefined }}>
                            {exp ? "-" : ""}{money2(Math.abs(n(c.amount)))}
                          </td>
                          <td style={{ width: 34 }}><button className="f1-dots"><MoreHorizontal size={15} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="f1-foot">
                  <span>
                    Exibindo {page * pageSize + 1}–{Math.min((page + 1) * pageSize, entries.length)} de {entries.length} lançamentos
                  </span>
                  <div className="f1-pg">
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
                    {Array.from({ length: Math.min(pages, 5) }).map((_, i) => (
                      <button key={i} className={i === page ? "on" : ""} onClick={() => setPage(i)}>{i + 1}</button>
                    ))}
                    <button disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

        {/* ---------- coluna direita ---------- */}
        <div className="f1-right">
          <section className="f1-card">
            <div className="f1-card-h">
              <span className="f1-card-t">Próximos recebimentos</span>
              <button className="f1-link" onClick={onOpenInvoices}>Ver todos <ChevronRight /></button>
            </div>
            {upcoming.length === 0 ? <p className="f1-empty">Nada a receber no momento.</p> : (
              <div className="f1-list">
                {upcoming.map(c => (
                  <div className="f1-item" key={c.id}>
                    <span className="f1-ico"><FileText /></span>
                    <div className="f1-item-b">
                      <div className="f1-item-t">{c.description || "Cobrança"}</div>
                      <div className="f1-item-s">{clientName(c.client_id) ?? projectName(c.project_id) ?? "—"}</div>
                    </div>
                    <div className="f1-item-r">
                      <div className="f1-item-v" style={{ color: "#0F9D63" }}>{money(Math.abs(n(c.amount)))}</div>
                      <div className="f1-item-d">{dtShort(c.due_date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="f1-card">
            <div className="f1-card-h">
              <span className="f1-card-t">Contas a pagar</span>
              <button className="f1-link" onClick={onOpenEntries}>Ver todas <ChevronRight /></button>
            </div>
            {payables.length === 0 ? <p className="f1-empty">Nenhuma conta a pagar.</p> : (
              <div className="f1-list">
                {payables.map(c => {
                  const due = dueLabel(c.due_date);
                  return (
                    <div className="f1-item" key={c.id}>
                      <span className="f1-ico" style={{ background: "#F3F5F9", color: "#5C6779" }}><Building2 /></span>
                      <div className="f1-item-b">
                        <div className="f1-item-t">{c.description || "Despesa"}</div>
                        <div className="f1-item-s">{c.category || "Despesas"}</div>
                      </div>
                      <div className="f1-item-r">
                        <div className="f1-item-v" style={{ color: "#DC3545" }}>{money(Math.abs(n(c.amount)))}</div>
                        <div className={`f1-item-d ${due.tone}`}>{due.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="f1-card">
            <div className="f1-card-h">
              <span className="f1-card-t">Alertas financeiros</span>
              <button className="f1-link" onClick={onOpenEntries}>Ver todos <ChevronRight /></button>
            </div>
            <div style={{ paddingBottom: 6 }}>
              {alerts.map((a, i) => (
                <div className="f1-alert" key={i}>
                  {a.tone === "warn"
                    ? <AlertTriangle style={{ color: "#F59E0B" }} />
                    : <Info style={{ color: "#2F6BEF" }} />}
                  <div>
                    <div className="f1-alert-t">{a.title}</div>
                    <div className="f1-alert-s">{a.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="f1-card">
            <div className="f1-card-h"><span className="f1-card-t">Resumo de inadimplência</span></div>
            {inad.total === 0 ? <p className="f1-empty">Sem valores em aberto.</p> : (
              <div className="f1-inad">
                <Donut
                  size={96} stroke={12}
                  segments={[
                    { v: inad.ok, color: "#10B981" },
                    { v: inad.l30, color: "#F59E0B" },
                    { v: inad.g30, color: "#EF4444" },
                  ]}
                  center={pct1(inad.rate)} label="Em dia"
                />
                <div className="f1-inad-legend">
                  <div className="f1-inad-row"><i style={{ background: "#10B981" }} />Em dia<b>{money(inad.ok)} ({pct1(inad.total ? (inad.ok / inad.total) * 100 : 0)})</b></div>
                  <div className="f1-inad-row"><i style={{ background: "#F59E0B" }} />Atrasado até 30 dias<b>{money(inad.l30)} ({pct1(inad.total ? (inad.l30 / inad.total) * 100 : 0)})</b></div>
                  <div className="f1-inad-row"><i style={{ background: "#EF4444" }} />Atrasado +30 dias<b>{money(inad.g30)} ({pct1(inad.total ? (inad.g30 / inad.total) * 100 : 0)})</b></div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/* ================= KPI ================= */
function Kpi({
  label, value, delta, spark, color, invertDelta, pp,
}: {
  label: string; value: string; delta: number; spark: number[];
  color: string; invertDelta?: boolean; pp?: boolean;
}) {
  const positive = invertDelta ? delta <= 0 : delta >= 0;
  const Icon = delta >= 0 ? TrendingUp : TrendingDown;
  const sparkColor = positive ? color : "#EF4444";
  return (
    <div className="f1-card f1-kpi">
      <div className="f1-kpi-l">{label} <Info /></div>
      <div className="f1-kpi-b">
        <span className="f1-kpi-v">{value}</span>
        <Spark points={spark} color={sparkColor} />
      </div>
      <div className="f1-kpi-d">
        <Icon className={positive ? "up" : "down"} />
        <b className={positive ? "up" : "down"}>
          {delta >= 0 ? "" : "-"}{Math.abs(delta).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{pp ? " p.p." : "%"}
        </b>
        vs. mês anterior
      </div>
    </div>
  );
}

/* ================= gráficos ================= */
function CashFlowChart({ rows }: { rows: { key: string; prev: number; real: number; acc: number }[] }) {
  const w = 760, h = 250, padL = 56, padB = 26, padT = 12;
  const maxBar = Math.max(1, ...rows.map(r => Math.max(r.prev, r.real)));
  const accs = rows.map(r => r.acc);
  const maxAcc = Math.max(1, ...accs), minAcc = Math.min(0, ...accs);
  const innerH = h - padB - padT;
  const bw = (w - padL - 8) / (rows.length || 1);
  const yBar = (v: number) => padT + innerH - (v / maxBar) * innerH;
  const yAcc = (v: number) => padT + innerH - ((v - minAcc) / (maxAcc - minAcc || 1)) * innerH;
  const ticks = 5;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Fluxo de caixa">
      {Array.from({ length: ticks }).map((_, i) => {
        const y = padT + (innerH / (ticks - 1)) * i;
        const v = maxBar - (maxBar / (ticks - 1)) * i;
        return (
          <g key={i}>
            <line x1={padL} x2={w - 4} y1={y} y2={y} stroke="#EEF1F6" strokeWidth={1} />
            <text x={padL - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#8C95A5">
              R$ {Math.round(v / 1000)}k
            </text>
          </g>
        );
      })}
      {rows.map((r, i) => {
        const x = padL + i * bw;
        const barW = Math.max(6, bw * 0.26);
        return (
          <g key={r.key}>
            <rect x={x + bw * 0.16} y={yBar(r.prev)} width={barW} height={Math.max(0, padT + innerH - yBar(r.prev))} rx={3} fill="#C7D8FB" />
            <rect x={x + bw * 0.16 + barW + 3} y={yBar(r.real)} width={barW} height={Math.max(0, padT + innerH - yBar(r.real))} rx={3} fill="#2F6BEF" />
            <text x={x + bw / 2} y={h - 8} textAnchor="middle" fontSize={10} fill="#8C95A5">{monthLabel(r.key)}</text>
          </g>
        );
      })}
      <path
        d={rows.map((r, i) => `${i === 0 ? "M" : "L"}${padL + i * bw + bw / 2},${yAcc(r.acc)}`).join(" ")}
        fill="none" stroke="#10B981" strokeWidth={2}
      />
      {rows.map((r, i) => (
        <circle key={r.key} cx={padL + i * bw + bw / 2} cy={yAcc(r.acc)} r={3} fill="#10B981" />
      ))}
    </svg>
  );
}

function RevExpChart({ rows }: { rows: { key: string; inc: number; exp: number }[] }) {
  const w = 520, h = 210, padL = 54, padB = 24, padT = 10;
  const max = Math.max(1, ...rows.map(r => Math.max(r.inc, r.exp)));
  const innerH = h - padB - padT;
  const bw = (w - padL - 6) / (rows.length || 1);
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Receitas x despesas">
      {Array.from({ length: 5 }).map((_, i) => {
        const yy = padT + (innerH / 4) * i;
        const v = max - (max / 4) * i;
        return (
          <g key={i}>
            <line x1={padL} x2={w - 4} y1={yy} y2={yy} stroke="#EEF1F6" />
            <text x={padL - 8} y={yy + 4} textAnchor="end" fontSize={9.5} fill="#8C95A5">R$ {Math.round(v / 1000)}k</text>
          </g>
        );
      })}
      {rows.map((r, i) => {
        const x = padL + i * bw;
        const barW = Math.max(4, bw * 0.28);
        return (
          <g key={r.key}>
            <rect x={x + bw * 0.14} y={y(r.inc)} width={barW} height={Math.max(0, padT + innerH - y(r.inc))} rx={2.5} fill="#2F6BEF" />
            <rect x={x + bw * 0.14 + barW + 2} y={y(r.exp)} width={barW} height={Math.max(0, padT + innerH - y(r.exp))} rx={2.5} fill="#EF4444" />
            <text x={x + bw / 2} y={h - 7} textAnchor="middle" fontSize={9} fill="#8C95A5">{monthLabel(r.key)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function ProjectionChart({ points }: { points: { day: number; value: number }[] }) {
  const w = 520, h = 210, padL = 58, padB = 24, padT = 10;
  const vals = points.map(p => p.value);
  const max = Math.max(1, ...vals), min = Math.min(0, ...vals);
  const innerH = h - padB - padT;
  const x = (d: number) => padL + (d / 60) * (w - padL - 12);
  const y = (v: number) => padT + innerH - ((v - min) / (max - min || 1)) * innerH;
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day)},${y(p.value)}`).join(" ");
  const area = `${line} L${x(60)},${padT + innerH} L${padL},${padT + innerH} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Projeção 60 dias">
      {Array.from({ length: 5 }).map((_, i) => {
        const yy = padT + (innerH / 4) * i;
        const v = max - ((max - min) / 4) * i;
        return (
          <g key={i}>
            <line x1={padL} x2={w - 6} y1={yy} y2={yy} stroke="#EEF1F6" />
            <text x={padL - 8} y={yy + 4} textAnchor="end" fontSize={9.5} fill="#8C95A5">R$ {Math.round(v / 1000)}k</text>
          </g>
        );
      })}
      {[0, 7, 14, 21, 30, 45, 60].map(d => (
        <g key={d}>
          <line x1={x(d)} x2={x(d)} y1={padT} y2={padT + innerH} stroke="#EEF1F6" strokeDasharray="3 3" />
          <text x={x(d)} y={h - 7} textAnchor="middle" fontSize={9} fill="#8C95A5">{d === 0 ? "Hoje" : `${d} dias`}</text>
        </g>
      ))}
      <path d={area} fill="#10B98118" />
      <path d={line} fill="none" stroke="#10B981" strokeWidth={2} />
      <line x1={padL} x2={w - 6} y1={y(min + (max - min) * 0.15)} y2={y(min + (max - min) * 0.15)} stroke="#9AA3B2" strokeDasharray="5 4" />
    </svg>
  );
}
