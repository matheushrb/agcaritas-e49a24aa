import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { Fin02Invoices, type F2Invoice } from "@/components/fin02-invoices";

import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Receipt, Plus, Download, CheckCircle2, XCircle, ArrowLeft, ArrowRight, FileText, Building2, Pencil, Trash2, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { PaymentMethodTags, serializePaymentMethods } from "@/components/invoices/payment-methods";
import { generateInvoicePDF, DEFAULT_PAYMENT_TERMS, DEFAULT_LEGAL_NOTES } from "@/lib/pdf/invoice-pdf";
import { cn } from "@/lib/utils";
import QRCode from "qrcode";
import "@/fat01.css";

export const Route = createFileRoute("/_authenticated/invoices/")({
  component: InvoicesPage,
  validateSearch: (s: Record<string, unknown>) => ({
    projectId: typeof s.projectId === "string" ? s.projectId : undefined,
    new: s.new === "1" ? "1" as const : undefined,
  }),
});

type InvoiceStatus = "draft" | "issued" | "paid" | "canceled" | "pending";
type Invoice = {
  id: string; number: string; client_id: string | null; project_id: string | null;
  status: InvoiceStatus; issue_date: string; due_date: string | null;
  total: number | null; amount: number; paid_at: string | null; notes: string | null;
  payment_terms: string | null; payment_link: string | null;
};
type Client = {
  id: string; name: string;
  tax_id?: string | null; email?: string | null;
  legal_name?: string | null; company?: string | null; trade_name?: string | null;
  state_registration?: string | null; billing_email?: string | null;
  phone?: string | null; contact_name?: string | null; contact_role?: string | null;
  address_street?: string | null; address_number?: string | null; address_complement?: string | null;
  address_neighborhood?: string | null; address_city?: string | null; address_state?: string | null;
  address_zip?: string | null; address_country?: string | null;
};
type Project = { id: string; name: string; client_id: string | null };
type PendingCharge = {
  id: string; description: string; amount: number; due_date: string;
  client_id: string | null; project_id: string | null; task_id: string | null;
  deliverable_id?: string | null;
};
type Deliverable = {
  id: string; platform?: string | null; type?: string | null; channel?: string | null;
  billing_enabled?: boolean; billing_value?: number | null;
  delivered?: boolean; invoiced?: boolean;
  delivered_at?: string | null; delivered_date?: string | null;
  aired_at?: string | null; recorded_at?: string | null;
};
type BillableTask = {
  id: string; title: string; billing_value: number | null; billing_enabled: boolean;
  client_id: string | null; project_id: string | null; status: string | null;
  deliverables?: Deliverable[] | null;
  due_date?: string | null;
  aired_at?: string | null; aired_dates?: string[] | null;
  recorded_at?: string | null; recorded_dates?: string[] | null;
};
type BillableDeliverable = {
  key: string; // taskId::deliverableId
  taskId: string; deliverableId: string; taskTitle: string;
  label: string; amount: number;
  client_id: string | null; project_id: string | null;
  reference_date?: string | null; reference_label?: string;
};
type Organization = {
  id: string; name: string | null;
  legal_name?: string | null; tax_id?: string | null; email?: string | null;
  phone?: string | null; address?: string | null; website?: string | null; bank_info?: string | null;
};

/* ---------- helpers de partes / datas ---------- */
function formatClientAddress(c: Client): string | null {
  const line1 = [c.address_street, c.address_number].filter(Boolean).join(", ");
  const line2 = [c.address_complement, c.address_neighborhood].filter(Boolean).join(" · ");
  const line3 = [
    [c.address_city, c.address_state].filter(Boolean).join("/"),
    c.address_zip ? `CEP ${c.address_zip}` : null,
  ].filter(Boolean).join(" · ");
  const joined = [line1, line2, line3].filter(Boolean).join("\n");
  return joined || null;
}
function buildClientParty(c: Client | undefined) {
  if (!c) return { name: "—" };
  return {
    name: c.name,
    company: c.trade_name || c.company || null,
    legal_name: c.legal_name || null,
    document: c.tax_id || null,
    state_registration: c.state_registration || null,
    email: c.billing_email || c.email || null,
    phone: c.phone || null,
    address: formatClientAddress(c),
    contact_name: c.contact_name || null,
    contact_role: c.contact_role || null,
  };
}
function buildAgencyParty(o: Organization | null | undefined) {
  if (!o) return undefined;
  return {
    name: o.name ?? null,
    legal_name: o.legal_name ?? null,
    document: o.tax_id ?? null,
    email: o.email ?? null,
    phone: o.phone ?? null,
    address: o.address ?? null,
    website: o.website ?? null,
    bank_info: o.bank_info ?? null,
  };
}
function taskReference(t: Pick<BillableTask, "aired_at" | "aired_dates" | "recorded_at" | "recorded_dates" | "due_date">) {
  const air = (t.aired_dates && t.aired_dates.length ? t.aired_dates[0] : null) ?? t.aired_at ?? null;
  if (air) return { reference_date: air, reference_label: "Transmissão" };
  const rec = (t.recorded_dates && t.recorded_dates.length ? t.recorded_dates[0] : null) ?? t.recorded_at ?? null;
  if (rec) return { reference_date: rec, reference_label: "Gravação" };
  if (t.due_date) return { reference_date: t.due_date, reference_label: "Prazo" };
  return { reference_date: null as string | null, reference_label: "Referência" };
}
function deliverableReference(t: BillableTask, d: Deliverable) {
  const delivered = d.delivered_at || d.delivered_date;
  if (delivered) return { reference_date: delivered, reference_label: "Entregue em" };
  const air = d.aired_at ?? null;
  if (air) return { reference_date: air, reference_label: "Transmissão" };
  const rec = d.recorded_at ?? null;
  if (rec) return { reference_date: rec, reference_label: "Gravação" };
  return taskReference(t);
}

