import { useMemo, useState } from "react";
import {
  TrendingUp, FileText, Wallet, Clock, Receipt, Percent, PieChart as PieIcon,
  MoreHorizontal, ChevronRight, ChevronLeft, AlertTriangle, Info, Users, Truck,
  Megaphone, CircleDollarSign,
} from "lucide-react";
import "@/prj04.css";

export type P4Charge = {
  id: string;
  description: string | null;
  amount: number | string;
  status: string;
  due_date: string | null;
};
export type P4Cost = {
  id: string;
  amount: number | string;
  status: string;
  kind: string;
  description: string | null;
  occurred_on: string;
};
export type P4Task = {
  id?: string;
  title?: string | null;
  status?: string | null;
  billed?: boolean | null;
  billing_enabled?: boolean | null;
  billing_value?: number | string | null;
  broadcast_kind?: string | null;
  aired_dates?: string[] | null;
  deliverables?: { billing_enabled?: boolean | null; billing_value?: number | string | null }[] | null;
};

const money = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const money2 = (n: number) =>
  `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const dt = (s: string | null) =>
  s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const monthKey = (s: string) => s.slice(0, 7);

const KIND_META: Record<string, { label: string; color: string; icon: typeof Users }> = {
  team: { label: "Equipe", color: "#2F6BEF", icon: Users },
  supplier: { label: "Fornecedores", color: "#10B981", icon: Truck },
  media: { label: "Mídia e mídia paga", color: "#F59E0B", icon: Megaphone },
  other: { label: "Outros", color: "#8B5CF6", icon: CircleDollarSign },
};
const kindMeta = (k: string) => KIND_META[k] ?? { label: k || "Outros", color: "#8B5CF6", icon: CircleDollarSign };

function Donut({ size, stroke, segments }: { size: number; stroke: number; segments: { v: number; color: string }[] }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.v, 0) || 1;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF1F6" strokeWidth={stroke} />
      {segments.filter(s => s.v > 0).map((s, i) => {
        const len = (s.v / total) * c;
        const el = (
          <circle
            key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={s.color} strokeWidth={stroke} strokeLinecap="butt"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-acc}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        acc += len;
        return el;
      })}
    </svg>
  );
}

function CashFlowChart({ data }: { data: { label: string; prev: number; real: number }[] }) {
  const W = 660, H = 190, PL = 38, PR = 10, PT = 16, PB = 26;
  const max = Math.max(1, ...data.map(d => Math.max(d.prev, d.real)));
  const nice = Math.ceil(max / 20000) * 20000 || 20000;
  const iw = W - PL - PR, ih = H - PT - PB;
  const step = data.length ? iw / data.length : iw;
  const bw = Math.min(16, step / 3);
  const y = (v: number) => PT + ih - (v / nice) * ih;
  let run = 0;
  const cum = data.map(d => { run += d.real; return run; });
  const cumMax = Math.max(1, ...cum);
  const cy = (v: number) => PT + ih - (v / cumMax) * ih;
  const pts = data.map((_, i) => `${PL + step * i + step / 2},${cy(cum[i])}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => nice * f);
  const kfmt = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR} y1={y(t)} y2={y(t)} stroke="#EEF1F6" strokeWidth="1" />
          <text x={PL - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#8A93A3">{kfmt(t)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const x0 = PL + step * i + step / 2;
        return (
          <g key={d.label}>
            <rect x={x0 - bw - 2} y={y(d.prev)} width={bw} height={Math.max(0, PT + ih - y(d.prev))} rx="3" fill="#D8DEE8" />
            <rect x={x0 + 2} y={y(d.real)} width={bw} height={Math.max(0, PT + ih - y(d.real))} rx="3" fill="#2F6BEF" />
            <text x={x0} y={H - 8} textAnchor="middle" fontSize="10" fill="#8A93A3">{d.label}</text>
          </g>
        );
      })}
      {data.length > 1 && <polyline points={pts} fill="none" stroke="#10B981" strokeWidth="2" />}
      {data.map((_, i) => (
        <circle key={i} cx={PL + step * i + step / 2} cy={cy(cum[i])} r="3" fill="#10B981" />
      ))}
    </svg>
  );
}

