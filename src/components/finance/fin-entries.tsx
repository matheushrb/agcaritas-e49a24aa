import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FinanceEntryWindow, type FinanceEntry } from "@/components/finance-entry-window";
import { Plus, Search, ArrowDownCircle, ArrowUpCircle, Pencil } from "lucide-react";
import "@/fin01.css";

type Row = FinanceEntry & { created_at?: string };
type Named = { id: string; name: string };

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "—");

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "amber" },
  pending_invoice: { label: "A faturar", cls: "blue" },
  paid: { label: "Pago", cls: "green" },
  overdue: { label: "Atrasado", cls: "red" },
  cancelled: { label: "Cancelado", cls: "gray" },
  draft: { label: "Rascunho", cls: "gray" },
};

export function EntriesPanel({
  clients, projects, teamMembers,
}: {
  clients: Named[];
  projects: Named[];
  teamMembers: { id: string; name: string; payment_day: number | null }[];
}) {
  const [q, setQ] = useState("");
  const [nature, setNature] = useState<"all" | "revenue" | "expense">("all");
  const [status, setStatus] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [defaultNature, setDefaultNature] = useState<"revenue" | "expense">("revenue");

  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: ["finance-entries-all"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("charges")
        .select("id,description,amount,status,due_date,paid_at,payment_method,client_id,project_id,nature,category,competence_month,task_ids,created_at")
        .order("due_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(r => {
      const isExpense = (r.nature ?? "revenue") === "expense";
      if (nature === "revenue" && isExpense) return false;
      if (nature === "expense" && !isExpense) return false;
      if (status !== "all" && r.status !== status) return false;
      if (!term) return true;
      const client = clients.find(c => c.id === r.client_id)?.name ?? "";
      const project = projects.find(p => p.id === r.project_id)?.name ?? "";
      return `${r.description ?? ""} ${client} ${project} ${r.category ?? ""}`.toLowerCase().includes(term);
    });
  }, [rows, q, nature, status, clients, projects]);

  const totals = useMemo(() => {
    let rev = 0, exp = 0;
    filtered.forEach(r => {
      const v = Math.abs(Number(r.amount ?? 0));
      if ((r.nature ?? "revenue") === "expense") exp += v; else rev += v;
    });
    return { rev, exp, net: rev - exp };
  }, [filtered]);

  const newEntry = (n: "revenue" | "expense") => {
    setEditing(null);
    setDefaultNature(n);
    setOpen(true);
  };

  return (
    <div className="fin01">
      <div className="f1-head">
        <div>
          <h1 className="f1-title">Lançamentos</h1>
          <p className="f1-sub">Todas as receitas e despesas registradas.</p>
        </div>
        <div className="f1-actions">
          <button className="f1-btn ghost" onClick={() => newEntry("expense")}><ArrowUpCircle /> Nova despesa</button>
          <button className="f1-btn primary" onClick={() => newEntry("revenue")}><Plus /> Nova receita</button>
        </div>
      </div>

      <div className="f1-kpis" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        <section className="f1-card f1-kpi">
          <div className="f1-kpi-l">Receitas filtradas</div>
          <div className="f1-kpi-b"><span className="f1-kpi-v">{money(totals.rev)}</span></div>
        </section>
        <section className="f1-card f1-kpi">
          <div className="f1-kpi-l">Despesas filtradas</div>
          <div className="f1-kpi-b"><span className="f1-kpi-v">{money(totals.exp)}</span></div>
        </section>
        <section className="f1-card f1-kpi">
          <div className="f1-kpi-l">Resultado</div>
          <div className="f1-kpi-b"><span className="f1-kpi-v">{money(totals.net)}</span></div>
        </section>
      </div>

      <section className="f1-card">
        <div className="f1-card-h" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="f1-card-t">{filtered.length} lançamento(s)</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: "auto", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <Search style={{ width: 14, height: 14, position: "absolute", left: 9, top: 9, opacity: 0.5 }} />
              <input
                className="f1-sel"
                style={{ paddingLeft: 28, width: 220 }}
                placeholder="Buscar lançamento..."
                value={q}
                onChange={e => setQ(e.target.value)}
              />
            </div>
            <select className="f1-sel" value={nature} onChange={e => setNature(e.target.value as typeof nature)}>
              <option value="all">Todas as naturezas</option>
              <option value="revenue">Receitas</option>
              <option value="expense">Despesas</option>
            </select>
            <select className="f1-sel" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="all">Todos os status</option>
              {Object.entries(STATUS_LABEL).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="f1-table">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Cliente</th>
                <th>Projeto</th>
                <th>Categoria</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th className="num">Valor</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8}>Carregando...</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8}>Nenhum lançamento encontrado.</td></tr>
              )}
              {filtered.map(r => {
                const isExpense = (r.nature ?? "revenue") === "expense";
                const meta = STATUS_LABEL[r.status] ?? { label: r.status, cls: "gray" };
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="f1-desc">
                        {isExpense ? <ArrowUpCircle style={{ color: "var(--f1-red)" }} /> : <ArrowDownCircle style={{ color: "var(--f1-green)" }} />}
                        <span>{r.description || "Sem descrição"}</span>
                      </div>
                    </td>
                    <td>{clients.find(c => c.id === r.client_id)?.name ?? "—"}</td>
                    <td>{projects.find(p => p.id === r.project_id)?.name ?? "—"}</td>
                    <td>{r.category || "—"}</td>
                    <td>{fmtDate(r.due_date)}</td>
                    <td><span className={`f1-pill ${meta.cls}`}>{meta.label}</span></td>
                    <td className="num" style={{ color: isExpense ? "var(--f1-red)" : undefined }}>
                      {isExpense ? "- " : ""}{money(Math.abs(Number(r.amount ?? 0)))}
                    </td>
                    <td>
                      <button
                        className="f1-dots"
                        aria-label="Editar lançamento"
                        onClick={() => { setEditing(r); setOpen(true); }}
                      >
                        <Pencil style={{ width: 15, height: 15 }} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <FinanceEntryWindow
        open={open}
        onOpenChange={setOpen}
        entry={editing}
        clients={clients}
        projects={projects}
        teamMembers={teamMembers}
        defaultNature={defaultNature}
      />
    </div>
  );
}