const STATUS_META: Record<InvoiceStatus, { label: string; className: string }> = {
  draft:    { label: "Aguardando confirmação", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  issued:   { label: "Emitida",  className: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  pending:  { label: "Emitida",  className: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  paid:     { label: "Paga",     className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  canceled: { label: "Cancelada",className: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

function InvoicesPage() {
  const qc = useQueryClient();
  const search = useSearch({ from: "/_authenticated/invoices/" });
  const navigate = useNavigate();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (search.new === "1") setWizardOpen(true);
  }, [search.new]);

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id,number,client_id,project_id,status,issue_date,due_date,total,amount,paid_at,notes,payment_terms,payment_link,payment_method")
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-basic"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select(
        "id,name,tax_id,email,legal_name,company,trade_name,state_registration,billing_email,phone,contact_name,contact_role,address_street,address_number,address_complement,address_neighborhood,address_city,address_state,address_zip,address_country",
      ).order("name");
      return (data ?? []) as Client[];
    },
  });

  const { data: organization = null } = useQuery<Organization | null>({
    queryKey: ["organization-invoice"],
    queryFn: async () => {
      const { data: p } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!p?.organization_id) return null;
      const { data } = await supabase.from("organizations")
        .select("id,name,legal_name,tax_id,email,phone,address,website,bank_info")
        .eq("id", p.organization_id).maybeSingle();
      return (data ?? null) as Organization | null;
    },
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects-basic"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id,name,client_id").order("name");
      return (data ?? []) as Project[];
    },
  });

  const clientById = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c])), [clients]);
  const projectById = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects]);

  return (
    <div className="px-6 py-6">
      <Fin02Invoices
        invoices={invoices as unknown as F2Invoice[]}
        clients={clients}
        projects={projects}
        onOpen={(id) => navigate({ to: "/invoices/$invoiceId", params: { invoiceId: id } })}
        onNewInvoice={() => setWizardOpen(true)}
        onNewCharge={() => navigate({ to: "/finance", search: { new: 1 } })}
        onExport={() => exportInvoicesCsv(invoices, clientById, projectById)}
      />


      {wizardOpen && (
        <NewInvoiceWizard
          initialProjectId={search.projectId}
          clients={clients}
          projects={projects}
          organization={organization}
          onClose={() => setWizardOpen(false)}
          onCreated={(id) => {
            setWizardOpen(false);
            qc.invalidateQueries({ queryKey: ["invoices"] });
            qc.invalidateQueries({ queryKey: ["charges"] });
            setDetailId(id);
          }}
        />
      )}

      {detailId && (
        <InvoiceDetail
          id={detailId}
          clients={clients}
          organization={organization}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

function exportInvoicesCsv(
  invoices: Invoice[],
  clientById: Record<string, Client>,
  projectById: Record<string, Project>,
) {
  const head = ["Número", "Cliente", "Projeto", "Emissão", "Vencimento", "Status", "Total", "Recebido"];
  const rows = invoices.map(i => [
    i.number ?? "",
    i.client_id ? clientById[i.client_id]?.name ?? "" : "",
    i.project_id ? projectById[i.project_id]?.name ?? "" : "",
    i.issue_date ?? "",
    i.due_date ?? "",
    STATUS_META[i.status]?.label ?? i.status,
    Number(i.total ?? i.amount ?? 0).toFixed(2),
    i.paid_at ? Number(i.total ?? i.amount ?? 0).toFixed(2) : "0.00",
  ]);
  const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `faturas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Exportação gerada");
}



/* ------------------------- FAT-01 · Wizard Nova fatura -------------------- */
const PAYMENT_CONDITIONS: Array<{ value: string; label: string; days: number | null }> = [
  { value: "a_vista", label: "À vista", days: 0 },
  { value: "7", label: "7 dias", days: 7 },
  { value: "14", label: "14 dias", days: 14 },
  { value: "15", label: "15 dias", days: 15 },
  { value: "28", label: "28 dias", days: 28 },
  { value: "30", label: "30 dias", days: 30 },
  { value: "45", label: "45 dias", days: 45 },
  { value: "60", label: "60 dias", days: 60 },
  { value: "custom", label: "Personalizada", days: null },
];


function addDays(base: string, days: number) {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function NewInvoiceWizard({
  initialProjectId, clients, projects, organization, onClose, onCreated,
}: {
  initialProjectId?: string;
  clients: Client[]; projects: Project[];
  organization: Organization | null;
  onClose: () => void; onCreated: (id: string) => void;
}) {
  const initialClient = initialProjectId ? projects.find(p => p.id === initialProjectId)?.client_id ?? "" : "";
  const [step, setStep] = useState(1);
  const [filterClient, setFilterClient] = useState<string>(initialClient);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(
    new Set(initialProjectId ? [initialProjectId] : []),
  );
  const [selectedCharges, setSelectedCharges] = useState<Set<string>>(new Set());
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [payerClient, setPayerClient] = useState<string>(initialClient);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState<string>("");
  const [paymentCondition, setPaymentCondition] = useState<string>("30");
  const [paymentMethods, setPaymentMethods] = useState<string[]>(["PIX"]);
  const [discount, setDiscount] = useState<number>(0);
  const [surcharge, setSurcharge] = useState<number>(0);
  const [notes, setNotes] = useState(DEFAULT_LEGAL_NOTES);
  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_PAYMENT_TERMS);
  const [paymentLink, setPaymentLink] = useState("");
  const [paymentQrPreview, setPaymentQrPreview] = useState<string | null>(null);
  const [previewNumber, setPreviewNumber] = useState("—");
  const [submitting, setSubmitting] = useState(false);
  const [selectedDeliverables, setSelectedDeliverables] = useState<Set<string>>(new Set());
  const [lineDateOverrides, setLineDateOverrides] = useState<Record<string, string>>({});

  // Número previsto da fatura (mesma regra do banco: AAAAMM + sequencial contínuo)
  useEffect(() => {
    let active = true;
    (async () => {
      const base = issueDate || new Date().toISOString().slice(0, 10);
      const ym = base.slice(0, 7).replace("-", "");
      const { data } = await supabase.from("invoices").select("number");
      const max = (data ?? []).reduce((m: number, r: { number: string | null }) => {
        const raw = String(r.number ?? "").trim();
        if (!/^\d{9,}$/.test(raw)) return m;
        const seq = parseInt(raw.slice(6), 10);
        return Number.isFinite(seq) && seq > m ? seq : m;
      }, 139);
      if (active) setPreviewNumber(`${ym}${String(max + 1).padStart(3, "0")}`);
    })();
    return () => { active = false; };
  }, [issueDate]);

  // Vencimento derivado da condição de pagamento
  useEffect(() => {
    const cond = PAYMENT_CONDITIONS.find(c => c.value === paymentCondition);
    if (!cond || cond.days === null || !issueDate) return;
    setDueDate(addDays(issueDate, cond.days));
  }, [paymentCondition, issueDate]);

  useEffect(() => {
    let active = true;
    const payload = paymentLink.trim();
    if (!payload) {
      setPaymentQrPreview(null);
      return () => { active = false; };
    }
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 192,
      color: { dark: "#1E3A8A", light: "#ffffff" },
    })
      .then((url) => { if (active) setPaymentQrPreview(url); })
      .catch(() => { if (active) setPaymentQrPreview(null); });
    return () => { active = false; };
  }, [paymentLink]);

  const projectFilterActive = selectedProjects.size > 0;
  // Itens sem projeto ficam sempre disponíveis; o filtro restringe apenas itens vinculados a projeto.
  const inProjects = (pid: string | null) => !pid || !projectFilterActive || selectedProjects.has(pid);

  // Pending charges + billable tasks
  const { data: charges = [] } = useQuery<PendingCharge[]>({
    queryKey: ["invoices-pending-charges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("charges")
        .select("id,description,amount,due_date,client_id,project_id,task_id,status,invoice_id")
        .in("status", ["pending_invoice", "pending", "overdue"])
        .is("invoice_id", null)
        .order("due_date", { ascending: true });
      return (data ?? []) as unknown as PendingCharge[];
    },
  });

  const { data: tasksData = { tasks: [], invoicedMainTaskIds: new Set<string>(), invoicedDeliverableIds: new Set<string>() } } = useQuery({
    queryKey: ["invoices-billable-tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id,title,billing_value,billing_enabled,client_id,project_id,status,deliverables,due_date,aired_at,aired_dates,recorded_at,recorded_dates")
        .eq("billing_enabled", true);
      const ts = (data ?? []) as BillableTask[];
      const { data: existingCharges } = await supabase
        .from("charges")
        .select("task_id,deliverable_id")
        .not("task_id", "is", null);
      const invoicedMainTaskIds = new Set<string>();
      const invoicedDeliverableIds = new Set<string>();
      for (const r of (existingCharges ?? []) as Array<{ task_id: string | null; deliverable_id: string | null }>) {
        if (!r.task_id) continue;
        if (r.deliverable_id) invoicedDeliverableIds.add(r.deliverable_id);
        else invoicedMainTaskIds.add(r.task_id);
      }
      return { tasks: ts, invoicedMainTaskIds, invoicedDeliverableIds };
    },
  });

  const tasks = tasksData.tasks;
  const invoicedMainTaskIds = tasksData.invoicedMainTaskIds;
  const invoicedDeliverableIds = tasksData.invoicedDeliverableIds;

  const filteredCharges = useMemo(() => charges.filter(c =>
    (!filterClient || c.client_id === filterClient) && inProjects(c.project_id),
  ), [charges, filterClient, selectedProjects]);

  const filteredTasks = useMemo(() => tasks.filter(t =>
    !invoicedMainTaskIds.has(t.id) &&
    (!filterClient || t.client_id === filterClient) &&
    inProjects(t.project_id) &&
    (t.billing_value ?? 0) > 0,
  ), [tasks, invoicedMainTaskIds, filterClient, selectedProjects]);

  const billableDeliverables = useMemo<BillableDeliverable[]>(() => {
    const out: BillableDeliverable[] = [];
    for (const t of tasks) {
      if (filterClient && t.client_id !== filterClient) continue;
      if (!inProjects(t.project_id)) continue;
      const list = Array.isArray(t.deliverables) ? t.deliverables : [];
      for (const d of list) {
        if (!d?.id) continue;
        if (!d.delivered) continue;
        if (!d.billing_enabled) continue;
        const amount = Number(d.billing_value ?? 0);
        if (amount <= 0) continue;
        if (d.invoiced) continue;
        if (invoicedDeliverableIds.has(d.id)) continue;
        const parts = String(d.platform ?? "").trim();
        const ref = deliverableReference(t, d);
        out.push({
          key: `${t.id}::${d.id}`,
          taskId: t.id,
          deliverableId: d.id,
          taskTitle: t.title,
          label: parts ? `Entregável ${parts}` : "Entregável",
          amount,
          client_id: t.client_id,
          project_id: t.project_id,
          reference_date: ref.reference_date,
          reference_label: ref.reference_label,
        });
      }
    }
    return out;
  }, [tasks, invoicedDeliverableIds, filterClient, selectedProjects]);

  const subtotal = useMemo(() => {
    let t = 0;
    for (const c of filteredCharges) if (selectedCharges.has(c.id)) t += Number(c.amount ?? 0);
    for (const tk of filteredTasks) if (selectedTasks.has(tk.id)) t += Number(tk.billing_value ?? 0);
    for (const d of billableDeliverables) if (selectedDeliverables.has(d.key)) t += d.amount;
    return t;
  }, [filteredCharges, filteredTasks, billableDeliverables, selectedCharges, selectedTasks, selectedDeliverables]);

  const total = Math.max(0, subtotal - (discount || 0) + (surcharge || 0));
  const itemCount = selectedCharges.size + selectedTasks.size + selectedDeliverables.size;

  const canGoNext = step === 1
    ? !!payerClient && !!issueDate
    : step === 2 ? itemCount > 0
    : !!payerClient && !!issueDate;

  const previewLines = useMemo(() => {
    const lines: Array<{
      key: string;
      title: string; detail?: string; amount: number; is_child?: boolean;
      reference_date?: string | null; reference_label?: string;
      group?: string | null; service?: string | null;
    }> = [];
    const withOverride = (key: string, fallback: string | null | undefined) =>
      lineDateOverrides[key] ?? (fallback ?? null);
    const groupOf = (projectId: string | null | undefined) =>
      (projectId ? projects.find(p => p.id === projectId)?.name ?? null : null);
    for (const c of filteredCharges) if (selectedCharges.has(c.id)) {
      const key = `charge:${c.id}`;
      lines.push({
        key,
        title: c.description || "Cobrança",
        amount: Number(c.amount ?? 0),
        reference_date: withOverride(key, c.due_date),
        reference_label: "Prazo",
        group: groupOf(c.project_id),
        service: "Serviço",
      });
    }
    for (const tk of filteredTasks) if (selectedTasks.has(tk.id)) {
      const ref = taskReference(tk);
      const key = `task:${tk.id}`;
      lines.push({
        key,
        title: tk.title,
        amount: Number(tk.billing_value ?? 0),
        reference_date: withOverride(key, ref.reference_date),
        reference_label: ref.reference_label,
        group: groupOf(tk.project_id),
        service: ref.reference_label,
      });
      for (const d of billableDeliverables) {
        if (d.taskId === tk.id && selectedDeliverables.has(d.key)) {
          const dkey = `deliv:${d.key}`;
          lines.push({
            key: dkey,
            title: d.label, amount: d.amount, is_child: true,
            reference_date: withOverride(dkey, d.reference_date),
            reference_label: d.reference_label,
            group: groupOf(d.project_id),
            service: d.reference_label,
          });
        }
      }
    }
    const includedTaskIds = new Set(Array.from(selectedTasks));
    for (const d of billableDeliverables) {
      if (selectedDeliverables.has(d.key) && !includedTaskIds.has(d.taskId)) {
        const dkey = `deliv:${d.key}`;
        lines.push({
          key: dkey,
          title: d.label, amount: d.amount,
          reference_date: withOverride(dkey, d.reference_date),
          reference_label: d.reference_label,
          group: groupOf(d.project_id),
          service: d.reference_label,
        });
      }
    }
    const order: string[] = [];
    const buckets = new Map<string, typeof lines>();
    for (const l of lines) {
      const g = l.group ?? "";
      if (!buckets.has(g)) { buckets.set(g, []); order.push(g); }
      buckets.get(g)!.push(l);
    }
    return order.flatMap(g => buckets.get(g)!);
  }, [filteredCharges, filteredTasks, billableDeliverables, selectedCharges, selectedTasks, selectedDeliverables, lineDateOverrides, projects]);

  const adjustmentLines = useMemo(() => {
    const extra: typeof previewLines = [];
    if (discount > 0) extra.push({ key: "adj:discount", title: "Desconto concedido", amount: -discount, group: null });
    if (surcharge > 0) extra.push({ key: "adj:surcharge", title: "Acréscimo / taxa", amount: surcharge, group: null });
    return [...previewLines, ...extra];
  }, [previewLines, discount, surcharge]);

  async function openPreviewPDF() {
    const client = clients.find(c => c.id === payerClient);
    const issue = issueDate || new Date().toISOString().slice(0, 10);
    const doc = await generateInvoicePDF({
      number: previewNumber,
      issue_date: issue,
      competence: new Date(issue + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", ""),
      due_date: dueDate || null,
      client: buildClientParty(client),
      agency: buildAgencyParty(organization),
      lines: adjustmentLines,
      notes: notes || undefined,
      payment_terms: paymentTerms || undefined,
      payment_link: paymentLink.trim() || undefined,
      pix_code: paymentLink.trim() || undefined,
      status_label: "Rascunho",
      is_preview: true,
    });
    const url = doc.output("bloburl") as unknown as string;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function submit() {
    setSubmitting(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");

      const newCharges: string[] = [];
      for (const tk of filteredTasks) {
        if (!selectedTasks.has(tk.id)) continue;
        const overrideDate = lineDateOverrides[`task:${tk.id}`];
        const ref = taskReference(tk);
        const chargeDate = overrideDate || ref.reference_date || dueDate || issueDate;
        const { data: inserted, error } = await supabase.from("charges").insert({
          organization_id: profile.organization_id,
          project_id: tk.project_id,
          task_id: tk.id,
          client_id: tk.client_id,
          description: `Tarefa: ${tk.title}`,
          amount: Number(tk.billing_value ?? 0),
          status: "pending_invoice",
          due_date: chargeDate,
          type: "income",
        }).select("id").single();
        if (error) throw error;
        if (inserted) newCharges.push(inserted.id);
      }

      const deliverablesByTask = new Map<string, Set<string>>();
      for (const d of billableDeliverables) {
        if (!selectedDeliverables.has(d.key)) continue;
        const overrideDate = lineDateOverrides[`deliv:${d.key}`];
        const chargeDate = overrideDate || d.reference_date || dueDate || issueDate;
        const { data: inserted, error } = await supabase.from("charges").insert({
          organization_id: profile.organization_id,
          project_id: d.project_id,
          task_id: d.taskId,
          deliverable_id: d.deliverableId,
          client_id: d.client_id,
          description: d.label,
          amount: d.amount,
          status: "pending_invoice",
          due_date: chargeDate,
          type: "income",
        } as never).select("id").single();
        if (error) throw error;
        if (inserted) newCharges.push(inserted.id);
        if (!deliverablesByTask.has(d.taskId)) deliverablesByTask.set(d.taskId, new Set());
        deliverablesByTask.get(d.taskId)!.add(d.deliverableId);
      }

      for (const c of filteredCharges) {
        if (!selectedCharges.has(c.id)) continue;
        const ov = lineDateOverrides[`charge:${c.id}`];
        if (ov && ov !== c.due_date) {
          await supabase.from("charges").update({ due_date: ov }).eq("id", c.id);
        }
      }
      for (const [taskId, delIds] of deliverablesByTask) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) continue;
        const next = (task.deliverables ?? []).map(dd =>
          delIds.has(dd.id) ? { ...dd, invoiced: true } : dd
        );
        await supabase.from("tasks").update({ deliverables: next } as never).eq("id", taskId);
      }

      const chargeIds = [...selectedCharges, ...newCharges];
      const projectIds = new Set<string>();
      for (const c of filteredCharges) if (selectedCharges.has(c.id) && c.project_id) projectIds.add(c.project_id);
      for (const tk of filteredTasks) if (selectedTasks.has(tk.id) && tk.project_id) projectIds.add(tk.project_id);
      for (const d of billableDeliverables) if (selectedDeliverables.has(d.key) && d.project_id) projectIds.add(d.project_id);
      const singleProject = projectIds.size === 1 ? [...projectIds][0] : null;

      const { data: invoice, error: invErr } = await supabase.from("invoices").insert({
        organization_id: profile.organization_id,
        number: "",
        client_id: payerClient || null,
        project_id: singleProject,
        issue_date: issueDate,
        due_date: dueDate || null,
        amount: total,
        total,
        subtotal,
        discount: discount || 0,
        payment_method: serializePaymentMethods(paymentMethods) || null,
        status: "draft",
        notes: notes || null,
        payment_terms: paymentTerms || null,
        payment_link: paymentLink.trim() || null,
      }).select("id").single();
      if (invErr) throw invErr;

      const { error: linkErr } = await supabase.from("charges")
        .update({ invoice_id: invoice.id, status: "draft" } as never)
        .in("id", chargeIds);
      if (linkErr) throw linkErr;

      toast.success("Fatura criada como rascunho. Confirme para gerar lançamento financeiro.");
      onCreated(invoice.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const stepLabels = ["Informações", "Itens da fatura", "Revisão"];
  const clientObj = clients.find(c => c.id === payerClient);
  const visibleProjects = projects.filter(p => !filterClient || p.client_id === filterClient);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="fat01 max-w-[1180px] w-[96vw] max-h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="fat01-head space-y-0">
          <DialogTitle className="fat01-title"><Receipt className="h-5 w-5" style={{ color: "var(--f1-primary)" }} />Nova fatura</DialogTitle>
          <DialogDescription className="fat01-sub">
            Selecione cliente e projetos, escolha os itens faturáveis e revise antes de emitir.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="fat01-stepper">
          {stepLabels.map((label, i) => (
            <div key={label} className="fat01-step" data-state={step === i + 1 ? "active" : step > i + 1 ? "done" : "idle"}>
              <div className="fat01-step-dot">{step > i + 1 ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}</div>
              <span className="fat01-step-label">{label}</span>
              {i < stepLabels.length - 1 && <div className="fat01-step-line" />}
            </div>
          ))}
        </div>

        <div className="fat01-body">
          {/* ------------------------------ Conteúdo ------------------------------ */}
          <div className="fat01-main">
            {step === 1 && (
              <div className="fat01-grid">
                <div className="fat01-field">
                  <label className="fat01-label">Cliente <span>*</span></label>
                  <Select value={payerClient} onValueChange={(v) => { setPayerClient(v); setFilterClient(v); setSelectedProjects(new Set()); }}>
                    <SelectTrigger className="fat01-input"><SelectValue placeholder="Escolha o cliente" /></SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <span className="fat01-hint">O cliente define quais projetos e itens podem ser faturados.</span>
                </div>

                <div className="fat01-field">
                  <label className="fat01-label">Data de emissão <span>*</span></label>
                  <Input type="date" className="fat01-input" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                </div>

                <div className="fat01-field full">
                  <label className="fat01-label">Projeto(s) <span>*</span></label>
                  <div className="fat01-projects">
                    {visibleProjects.length === 0 && (
                      <div className="px-3 py-4 text-[12px]" style={{ color: "var(--f1-muted)" }}>
                        Nenhum projeto para este cliente.
                      </div>
                    )}
                    {visibleProjects.map(p => {
                      const checked = selectedProjects.has(p.id);
                      return (
                        <label key={p.id} className="fat01-proj" data-checked={checked}>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const next = new Set(selectedProjects);
                              v ? next.add(p.id) : next.delete(p.id);
                              setSelectedProjects(next);
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{p.name}</div>
                            <div className="fat01-proj-client truncate">
                              {clients.find(c => c.id === p.client_id)?.name ?? "Sem cliente"}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                  <span className="fat01-hint">
                    Pode marcar mais de um projeto — os itens ficam agrupados por projeto na fatura.
                    Sem marcar nenhum, todos os itens pendentes do cliente aparecem.
                  </span>
                </div>

                <div className="fat01-field">
                  <label className="fat01-label">Condição de pagamento</label>
                  <Select value={paymentCondition} onValueChange={setPaymentCondition}>
                    <SelectTrigger className="fat01-input"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="fat01-field">
                  <label className="fat01-label">Formas de pagamento aceitas</label>
                  <PaymentMethodTags value={paymentMethods} onChange={setPaymentMethods} />
                </div>

                <div className="fat01-field">
                  <label className="fat01-label">Vencimento</label>
                  <Input type="date" className="fat01-input" value={dueDate}
                    onChange={e => { setDueDate(e.target.value); setPaymentCondition("custom"); }} />
                  <span className="fat01-hint">Calculado pela condição de pagamento — pode ajustar manualmente.</span>
                </div>

                <div className="fat01-field full">
                  <label className="fat01-label">Observações</label>
                  <Textarea
                    className="fat01-textarea"
                    rows={3}
                    maxLength={1000}
                    value={notes}
                    onChange={e => setNotes(e.target.value.slice(0, 1000))}
                    placeholder="Ex.: A NF será emitida após confirmação do pagamento."
                  />
                  <div className="fat01-counter">{notes.length}/1000</div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                {(() => {
                  const delivsByTask = new Map<string, BillableDeliverable[]>();
                  for (const d of billableDeliverables) {
                    if (!delivsByTask.has(d.taskId)) delivsByTask.set(d.taskId, []);
                    delivsByTask.get(d.taskId)!.push(d);
                  }
                  const shownTaskIds = new Set(filteredTasks.map(t => t.id));
                  const orphanDelivEntries = Array.from(delivsByTask.entries())
                    .filter(([taskId]) => !shownTaskIds.has(taskId));

                  type ProjectGroup = {
                    projectId: string | "none";
                    projectName: string;
                    clientName: string;
                    charges: typeof filteredCharges;
                    tasks: typeof filteredTasks;
                    orphanDelivs: Array<[string, BillableDeliverable[]]>;
                  };
                  const groups = new Map<string, ProjectGroup>();
                  const ensureGroup = (pid: string | null, cid: string | null): ProjectGroup => {
                    const key = pid ?? "none";
                    if (!groups.has(key)) {
                      const proj = pid ? projects.find(p => p.id === pid) : null;
                      const client = cid ? clients.find(c => c.id === cid) : null;
                      groups.set(key, {
                        projectId: key as string | "none",
                        projectName: proj?.name ?? "Sem projeto",
                        clientName: client?.name ?? (proj?.client_id ? clients.find(c => c.id === proj.client_id)?.name ?? "" : ""),
                        charges: [], tasks: [], orphanDelivs: [],
                      });
                    }
                    return groups.get(key)!;
                  };
                  for (const c of filteredCharges) ensureGroup(c.project_id, c.client_id).charges.push(c);
                  for (const t of filteredTasks) ensureGroup(t.project_id, t.client_id).tasks.push(t);
                  for (const entry of orphanDelivEntries) {
                    const first = entry[1][0];
                    ensureGroup(first.project_id, first.client_id).orphanDelivs.push(entry);
                  }

                  const groupList = Array.from(groups.values()).sort((a, b) => a.projectName.localeCompare(b.projectName, "pt-BR"));

                  if (groupList.length === 0) {
                    return (
                      <div className="text-center py-10 text-[13px]" style={{ color: "var(--f1-muted)" }}>
                        Nada pendente de faturamento com o cliente e os projetos escolhidos.
                      </div>
                    );
                  }

                  const renderDelivs = (list: BillableDeliverable[]) => list.map(d => (
                    <label key={d.key} className="fat01-row child" data-checked={selectedDeliverables.has(d.key)}>
                      <Checkbox
                        checked={selectedDeliverables.has(d.key)}
                        onCheckedChange={(v) => {
                          const next = new Set(selectedDeliverables);
                          v ? next.add(d.key) : next.delete(d.key);
                          setSelectedDeliverables(next);
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="fat01-row-title">↳ {d.label}</span>{" "}
                        <span className="fat01-badge green">Entregue</span>
                      </div>
                      <div className="fat01-row-amount">{money(d.amount)}</div>
                    </label>
                  ));

                  return groupList.map(g => {
                    const groupTotal =
                      g.charges.reduce((s, c) => s + Number(c.amount ?? 0), 0) +
                      g.tasks.reduce((s, t) => s + Number(t.billing_value ?? 0), 0) +
                      g.orphanDelivs.reduce((s, [, l]) => s + l.reduce((ss, d) => ss + d.amount, 0), 0);
                    return (
                      <section key={g.projectId} className="fat01-group">
                        <header className="fat01-group-head">
                          <div className="min-w-0">
                            <div className="fat01-group-name truncate">{g.projectName}</div>
                            {g.clientName && <div className="fat01-group-client truncate">{g.clientName}</div>}
                          </div>
                          <div className="fat01-group-total">Faturável: <b>{money(groupTotal)}</b></div>
                        </header>
                        <div className="fat01-group-body">
                          {g.charges.length > 0 && (
                            <>
                              <div className="fat01-sec">Cobranças</div>
                              {g.charges.map(c => (
                                <label key={c.id} className="fat01-row" data-checked={selectedCharges.has(c.id)}>
                                  <Checkbox
                                    checked={selectedCharges.has(c.id)}
                                    onCheckedChange={(v) => {
                                      const next = new Set(selectedCharges);
                                      v ? next.add(c.id) : next.delete(c.id);
                                      setSelectedCharges(next);
                                    }}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="fat01-row-title truncate">{c.description}</div>
                                    {c.due_date && <div className="fat01-group-client">Prazo: {fmtDate(c.due_date)}</div>}
                                  </div>
                                  <div className="fat01-row-amount">{money(Number(c.amount ?? 0))}</div>
                                </label>
                              ))}
                            </>
                          )}

                          {(g.tasks.length > 0 || g.orphanDelivs.length > 0) && (
                            <>
                              <div className="fat01-sec">Tarefas e entregáveis</div>
                              {g.tasks.map(t => {
                                const done = t.status === "done";
                                const taskDelivs = delivsByTask.get(t.id) ?? [];
                                return (
                                  <div key={t.id}>
                                    <label className="fat01-row" data-checked={selectedTasks.has(t.id)}>
                                      <Checkbox
                                        checked={selectedTasks.has(t.id)}
                                        onCheckedChange={(v) => {
                                          const next = new Set(selectedTasks);
                                          const nextD = new Set(selectedDeliverables);
                                          if (v) {
                                            next.add(t.id);
                                            taskDelivs.forEach(d => nextD.add(d.key));
                                          } else {
                                            next.delete(t.id);
                                            taskDelivs.forEach(d => nextD.delete(d.key));
                                          }
                                          setSelectedTasks(next);
                                          setSelectedDeliverables(nextD);
                                        }}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <span className="fat01-row-title">{t.title}</span>{" "}
                                        <span className={cn("fat01-badge", done ? "green" : "amber")}>
                                          {done ? "Concluída" : "Em andamento"}
                                        </span>{" "}
                                        {taskDelivs.length > 0 && (
                                          <span className="fat01-badge">
                                            +{taskDelivs.length} entregável{taskDelivs.length > 1 ? "eis" : ""}
                                          </span>
                                        )}
                                      </div>
                                      <div className="fat01-row-amount">{money(Number(t.billing_value ?? 0))}</div>
                                    </label>
                                    {renderDelivs(taskDelivs)}
                                  </div>
                                );
                              })}
                              {g.orphanDelivs.map(([taskId, list]) => (
                                <div key={taskId}>
                                  <div className="fat01-row" style={{ cursor: "default" }}>
                                    <div className="flex-1 min-w-0">
                                      <span className="fat01-row-title" style={{ color: "var(--f1-muted)" }}>{list[0].taskTitle}</span>{" "}
                                      <span className="fat01-badge muted">Principal já faturado</span>
                                    </div>
                                  </div>
                                  {renderDelivs(list)}
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </section>
                    );
                  });
                })()}

                <div className="fat01-adjust">
                  <div className="fat01-field">
                    <label className="fat01-label">Desconto (R$)</label>
                    <Input type="number" min={0} step="0.01" className="fat01-input"
                      value={discount || ""} onChange={e => setDiscount(Number(e.target.value) || 0)} placeholder="0,00" />
                  </div>
                  <div className="fat01-field">
                    <label className="fat01-label">Acréscimo / taxa (R$)</label>
                    <Input type="number" min={0} step="0.01" className="fat01-input"
                      value={surcharge || ""} onChange={e => setSurcharge(Number(e.target.value) || 0)} placeholder="0,00" />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="fat01-grid">
                  <div className="fat01-field">
                    <label className="fat01-label">Emissão</label>
                    <Input type="date" className="fat01-input" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                  </div>
                  <div className="fat01-field">
                    <label className="fat01-label">Vencimento</label>
                    <Input type="date" className="fat01-input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                  </div>
                  <div className="fat01-field full">
                    <label className="fat01-label">Condições de pagamento</label>
                    <Textarea className="fat01-textarea" rows={2} value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
                      placeholder="Prazo, forma de pagamento, chave PIX, etc." />
                  </div>
                  <div className="fat01-field full">
                    <label className="fat01-label">Link, PIX copia e cola ou chave de pagamento</label>
                    <Input type="text" className="fat01-input" value={paymentLink} onChange={e => setPaymentLink(e.target.value)}
                      placeholder="Cole aqui o PIX copia e cola, link de checkout ou boleto" />
                    <span className="fat01-hint">Se preenchido, o QR Code é gerado no PDF.</span>
                  </div>
                </div>

                {/* ------- Prévia da fatura ------- */}
                {(() => {
                  const clientParty = buildClientParty(clientObj);
                  const agencyParty = buildAgencyParty(organization) ?? { name: "Caritas Agência", legal_name: null, document: null, email: null, phone: null, address: null, website: null, bank_info: null };
                  return (
                    <div className="fat01-preview">
                      <div className="fat01-preview-head">
                        <span className="flex items-center gap-2"><FileText className="h-4 w-4" />Prévia da fatura</span>
                        <b>{previewNumber}</b>
                      </div>
                      <div className="p-4 space-y-3 text-xs">
                        <div className="grid grid-cols-3 gap-3 pb-3" style={{ borderBottom: "1px solid var(--f1-border)" }}>
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--f1-muted)" }}>Emitida em</div>
                            <div className="font-semibold text-sm">{fmtDate(issueDate)}</div>
                          </div>
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--f1-muted)" }}>Vencimento</div>
                            <div className="font-semibold text-sm">{dueDate ? fmtDate(dueDate) : "—"}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--f1-muted)" }}>Valor total</div>
                            <div className="font-bold text-base" style={{ color: "var(--f1-primary)" }}>{money(total)}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pb-3" style={{ borderBottom: "1px solid var(--f1-border)" }}>
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--f1-muted)" }}>Faturado para</div>
                            <div className="font-semibold">{clientParty.legal_name || clientParty.company || clientParty.name || "—"}</div>
                            {clientParty.document && <div style={{ color: "var(--f1-muted)" }}>CNPJ/CPF: {clientParty.document}</div>}
                            {clientParty.email && <div className="truncate" style={{ color: "var(--f1-muted)" }}>{clientParty.email}</div>}
                          </div>
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--f1-muted)" }}>Emitido por</div>
                            <div className="font-semibold">{agencyParty.legal_name || agencyParty.name || "Caritas Agência"}</div>
                            {agencyParty.document && <div style={{ color: "var(--f1-muted)" }}>CNPJ: {agencyParty.document}</div>}
                            {agencyParty.email && <div className="truncate" style={{ color: "var(--f1-muted)" }}>{agencyParty.email}</div>}
                          </div>
                        </div>

                        <div>
                          <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--f1-muted)" }}>Itens ({previewLines.length})</div>
                          <div className="rounded overflow-hidden" style={{ border: "1px solid var(--f1-border)" }}>
                            <div className="grid grid-cols-[1fr_110px_100px] gap-2 px-3 py-1 text-[9px] font-bold uppercase tracking-wider"
                              style={{ background: "var(--f1-bg)", color: "var(--f1-muted)" }}>
                              <div>Descrição</div><div>Data</div><div className="text-right">Total</div>
                            </div>
                            {previewLines.length === 0 && (
                              <div className="px-2 py-3 text-center" style={{ color: "var(--f1-muted)" }}>Nenhum item selecionado.</div>
                            )}
                            {previewLines.map((l) => (
                              <div key={l.key} className="grid grid-cols-[1fr_110px_100px] gap-2 px-3 py-1.5 items-center"
                                style={{ borderTop: "1px solid var(--f1-border)" }}>
                                <div className={cn("truncate", l.is_child && "pl-4")} style={l.is_child ? { color: "var(--f1-muted)" } : undefined}>
                                  {l.is_child && "↳ "}{l.title}
                                </div>
                                <input
                                  type="date"
                                  value={l.reference_date ?? ""}
                                  onChange={(e) => setLineDateOverrides(prev => ({ ...prev, [l.key]: e.target.value }))}
                                  className="h-6 px-1 text-[10px] rounded w-full"
                                  style={{ border: "1px solid var(--f1-border)" }}
                                  title="Data do item (editável)"
                                />
                                <div className="text-right font-semibold">{money(l.amount)}</div>
                              </div>
                            ))}
                            {discount > 0 && (
                              <div className="grid grid-cols-[1fr_110px_100px] gap-2 px-3 py-1.5" style={{ borderTop: "1px solid var(--f1-border)" }}>
                                <div className="col-span-2">Desconto concedido</div>
                                <div className="text-right font-semibold" style={{ color: "var(--f1-red)" }}>-{money(discount)}</div>
                              </div>
                            )}
                            {surcharge > 0 && (
                              <div className="grid grid-cols-[1fr_110px_100px] gap-2 px-3 py-1.5" style={{ borderTop: "1px solid var(--f1-border)" }}>
                                <div className="col-span-2">Acréscimo / taxa</div>
                                <div className="text-right font-semibold" style={{ color: "var(--f1-green)" }}>{money(surcharge)}</div>
                              </div>
                            )}
                            <div className="grid grid-cols-[1fr_110px_100px] gap-2 px-3 py-2"
                              style={{ borderTop: "1px solid var(--f1-border)", background: "var(--f1-soft)" }}>
                              <div className="col-span-2 text-right font-bold uppercase text-[10px] tracking-wider">Total a pagar</div>
                              <div className="text-right font-bold" style={{ color: "var(--f1-primary)" }}>{money(total)}</div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <div className="space-y-2">
                            <div>
                              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--f1-muted)" }}>Condições de pagamento</div>
                              <div className="text-[11px] leading-relaxed whitespace-pre-wrap">{paymentTerms || "—"}</div>
                            </div>
                            <div>
                              <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--f1-muted)" }}>Observações</div>
                              <div className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--f1-muted)" }}>{notes || "—"}</div>
                            </div>
                          </div>
                          <div className="rounded p-3 flex flex-col items-center justify-center text-center"
                            style={{ border: "1px dashed var(--f1-border)", background: "var(--f1-bg)" }}>
                            <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "var(--f1-muted)" }}>Pagamento</div>
                            {paymentLink.trim() ? (
                              <>
                                <div className="w-20 h-20 bg-white rounded flex items-center justify-center mb-2 overflow-hidden" style={{ border: "1px solid var(--f1-border)" }}>
                                  {paymentQrPreview
                                    ? <img src={paymentQrPreview} alt="QR Code de pagamento" className="h-full w-full object-contain" />
                                    : <span className="text-[8px] font-semibold" style={{ color: "var(--f1-primary)" }}>QR CODE</span>}
                                </div>
                                <div className="text-[10px] font-medium truncate max-w-full" style={{ color: "var(--f1-primary)" }}>{paymentLink.trim()}</div>
                              </>
                            ) : (
                              <div className="text-[10px] italic" style={{ color: "var(--f1-muted)" }}>
                                Anexe um link de pagamento para gerar o QR Code no PDF.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ------------------------------ Resumo lateral ------------------------------ */}
          <aside className="fat01-aside">
            <div className="fat01-sum-card">
              <div className="fat01-sum-head">Resumo da fatura</div>
              <div className="fat01-sum-body">
                <div className="fat01-sum-line"><span>Cliente</span><b className="truncate max-w-[150px]">{clientObj?.name ?? "—"}</b></div>
                <div className="fat01-sum-line"><span>Projetos</span><b>{selectedProjects.size || "Todos"}</b></div>
                <div className="fat01-sum-line"><span>Itens</span><b>{itemCount}</b></div>
                <div className="fat01-sum-line"><span>Emissão</span><b>{fmtDate(issueDate)}</b></div>
                <div className="fat01-sum-line"><span>Vencimento</span><b>{dueDate ? fmtDate(dueDate) : "—"}</b></div>
                <div className="fat01-sum-line"><span>Pagamento</span><b>{paymentMethods.join(", ") || "—"}</b></div>
                <div className="fat01-sum-div" />
                <div className="fat01-sum-line"><span>Subtotal</span><b>{money(subtotal)}</b></div>
                <div className="fat01-sum-line neg"><span>Desconto</span><b>{discount > 0 ? `-${money(discount)}` : money(0)}</b></div>
                <div className="fat01-sum-line pos"><span>Acréscimos</span><b>{money(surcharge)}</b></div>
                <div className="fat01-sum-div" />
                <div className="fat01-sum-total"><span>Total</span><b>{money(total)}</b></div>
              </div>
            </div>

            <div className="fat01-sum-number">
              <span>Número previsto</span><b>{previewNumber}</b>
            </div>

            <p className="fat01-hint" style={{ marginTop: 12 }}>
              A fatura é criada como <b>rascunho</b>. O número definitivo é gerado na confirmação e
              os lançamentos financeiros só aparecem depois disso.
            </p>
          </aside>
        </div>

        <DialogFooter className="fat01-foot sm:justify-start">
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-4 w-4 mr-1" />Voltar
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          {step === 3 && (
            <Button variant="outline" disabled={!canGoNext} onClick={openPreviewPDF}>
              <FileText className="h-4 w-4 mr-1" />Ver prévia do PDF
            </Button>
          )}
          {step < 3 && (
            <Button disabled={!canGoNext} onClick={() => setStep(step + 1)}>
              Continuar<ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button disabled={!canGoNext || submitting} onClick={submit}>
              {submitting ? "Emitindo..." : "Emitir fatura"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------- Detail ------------------------------ */
function InvoiceDetail({ id, clients, organization, onClose }: { id: string; clients: Client[]; organization: Organization | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editIssue, setEditIssue] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [returnItems, setReturnItems] = useState(true);
  const [removingItem, setRemovingItem] = useState<PendingCharge | null>(null);
  const [removeReturn, setRemoveReturn] = useState(true);

  const { data: invoice } = useQuery<Invoice | null>({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data } = await supabase.from("invoices")
        .select("id,number,client_id,project_id,status,issue_date,due_date,total,amount,paid_at,notes,payment_terms,payment_link,payment_method")
        .eq("id", id).maybeSingle();
      return (data ?? null) as Invoice | null;
    },
  });

  const { data: charges = [] } = useQuery<PendingCharge[]>({
    queryKey: ["invoice-charges", id],
    queryFn: async () => {
      const { data } = await supabase.from("charges")
        .select("id,description,amount,due_date,client_id,project_id,task_id,deliverable_id")
        .eq("invoice_id", id);
      return (data ?? []) as unknown as PendingCharge[];
    },
  });

  // Agrupa entregáveis logo abaixo da tarefa-pai correspondente
  const orderedCharges = useMemo(() => {
    const parents = charges.filter(c => !c.deliverable_id);
    const children = charges.filter(c => !!c.deliverable_id);
    const out: Array<PendingCharge & { isChild?: boolean }> = [];
    const used = new Set<string>();
    for (const p of parents) {
      out.push(p);
      for (const c of children) {
        if (c.task_id && c.task_id === p.task_id) { out.push({ ...c, isChild: true }); used.add(c.id); }
      }
    }
    for (const c of children) if (!used.has(c.id)) out.push(c);
    return out;
  }, [charges]);


  useEffect(() => {
    if (invoice && !editing) {
      setEditIssue(invoice.issue_date ?? "");
      setEditDue(invoice.due_date ?? "");
      setEditNotes(invoice.notes ?? "");
    }
  }, [invoice, editing]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["invoice", id] });
    qc.invalidateQueries({ queryKey: ["invoice-charges", id] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["charges"] });
  };

  const isLocked = invoice?.status === "paid" || invoice?.status === "canceled";

  const saveEdit = useMutation({
    mutationFn: async () => {
      const total = charges.reduce((a, c) => a + Number(c.amount ?? 0), 0);
      const { error } = await supabase.from("invoices")
        .update({
          issue_date: editIssue || undefined,
          due_date: editDue || null,
          notes: editNotes || null,
          amount: total,
          total,
          subtotal: total,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setEditing(false); toast.success("Fatura atualizada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmInvoice = useMutation({
    mutationFn: async () => {
      const { error: e1 } = await supabase.from("invoices").update({ status: "issued" }).eq("id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("charges")
        .update({ status: "pending" })
        .eq("invoice_id", id);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidateAll(); toast.success("Fatura confirmada — lançamentos financeiros gerados"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const { error: e1 } = await supabase.from("invoices").update({ status: "paid", paid_at: now }).eq("id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("charges").update({ status: "paid", paid_at: now }).eq("invoice_id", id);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidateAll(); toast.success("Fatura marcada como paga"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reopen = useMutation({
    mutationFn: async () => {
      const { error: e1 } = await supabase.from("invoices").update({ status: "issued", paid_at: null }).eq("id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("charges").update({ status: "pending", paid_at: null }).eq("invoice_id", id);
      if (e2) throw e2;
    },
    onSuccess: () => { invalidateAll(); toast.success("Fatura reaberta"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelInvoice = useMutation({
    mutationFn: async (opts: { returnItems: boolean }) => {
      const { error: e1 } = await supabase.from("invoices").update({ status: "canceled" }).eq("id", id);
      if (e1) throw e1;
      if (opts.returnItems) {
        const { error: e2 } = await supabase.from("charges")
          .update({ status: "pending_invoice", invoice_id: null })
          .eq("invoice_id", id);
        if (e2) throw e2;
      } else {
        // marca como canceladas
        const { error: e2 } = await supabase.from("charges").update({ status: "cancelled" }).eq("invoice_id", id);
        if (e2) throw e2;
      }
    },
    onSuccess: (_r, vars) => {
      invalidateAll();
      toast.success(vars.returnItems ? "Fatura cancelada. Itens voltaram para 'a faturar'." : "Fatura e itens cancelados.");
      setConfirmCancel(false);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteInvoice = useMutation({
    mutationFn: async (opts: { returnItems: boolean }) => {
      if (opts.returnItems) {
        const { error: e1 } = await supabase.from("charges")
          .update({ status: "pending_invoice", invoice_id: null })
          .eq("invoice_id", id);
        if (e1) throw e1;
      } else {
        const { error: e1 } = await supabase.from("charges").delete().eq("invoice_id", id);
        if (e1) throw e1;
      }
      const { error: e2 } = await supabase.from("invoices").delete().eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: (_r, vars) => {
      invalidateAll();
      toast.success(vars.returnItems ? "Fatura excluída. Itens voltaram para 'a faturar'." : "Fatura e itens excluídos.");
      setConfirmDelete(false);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (opts: { chargeId: string; returnItem: boolean }) => {
      if (opts.returnItem) {
        const { error } = await supabase.from("charges")
          .update({ status: "pending_invoice", invoice_id: null })
          .eq("id", opts.chargeId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("charges").delete().eq("id", opts.chargeId);
        if (error) throw error;
      }
      // recalcula total
      const { data: remaining } = await supabase.from("charges").select("amount").eq("invoice_id", id);
      const total = (remaining ?? []).reduce((a, c) => a + Number(c.amount ?? 0), 0);
      await supabase.from("invoices").update({ amount: total, total, subtotal: total }).eq("id", id);
    },
    onSuccess: (_r, vars) => {
      invalidateAll();
      toast.success(vars.returnItem ? "Item removido e devolvido para 'a faturar'." : "Item removido da fatura.");
      setRemovingItem(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function downloadPDF() {
    if (!invoice) return;
    const client = clients.find(c => c.id === invoice.client_id);
    const projectIds = Array.from(new Set(orderedCharges.map(c => c.project_id).filter(Boolean))) as string[];
    const nameById = new Map<string, string>();
    if (projectIds.length) {
      const { data: projs } = await supabase.from("projects").select("id,name").in("id", projectIds);
      for (const p of projs ?? []) nameById.set(p.id as string, p.name as string);
    }
    // agrupa as linhas por projeto mantendo a ordem
    const order: string[] = [];
    const buckets = new Map<string, typeof orderedCharges>();
    for (const c of orderedCharges) {
      const g = c.project_id ? nameById.get(c.project_id) ?? "" : "";
      if (!buckets.has(g)) { buckets.set(g, []); order.push(g); }
      buckets.get(g)!.push(c);
    }
    const grouped = order.flatMap(g => buckets.get(g)!.map(c => ({ ...c, groupName: g })));

    const doc = await generateInvoicePDF({
      number: invoice.number,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      client: buildClientParty(client),
      agency: buildAgencyParty(organization),
      lines: grouped.map(c => ({
        title: c.description,
        amount: Number(c.amount ?? 0),
        is_child: !!c.isChild,
        reference_date: c.due_date ?? null,
        reference_label: "Prazo",
        group: c.groupName || null,
      })),
      notes: invoice.notes ?? undefined,
      payment_terms: invoice.payment_terms ?? undefined,
      payment_link: invoice.payment_link ?? undefined,
    });
    doc.save(`Fatura-${invoice.number}.pdf`);
  }

  if (!invoice) return null;
  const total = Number(invoice.total ?? invoice.amount ?? 0);
  const meta = STATUS_META[invoice.status] ?? STATUS_META.pending;

  return (
    <>
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText className="h-5 w-5" />
            Fatura {invoice.number}
            <Badge variant="secondary" className={cn("text-[10px]", meta.className)}>{meta.label}</Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            Número gerado automaticamente no formato <span className="font-mono">AAAAMM + sequencial</span> (ex.: 202605140).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />
            <span>{clients.find(c => c.id === invoice.client_id)?.name ?? "—"}</span>
          </div>
          {!editing ? (
            <div className="text-right">
              <span className="text-muted-foreground text-xs">Emissão </span>{fmtDate(invoice.issue_date)}
              <span className="text-muted-foreground text-xs ml-3">Vencimento </span>{fmtDate(invoice.due_date)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">Emissão</label>
                <Input type="date" value={editIssue} onChange={e => setEditIssue(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Vencimento</label>
                <Input type="date" value={editDue} onChange={e => setEditDue(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="max-h-[45vh] overflow-y-auto">
            {orderedCharges.map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2 border-b last:border-b-0 text-sm gap-2">
                <div className={cn("flex-1 min-w-0 truncate", c.isChild && "pl-5 text-muted-foreground")}>{c.isChild && "↳ "}{c.description}</div>
                <div className="font-medium">{money(Number(c.amount ?? 0))}</div>
                {editing && !isLocked && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600"
                    onClick={() => { setRemovingItem(c); setRemoveReturn(true); }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {charges.length === 0 && <p className="text-xs text-muted-foreground p-4">Sem itens.</p>}
          </div>
          <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-t">
            <span className="text-sm text-muted-foreground">{charges.length} item(ns)</span>
            <span className="text-lg font-semibold">{money(total)}</span>
          </div>
        </Card>

        {editing ? (
          <div>
            <label className="text-xs font-medium text-muted-foreground">Observações</label>
            <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} />
          </div>
        ) : invoice.notes && (
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
        )}

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="ghost" onClick={downloadPDF}><Download className="h-4 w-4 mr-1" />PDF</Button>

          {!isLocked && !editing && (
            <Button variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-4 w-4 mr-1" />Editar</Button>
          )}
          {editing && (
            <>
              <Button variant="ghost" onClick={() => setEditing(false)}>Descartar</Button>
              <Button onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending}>
                <Save className="h-4 w-4 mr-1" />Salvar
              </Button>
            </>
          )}

          <Button variant="ghost" className="text-red-600 hover:text-red-700"
            onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4 mr-1" />Excluir
          </Button>

          <div className="flex-1" />

          {invoice.status === "paid" && (
            <Button variant="ghost" onClick={() => reopen.mutate()} disabled={reopen.isPending}>
              <RotateCcw className="h-4 w-4 mr-1" />Reabrir
            </Button>
          )}
          {!isLocked && !editing && invoice.status === "draft" && (
            <>
              <Button variant="ghost" onClick={() => setConfirmCancel(true)}>
                <XCircle className="h-4 w-4 mr-1" />Cancelar fatura
              </Button>
              <Button onClick={() => confirmInvoice.mutate()} disabled={confirmInvoice.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-1" />Confirmar fatura
              </Button>
            </>
          )}
          {!isLocked && !editing && invoice.status !== "draft" && (
            <>
              <Button variant="ghost" onClick={() => setConfirmCancel(true)}>
                <XCircle className="h-4 w-4 mr-1" />Cancelar fatura
              </Button>
              <Button onClick={() => markPaid.mutate()} disabled={markPaid.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-1" />Marcar como paga
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Confirmação de cancelamento */}
    <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar esta fatura?</AlertDialogTitle>
          <AlertDialogDescription>
            A fatura ficará marcada como <strong>cancelada</strong>. Escolha o que fazer com os {charges.length} item(ns) faturado(s):
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <label className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/40">
            <input type="radio" checked={returnItems} onChange={() => setReturnItems(true)} className="mt-1" />
            <div>
              <div className="text-sm font-medium">Voltar itens para "a faturar"</div>
              <div className="text-xs text-muted-foreground">Você poderá incluí-los em outra fatura depois.</div>
            </div>
          </label>
          <label className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/40">
            <input type="radio" checked={!returnItems} onChange={() => setReturnItems(false)} className="mt-1" />
            <div>
              <div className="text-sm font-medium">Cancelar itens também</div>
              <div className="text-xs text-muted-foreground">Nenhum item volta para o fluxo de faturamento.</div>
            </div>
          </label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction onClick={() => cancelInvoice.mutate({ returnItems })}>Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Confirmação de exclusão */}
    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir esta fatura?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação é <strong>permanente</strong>. O que fazer com os {charges.length} item(ns)?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <label className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/40">
            <input type="radio" checked={returnItems} onChange={() => setReturnItems(true)} className="mt-1" />
            <div>
              <div className="text-sm font-medium">Voltar itens para "a faturar"</div>
              <div className="text-xs text-muted-foreground">Recomendado — preserva o histórico das tarefas/cobranças.</div>
            </div>
          </label>
          <label className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/40">
            <input type="radio" checked={!returnItems} onChange={() => setReturnItems(false)} className="mt-1" />
            <div>
              <div className="text-sm font-medium">Excluir os itens também</div>
              <div className="text-xs text-muted-foreground">As cobranças serão apagadas junto com a fatura.</div>
            </div>
          </label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700"
            onClick={() => deleteInvoice.mutate({ returnItems })}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Remover item */}
    <AlertDialog open={!!removingItem} onOpenChange={(v) => !v && setRemovingItem(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover item da fatura?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block truncate">{removingItem?.description}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 py-2">
          <label className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/40">
            <input type="radio" checked={removeReturn} onChange={() => setRemoveReturn(true)} className="mt-1" />
            <div>
              <div className="text-sm font-medium">Voltar para "a faturar"</div>
              <div className="text-xs text-muted-foreground">Fica disponível para outra fatura.</div>
            </div>
          </label>
          <label className="flex items-start gap-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/40">
            <input type="radio" checked={!removeReturn} onChange={() => setRemoveReturn(false)} className="mt-1" />
            <div>
              <div className="text-sm font-medium">Excluir o item</div>
              <div className="text-xs text-muted-foreground">A cobrança será apagada de vez.</div>
            </div>
          </label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => removingItem && removeItem.mutate({ chargeId: removingItem.id, returnItem: removeReturn })}>
            Confirmar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