export function Prj04Finance({
  charges,
  tasks,
  costs,
}: {
  charges: P4Charge[];
  tasks: P4Task[];
  costs: P4Cost[];
}) {
  const [page, setPage] = useState(1);
  const perPage = 6;

  const k = useMemo(() => {
    const invoiced = charges.reduce((s, c) => s + Number(c.amount ?? 0), 0);
    const received = charges.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount ?? 0), 0);
    const toReceive = Math.max(0, invoiced - received);
    const projected = tasks.reduce((sum, t) => {
      const base = t.billing_enabled && t.billing_value != null ? Number(t.billing_value) : 0;
      const mult = t.broadcast_kind && (t.aired_dates?.length ?? 0) > 0 ? (t.aired_dates as string[]).length : 1;
      const deliv = (t.deliverables ?? [])
        .filter(d => d.billing_enabled && d.billing_value != null)
        .reduce((s, d) => s + Number(d.billing_value ?? 0), 0);
      return sum + base * mult + deliv;
    }, 0);
    const revenue = Math.max(projected, invoiced);
    const costsTotal = costs.reduce((s, c) => s + Number(c.amount ?? 0), 0);
    const profit = revenue - costsTotal;
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { invoiced, received, toReceive, revenue, costsTotal, profit, marginPct };
  }, [charges, tasks, costs]);

  const receivedPct = k.revenue > 0 ? (k.received / k.revenue) * 100 : 0;

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    costs.forEach(c => map.set(c.kind, (map.get(c.kind) ?? 0) + Number(c.amount ?? 0)));
    return [...map.entries()]
      .map(([kind, v]) => ({ kind, v, ...kindMeta(kind) }))
      .sort((a, b) => b.v - a.v);
  }, [costs]);

  const flow = useMemo(() => {
    const map = new Map<string, { prev: number; real: number }>();
    const touch = (key: string) => {
      if (!map.has(key)) map.set(key, { prev: 0, real: 0 });
      return map.get(key)!;
    };
    charges.forEach(c => {
      const key = monthKey(c.due_date ?? new Date().toISOString());
      const row = touch(key);
      row.prev += Number(c.amount ?? 0);
      if (c.status === "paid") row.real += Number(c.amount ?? 0);
    });
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([key, v]) => {
        const d = new Date(`${key}-01T12:00:00`);
        const label = `${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}/${String(d.getFullYear()).slice(2)}`;
        return { label: label.charAt(0).toUpperCase() + label.slice(1), ...v };
      });
  }, [charges]);

  const entries = useMemo(() => {
    const rev = charges.map(c => ({
      id: `c-${c.id}`,
      desc: c.description ?? "Cobrança",
      category: "Receita",
      type: "rev" as const,
      date: c.due_date,
      status: c.status === "paid" ? "Recebido" : c.status === "overdue" ? "Atrasado" : "Pendente",
      statusCls: c.status === "paid" ? "ok" : c.status === "overdue" ? "exp" : "pend",
      amount: Number(c.amount ?? 0),
      color: "#10B981",
      bg: "#E8F7F0",
      Icon: FileText,
    }));
    const exp = costs.map(c => {
      const m = kindMeta(c.kind);
      return {
        id: `k-${c.id}`,
        desc: c.description ?? m.label,
        category: m.label,
        type: "exp" as const,
        date: c.occurred_on,
        status: c.status === "paid" ? "Pago" : "Pendente",
        statusCls: c.status === "paid" ? "pay" : "pend",
        amount: Number(c.amount ?? 0),
        color: m.color,
        bg: "#F1F3F8",
        Icon: m.icon,
      };
    });
    return [...rev, ...exp].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  }, [charges, costs]);

  const totalPages = Math.max(1, Math.ceil(entries.length / perPage));
  const cur = Math.min(page, totalPages);
  const slice = entries.slice((cur - 1) * perPage, cur * perPage);

  const upcoming = useMemo(
    () =>
      charges
        .filter(c => c.status !== "paid" && c.due_date)
        .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
        .slice(0, 3),
    [charges],
  );

  const today = new Date();
  const in7 = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const dueSoon = charges.filter(c => c.status !== "paid" && c.due_date && c.due_date <= in7);
  const dueSoonTotal = dueSoon.reduce((s, c) => s + Number(c.amount ?? 0), 0);

  const KPIS = [
    { label: "Receita prevista", value: money(k.revenue), sub: "100% do orçamento", color: "#2F6BEF", bg: "#EEF3FE", Icon: TrendingUp },
    { label: "Faturado", value: money(k.invoiced), sub: k.revenue > 0 ? `${Math.round((k.invoiced / k.revenue) * 100)}% da receita prevista` : "—", color: "#2F6BEF", bg: "#EEF3FE", Icon: FileText },
    { label: "Recebido", value: money(k.received), sub: k.revenue > 0 ? `${pct(receivedPct)} da receita prevista` : "—", color: "#10B981", bg: "#E8F7F0", Icon: Wallet, tone: "green" },
    { label: "A receber", value: money(k.toReceive), sub: k.revenue > 0 ? `${pct((k.toReceive / k.revenue) * 100)} da receita prevista` : "—", color: "#F59E0B", bg: "#FEF3E2", Icon: Clock },
    { label: "Custos totais", value: money(k.costsTotal), sub: k.revenue > 0 ? `${pct((k.costsTotal / k.revenue) * 100)} da receita prevista` : "—", color: "#EF4444", bg: "#FDECEC", Icon: Receipt },
    { label: "Lucro", value: money(k.profit), sub: `${pct(k.marginPct)} da receita prevista`, color: "#10B981", bg: "#E8F7F0", Icon: TrendingUp, tone: "green" },
    { label: "Margem", value: pct(k.marginPct), sub: "sobre receita prevista", color: "#10B981", bg: "#E8F7F0", Icon: Percent, tone: "green" },
  ];

  return (
    <div className="prj04">
      {/* 01 — faixa de indicadores */}
      <div className="p4-kpis">
        {KPIS.map(kpi => (
          <div className="p4-kpi" key={kpi.label}>
            <div className="p4-kpi-h">
              <span className="p4-ico" style={{ background: kpi.bg, color: kpi.color }}><kpi.Icon /></span>
              <span className="p4-kpi-l">{kpi.label}</span>
            </div>
            <div className="p4-kpi-v" style={kpi.tone === "green" ? { color: "#10B981" } : undefined}>{kpi.value}</div>
            <div className="p4-kpi-s">{kpi.sub}</div>
          </div>
        ))}
        <div className="p4-kpi gauge">
          <span className="p4-kpi-l">% recebido</span>
          <div className="p4-donut-c" style={{ width: 62, height: 62 }}>
            <Donut size={62} stroke={7} segments={[{ v: receivedPct, color: "#10B981" }, { v: Math.max(0, 100 - receivedPct), color: "#EEF1F6" }]} />
            <div className="in"><b style={{ fontSize: 12 }}>{pct(receivedPct)}</b></div>
          </div>
        </div>
      </div>

      <div className="p4-body">
        <div className="p4-main">
          <div className="p4-row2">
            {/* 02 — fluxo de caixa */}
            <div className="p4-card">
              <div className="p4-card-h">
                <span className="p4-card-t">Fluxo de caixa previsto x realizado (R$)</span>
              </div>
              <div className="p4-legend">
                <span className="p4-lg"><i style={{ background: "#D8DEE8" }} />Previsto</span>
                <span className="p4-lg"><i style={{ background: "#2F6BEF" }} />Realizado</span>
                <span className="p4-lg"><i className="line" style={{ background: "#10B981" }} />Acumulado realizado</span>
              </div>
              <div className="p4-chart">
                {flow.length === 0 ? (
                  <div className="p4-empty">Sem lançamentos para montar o fluxo de caixa.</div>
                ) : (
                  <CashFlowChart data={flow} />
                )}
              </div>
            </div>

            {/* 03 — custos por categoria */}
            <div className="p4-card">
              <div className="p4-card-h"><span className="p4-card-t">Custos por categoria</span></div>
              {byCategory.length === 0 ? (
                <div className="p4-empty">Nenhum custo registrado neste projeto.</div>
              ) : (
                <div className="p4-donut-wrap">
                  <div className="p4-donut-c" style={{ width: 148, height: 148 }}>
                    <Donut size={148} stroke={26} segments={byCategory.map(c => ({ v: c.v, color: c.color }))} />
                    <div className="in"><b>{money(k.costsTotal)}</b><span>Total</span></div>
                  </div>
                  <div className="p4-cats">
                    {byCategory.map(c => (
                      <div className="p4-cat" key={c.kind}>
                        <i style={{ background: c.color }} />
                        <span className="n">{c.label}</span>
                        <span className="v">
                          {money(c.v)} ({k.costsTotal > 0 ? pct((c.v / k.costsTotal) * 100) : "0%"})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 04 — lançamentos financeiros */}
          <div className="p4-card">
            <div className="p4-card-h"><span className="p4-card-t">Lançamentos financeiros</span></div>
            <table>
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th className="num">Valor (R$)</th>
                  <th className="num">Ações</th>
                </tr>
              </thead>
              <tbody>
                {slice.length === 0 && (
                  <tr><td colSpan={7}><div className="p4-empty">Nenhum lançamento vinculado a este projeto.</div></td></tr>
                )}
                {slice.map(e => (
                  <tr key={e.id}>
                    <td>
                      <div className="p4-desc">
                        <span className="ic" style={{ background: e.bg, color: e.color }}><e.Icon /></span>
                        <span>{e.desc}</span>
                      </div>
                    </td>
                    <td style={{ color: "#5B6779" }}>{e.category}</td>
                    <td><span className={`p4-tag ${e.type === "rev" ? "rev" : "exp"}`}>{e.type === "rev" ? "Receita" : "Despesa"}</span></td>
                    <td style={{ color: "#5B6779" }}>{dt(e.date)}</td>
                    <td><span className={`p4-tag ${e.statusCls}`}>{e.status}</span></td>
                    <td className="num" style={{ fontWeight: 600 }}>{money2(e.amount)}</td>
                    <td className="num"><button type="button" className="p4-dots"><MoreHorizontal /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p4-foot">
              <span>
                Exibindo {entries.length === 0 ? 0 : (cur - 1) * perPage + 1}–{Math.min(cur * perPage, entries.length)} de {entries.length} lançamentos
              </span>
              <div className="p4-pag">
                <button className="p4-pg" disabled={cur === 1} onClick={() => setPage(cur - 1)}><ChevronLeft /></button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map(p => (
                  <button key={p} className={`p4-pg${p === cur ? " on" : ""}`} onClick={() => setPage(p)}>{p}</button>
                ))}
                <button className="p4-pg" disabled={cur === totalPages} onClick={() => setPage(cur + 1)}><ChevronRight /></button>
              </div>
            </div>
          </div>
        </div>

        {/* coluna lateral */}
        <div className="p4-side">
          <div className="p4-card">
            <div className="p4-card-h"><span className="p4-card-t">Próximos faturamentos</span></div>
            {upcoming.length === 0 ? (
              <div className="p4-empty">Nenhuma cobrança em aberto.</div>
            ) : (
              upcoming.map(c => (
                <div className="p4-item" key={c.id}>
                  <span className="ic"><FileText /></span>
                  <span className="tx">
                    <b>{c.description ?? "Cobrança"}</b>
                    <span>{c.status === "overdue" ? "Em atraso" : "Aguardando pagamento"}</span>
                  </span>
                  <span className="rt">
                    <b>{money2(Number(c.amount ?? 0))}</b>
                    <span>{dt(c.due_date)}</span>
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="p4-card">
            <div className="p4-card-h"><span className="p4-card-t">Alertas financeiros</span></div>
            {dueSoon.length === 0 && k.marginPct >= 25 && (
              <div className="p4-empty">Nenhum alerta no momento.</div>
            )}
            {dueSoon.length > 0 && (
              <div className="p4-alert warn">
                <span className="ic"><AlertTriangle /></span>
                <span className="tx">
                  <b>{dueSoon.length} fatura{dueSoon.length > 1 ? "s vencem" : " vence"} nos próximos 7 dias</b>
                  <span>Total: {money2(dueSoonTotal)}</span>
                </span>
                <ChevronRight className="go" width={16} height={16} />
              </div>
            )}
            {k.marginPct < 25 && (
              <div className="p4-alert info">
                <span className="ic"><Info /></span>
                <span className="tx">
                  <b>Margem prevista abaixo da meta</b>
                  <span>Meta: 25% · Previsto: {pct(k.marginPct)}</span>
                </span>
                <ChevronRight className="go" width={16} height={16} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
