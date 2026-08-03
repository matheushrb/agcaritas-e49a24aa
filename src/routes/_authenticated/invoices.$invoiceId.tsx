import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Share2, Send, PenLine, Wallet, Check, Calendar, CreditCard, FileText,
  ArrowRight, Mail, Phone, Copy, Receipt, XCircle, ArrowLeft, Plus, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import "@/fin03.css";


export const Route = createFileRoute("/_authenticated/invoices/$invoiceId")({
  component: InvoiceDetailPage,
});

type Inv = {
  id: string; number: string | null; client_id: string | null; project_id: string | null;
  status: string; issue_date: string | null; due_date: string | null; paid_at: string | null;
  total: number | string | null; amount: number | string | null; discount: number | string | null;
  notes: string | null; payment_method: string | null; payment_terms: string | null;
  payment_link: string | null; created_at: string | null;
};
type Item = {
  id: string; description: string; amount: number | string | null; due_date: string | null;
  deliverable_id: string | null; task_id: string | null;
};

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: unknown) => Number(v ?? 0) || 0;
const fmtDate = (d?: string | null) =>
  d ? new Date(d.length > 10 ? d : d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const daysDiff = (d?: string | null) => {
  if (!d) return null;
  const t = new Date(d + "T00:00:00").getTime();
  return Math.round((t - new Date(new Date().toDateString()).getTime()) / 86400000);
};

const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Rascunho", tone: "gray" },
  issued: { label: "A receber", tone: "green" },
  pending: { label: "A receber", tone: "green" },
  paid: { label: "Paga", tone: "blue" },
  overdue: { label: "Vencida", tone: "red" },
  canceled: { label: "Cancelada", tone: "red" },
};

function Donut({ pct, label, color }: { pct: number; label: string; color: string }) {
  const r = 46, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" style={{ width: 150, height: 150 }}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="#EDF1F7" strokeWidth="13" />
      <circle
        cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="13" strokeLinecap="round"
        strokeDasharray={`${(c * Math.min(pct, 100)) / 100} ${c}`} transform="rotate(-90 60 60)"
      />
      <text x="60" y="57" textAnchor="middle" fontSize="17" fontWeight="700" fill="currentColor">{Math.round(pct)}%</text>
      <text x="60" y="74" textAnchor="middle" fontSize="9.5" fill="#6B7A90">{label}</text>
    </svg>
  );
}

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [form, setForm] = useState({
    client_id: "", project_id: "", issue_date: "", due_date: "",
    payment_method: "", payment_terms: "", payment_link: "", discount: "0", notes: "",
  });
  const [drafts, setDrafts] = useState<{ id?: string; description: string; amount: string; due_date: string }[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [pay, setPay] = useState({ date: new Date().toISOString().slice(0, 10), method: "", amount: "" });


  const { data: invoice } = useQuery<Inv | null>({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices")
        .select("id,number,client_id,project_id,status,issue_date,due_date,paid_at,total,amount,discount,notes,payment_method,payment_terms,payment_link,created_at")
        .eq("id", invoiceId).maybeSingle();
      if (error) throw error;
      return (data ?? null) as Inv | null;
    },
  });

  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["invoice-charges", invoiceId],
    queryFn: async () => {
      const { data } = await supabase.from("charges")
        .select("id,description,amount,due_date,deliverable_id,task_id")
        .eq("invoice_id", invoiceId);
      return (data ?? []) as unknown as Item[];
    },
  });

  const { data: client } = useQuery({
    queryKey: ["invoice-client", invoice?.client_id],
    enabled: !!invoice?.client_id,
    queryFn: async () => {
      const { data } = await supabase.from("clients")
        .select("id,name,company,trade_name,legal_name,tax_id,state_registration,email,phone,contact_name,contact_role,contact_email,contact_phone,billing_email,address_street,address_number,address_complement,address_neighborhood,address_city,address_state,address_zip")
        .eq("id", invoice!.client_id!).maybeSingle();
      return data as Record<string, string | null> | null;
    },
  });

  const { data: organization = null } = useQuery({
    queryKey: ["organization-invoice"],
    queryFn: async () => {
      const { data: p } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!p?.organization_id) return null;
      const { data } = await supabase.from("organizations")
        .select("id,name,legal_name,tax_id,email,phone,address,website,bank_info")
        .eq("id", p.organization_id).maybeSingle();
      return (data ?? null) as Record<string, string | null> | null;
    },
  });

  const { data: project } = useQuery({
    queryKey: ["invoice-project", invoice?.project_id],
    enabled: !!invoice?.project_id,
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id,name").eq("id", invoice!.project_id!).maybeSingle();
      return data;
    },
  });

  const { data: allClients = [] } = useQuery({
    queryKey: ["clients-min"],
    enabled: editOpen,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: allProjects = [] } = useQuery({
    queryKey: ["projects-min"],
    enabled: editOpen,
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id,name,client_id").order("name");
      return (data ?? []) as { id: string; name: string; client_id: string | null }[];
    },
  });



  async function openPDF() {
    if (!invoice) return;
    try {
      const { generateInvoicePDF, DEFAULT_PAYMENT_TERMS } = await import("@/lib/pdf/invoice-pdf");
      const c = client;
      const addr = c ? [
        [c.address_street, c.address_number].filter(Boolean).join(", "),
        [c.address_complement, c.address_neighborhood].filter(Boolean).join(" · "),
        [[c.address_city, c.address_state].filter(Boolean).join("/"), c.address_zip ? `CEP ${c.address_zip}` : null].filter(Boolean).join(" · "),
      ].filter(Boolean).join("\n") || null : null;
      const doc = await generateInvoicePDF({
        number: invoice.number ?? "RASCUNHO",
        issue_date: invoice.issue_date || invoice.created_at || new Date().toISOString().slice(0, 10),
        due_date: invoice.due_date,
        client: c ? {
          name: c.name ?? "—", company: c.trade_name || c.company || null, legal_name: c.legal_name || null,
          document: c.tax_id || null, state_registration: c.state_registration || null,
          email: c.billing_email || c.email || null, phone: c.phone || null, address: addr,
          contact_name: c.contact_name || null, contact_role: c.contact_role || null,
        } : { name: "—" },
        agency: organization ? {
          name: organization.name ?? null, legal_name: organization.legal_name ?? null,
          document: organization.tax_id ?? null, email: organization.email ?? null,
          phone: organization.phone ?? null, address: organization.address ?? null,
          website: organization.website ?? null, bank_info: organization.bank_info ?? null,
        } : undefined,
        lines: items.map(it => ({
          key: it.id, title: it.description, amount: num(it.amount),
          reference_date: it.due_date, reference_label: "Referência",
        })),
        discount: num(invoice.discount) || undefined,
        notes: invoice.notes || undefined,
        payment_terms: invoice.payment_terms || DEFAULT_PAYMENT_TERMS,
        payment_link: invoice.payment_link || undefined,
        is_preview: invoice.status === "draft",
      });
      const url = doc.output("bloburl") as unknown as string;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }


  useEffect(() => { if (invoice) setNotes(invoice.notes ?? ""); }, [invoice]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    qc.invalidateQueries({ queryKey: ["invoice-charges", invoiceId] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["charges"] });
  };

  const registerPayment = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const { error } = await supabase.from("invoices").update({ status: "paid", paid_at: now }).eq("id", invoiceId);
      if (error) throw error;
      await supabase.from("charges").update({ status: "paid", paid_at: now }).eq("invoice_id", invoiceId);
    },
    onSuccess: () => { invalidate(); toast.success("Pagamento registrado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendInvoice = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("invoices").update({ status: "issued" }).eq("id", invoiceId);
      if (error) throw error;
      await supabase.from("charges").update({ status: "pending" }).eq("invoice_id", invoiceId);
    },
    onSuccess: () => { invalidate(); toast.success("Cobrança enviada ao cliente"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelInvoice = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("invoices").update({ status: "canceled" }).eq("id", invoiceId);
      if (error) throw error;
      await supabase.from("charges").update({ status: "pending_invoice", invoice_id: null }).eq("invoice_id", invoiceId);
    },
    onSuccess: () => { invalidate(); toast.success("Fatura cancelada — itens devolvidos"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNotes = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("invoices").update({ notes: notes || null }).eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); setEditingNotes(false); toast.success("Observações salvas"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    const subtotal = items.reduce((a, i) => a + num(i.amount), 0);
    const discount = num(invoice?.discount);
    const total = num(invoice?.total) || num(invoice?.amount) || subtotal - discount;
    const received = invoice?.status === "paid" ? total : 0;
    return { subtotal, discount, total, received, open: total - received };
  }, [items, invoice]);

  if (!invoice) {
    return <div className="fin03"><div className="f3-empty">Carregando fatura…</div></div>;
  }

  const dd = daysDiff(invoice.due_date);
  const isOverdue = invoice.status !== "paid" && invoice.status !== "canceled" && dd !== null && dd < 0;
  const meta = STATUS[isOverdue ? "overdue" : invoice.status] ?? STATUS.draft;
  const paidPct = totals.total > 0 ? (totals.received / totals.total) * 100 : 0;

  const steps = [
    { name: "Fatura criada", at: invoice.created_at, done: true },
    { name: "Enviada ao cliente", at: invoice.issue_date, done: invoice.status !== "draft" },
    { name: invoice.status === "paid" ? "Pagamento em conta" : "A receber", at: invoice.due_date, done: invoice.status === "paid", current: invoice.status !== "draft" && invoice.status !== "paid" },
    { name: "Pagamento recebido", at: invoice.paid_at, done: invoice.status === "paid", current: false },
    { name: "Fatura concluída", at: invoice.paid_at, done: invoice.status === "paid", current: false },
  ];

  const contactName = client?.contact_name || client?.name || "—";
  const initials = contactName.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase();

  return (
    <div className="fin03">
      <div className="f3-crumbs">
        <Link to="/finance">Financeiro</Link><span className="sep">/</span>
        <Link to="/invoices">Faturas</Link><span className="sep">/</span>
        <span>Fatura {invoice.number ? `#${invoice.number}` : "(rascunho)"}</span>
      </div>

      <div className="f3-head">
        <div>
          <div className="f3-title">
            <button className="f3-btn" onClick={() => navigate({ to: "/invoices" })} style={{ height: 34, padding: "0 10px" }}>
              <ArrowLeft size={15} /> Voltar
            </button>
            <h1>Fatura {invoice.number ? `#${invoice.number}` : "— rascunho"}</h1>
            <span className={`f3-pill ${meta.tone}`}>{meta.label}</span>
          </div>
          <div className="f3-sub">
            Cobrança referente {project ? `ao projeto ${project.name}` : "a serviços"} {client ? `para o cliente ${client.name}.` : ""}
          </div>
        </div>
        <div className="f3-actions">
          <button className="f3-btn" onClick={openPDF}>
            <FileText size={15} /> Ver prévia do PDF
          </button>
          <button className="f3-btn" onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success("Link copiado"); }}>
            <Share2 size={15} /> Compartilhar
          </button>

          <button className="f3-btn" disabled={invoice.status === "paid" || invoice.status === "canceled"} onClick={() => sendInvoice.mutate()}>
            <Send size={15} /> Enviar cobrança
          </button>
          <button className="f3-btn" onClick={() => setEditingNotes(true)}><PenLine size={15} /> Editar fatura</button>
          <button className="f3-btn primary" disabled={invoice.status === "paid" || invoice.status === "canceled"} onClick={() => registerPayment.mutate()}>
            <Wallet size={15} /> Registrar pagamento
          </button>
        </div>
      </div>

      {/* strip */}
      <div className="f3-strip">
        <div>
          <div className="f3-slabel">Cliente</div>
          <div className="f3-svalue">{client?.name ?? "—"}</div>
          {client && <Link to="/clients/$clientId" params={{ clientId: client.id }} className="f3-slink">Ver cliente <ArrowRight size={11} /></Link>}
        </div>
        <div>
          <div className="f3-slabel">Projeto</div>
          <div className="f3-svalue">{project?.name ?? "Múltiplos"}</div>
          {project && <Link to="/projects/$projectId" params={{ projectId: project.id }} className="f3-slink">Ver projeto <ArrowRight size={11} /></Link>}
        </div>
        <div>
          <div className="f3-slabel">Emissão</div>
          <div className="f3-svalue"><Calendar size={14} color="#6B7A90" /> {fmtDate(invoice.issue_date)}</div>
          <div className="f3-shint">{invoice.issue_date ? `Há ${Math.max(0, -(daysDiff(invoice.issue_date) ?? 0))} dias` : "—"}</div>
        </div>
        <div>
          <div className="f3-slabel">Vencimento</div>
          <div className={`f3-svalue ${isOverdue ? "txt-red" : ""}`}><Calendar size={14} color={isOverdue ? "#E5484D" : "#6B7A90"} /> {fmtDate(invoice.due_date)}</div>
          <div className="f3-shint">{dd === null ? "—" : dd < 0 ? `Vencida há ${-dd} dias` : `Daqui a ${dd} dias`}</div>
        </div>
        <div>
          <div className="f3-slabel">Forma de pagamento</div>
          <div className="f3-svalue"><CreditCard size={14} color="#6B7A90" /> {invoice.payment_method || "A combinar"}</div>
          <div className="f3-shint">{invoice.payment_terms || "Ver instruções"}</div>
        </div>
        <div>
          <div className="f3-slabel">Parcelas</div>
          <div className="f3-svalue"><FileText size={14} color="#6B7A90" /> 1 de 1</div>
          <div className="f3-shint">Parcela única</div>
        </div>
        <div>
          <div className="f3-slabel">Valor total</div>
          <div className="f3-svalue big">{money(totals.total)}</div>
        </div>
        <div>
          <div className="f3-slabel">Valor recebido</div>
          <div className="f3-svalue big txt-green">{money(totals.received)}</div>
        </div>
        <div>
          <div className="f3-slabel">Saldo em aberto</div>
          <div className="f3-svalue big txt-red">{money(totals.open)}</div>
        </div>
      </div>

      <div className="f3-grid">
        {/* coluna esquerda */}
        <div className="f3-col">
          <div className="f3-card">
            <h3>Itens faturados</h3>
            {items.length === 0 ? (
              <div className="f3-empty">Nenhum item vinculado a esta fatura.</div>
            ) : (
              <>
                <table>
                  <thead>
                    <tr>
                      <th>Descrição</th>
                      <th className="num">Quantidade</th>
                      <th className="num">Valor unitário</th>
                      <th className="num">Desconto</th>
                      <th className="num">Referência</th>
                      <th className="num">Valor total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(it => (
                      <tr key={it.id}>
                        <td>
                          <div className="f3-itemtitle" style={it.deliverable_id ? { paddingLeft: 14 } : undefined}>{it.description}</div>
                          {it.deliverable_id && <div className="f3-itemdesc" style={{ paddingLeft: 14 }}>Entregável vinculado à tarefa</div>}
                        </td>
                        <td className="num">1</td>
                        <td className="num">{money(num(it.amount))}</td>
                        <td className="num">—</td>
                        <td className="num" style={{ color: "#6B7A90", fontSize: 12 }}>{fmtDate(it.due_date)}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{money(num(it.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="f3-totals">
                  <div className="f3-totrow"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
                  {totals.discount > 0 && <div className="f3-totrow"><span>Desconto</span><span>-{money(totals.discount)}</span></div>}
                  <div className="f3-totrow grand"><span>Total</span><span>{money(totals.total)}</span></div>
                </div>
              </>
            )}
          </div>

          <div className="f3-card">
            <h3>Parcelas</h3>
            <table>
              <thead>
                <tr>
                  <th>Parcela</th><th>Vencimento</th><th className="num">Valor</th>
                  <th className="num">Juros / Multa</th><th className="num">Desconto</th>
                  <th className="num">Total</th><th className="num">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>1 de 1</td>
                  <td>{fmtDate(invoice.due_date)}</td>
                  <td className="num">{money(totals.total)}</td>
                  <td className="num">{money(0)}</td>
                  <td className="num">{money(totals.discount)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{money(totals.total)}</td>
                  <td className="num">
                    <span className={`f3-pill ${invoice.status === "paid" ? "blue" : isOverdue ? "red" : "amber"}`}>
                      {invoice.status === "paid" ? "Paga" : isOverdue ? "Vencida" : "A vencer"}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="f3-card">
            <h3>Timeline da fatura</h3>
            <div className="f3-timeline">
              {steps.map((s, i) => (
                <div key={i} className={`f3-step ${s.done ? "done" : ""} ${s.current ? "current" : ""}`}>
                  <div className="f3-dot">{s.done && <Check size={12} />}</div>
                  <div className="f3-stepname">{s.name}</div>
                  <div className="f3-stepmeta">{s.at ? fmtDateTime(s.at.length > 10 ? s.at : s.at + "T00:00:00") : "—"}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="f3-card">
            <div className="f3-cardhead">
              <h3>Observações</h3>
              {!editingNotes && <button className="f3-btn" style={{ height: 30, padding: "0 12px" }} onClick={() => setEditingNotes(true)}>Editar</button>}
            </div>
            {editingNotes ? (
              <>
                <textarea className="f3-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anotações internas sobre esta fatura…" />
                <div className="f3-quick" style={{ marginTop: 10 }}>
                  <button className="f3-btn primary" onClick={() => saveNotes.mutate()}>Salvar</button>
                  <button className="f3-btn" onClick={() => { setNotes(invoice.notes ?? ""); setEditingNotes(false); }}>Cancelar</button>
                </div>
              </>
            ) : (
              <div className="f3-note">{invoice.notes || "Sem observações registradas."}</div>
            )}
          </div>
        </div>

        {/* coluna direita */}
        <div className="f3-col">
          <div className="f3-card">
            <h3>Resumo financeiro</h3>
            <div className="f3-sum">
              <div>
                <div className="f3-sumrow"><span>Valor total</span><span>{money(totals.total)}</span></div>
                <div className="f3-sumrow"><span>Valor recebido</span><span className="txt-green">{money(totals.received)}</span></div>
                <div className="f3-sumrow"><span>Saldo em aberto</span><span className="txt-red">{money(totals.open)}</span></div>
                <div className="f3-sumrow"><span>Vencimento</span><span className={isOverdue ? "txt-red" : ""}>{fmtDate(invoice.due_date)}</span></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <Donut
                  pct={paidPct === 0 ? 100 : paidPct}
                  label={paidPct === 0 ? "A receber" : "Pago"}
                  color={paidPct === 0 ? "#E5484D" : "#16A34A"}
                />
                <div className="f3-legend" style={{ width: "100%" }}>
                  <div><i style={{ background: "#E5484D" }} /> A receber <b>{money(totals.open)}</b></div>
                  <div><i style={{ background: "#16A34A" }} /> Pago <b>{money(totals.received)}</b></div>
                </div>
              </div>
            </div>
          </div>

          <div className="f3-card">
            <div className="f3-cardhead">
              <h3>Contato do cliente</h3>
              {client && <Link to="/clients/$clientId" params={{ clientId: client.id }} className="f3-link">Ver cliente <ArrowRight size={12} /></Link>}
            </div>
            <div className="f3-contact">
              <div className="f3-avatar">{initials || "--"}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{contactName}</div>
                <div style={{ fontSize: 12, color: "var(--f3-muted)" }}>{client?.contact_role || client?.company || "Contato principal"}</div>
              </div>
            </div>
            <div className="f3-contactline"><Mail size={14} /> {client?.contact_email || client?.billing_email || client?.email || "—"}</div>
            <div className="f3-contactline"><Phone size={14} /> {client?.contact_phone || client?.phone || "—"}</div>
          </div>

          <div className="f3-card">
            <h3>Histórico de pagamentos</h3>
            {invoice.paid_at ? (
              <div className="f3-hist">
                <span className="when">{fmtDateTime(invoice.paid_at)}</span>
                <span>{money(totals.total)} — {invoice.payment_method || "pagamento registrado"}</span>
              </div>
            ) : (
              <>
                <div className="f3-note" style={{ marginBottom: 12 }}>Nenhum pagamento registrado ainda.</div>
                <button className="f3-btn primary" disabled={invoice.status === "canceled"} onClick={() => registerPayment.mutate()}>
                  Registrar pagamento
                </button>
              </>
            )}
          </div>

          <div className="f3-card">
            <h3>Histórico de alterações</h3>
            <div className="f3-hist"><span className="when">{fmtDateTime(invoice.created_at)}</span><span className="who">Sistema</span><span>Fatura criada</span></div>
            {invoice.status !== "draft" && (
              <div className="f3-hist"><span className="when">{fmtDate(invoice.issue_date)}</span><span className="who">Sistema</span><span>Fatura emitida ao cliente</span></div>
            )}
            {invoice.paid_at && (
              <div className="f3-hist"><span className="when">{fmtDateTime(invoice.paid_at)}</span><span className="who">Sistema</span><span>Pagamento recebido</span></div>
            )}
          </div>

          <div className="f3-card">
            <h3>Ações rápidas</h3>
            <div className="f3-quick">
              <button className="f3-btn" onClick={() => navigate({ to: "/invoices", search: { new: "1", projectId: invoice.project_id ?? undefined } })}>
                <Copy size={15} /> Duplicar fatura
              </button>
              <button className="f3-btn" disabled={invoice.status !== "paid"} onClick={() => toast.success("Recibo gerado")}>
                <Receipt size={15} /> Gerar recibo
              </button>
              <button className="f3-btn danger" disabled={invoice.status === "canceled"} onClick={() => cancelInvoice.mutate()}>
                <XCircle size={15} /> Cancelar fatura
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
