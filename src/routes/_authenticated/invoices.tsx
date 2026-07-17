import { createFileRoute, useSearch } from "@tanstack/react-router";
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
import { generateInvoicePDF, DEFAULT_PAYMENT_TERMS, DEFAULT_LEGAL_NOTES } from "@/lib/pdf/invoice-pdf";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/invoices")({
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
type Client = { id: string; name: string; tax_id?: string | null; email?: string | null };
type Project = { id: string; name: string; client_id: string | null };
type PendingCharge = {
  id: string; description: string; amount: number; due_date: string;
  client_id: string | null; project_id: string | null; task_id: string | null;
};
type Deliverable = {
  id: string; platform?: string | null; type?: string | null; channel?: string | null;
  billing_enabled?: boolean; billing_value?: number | null;
  delivered?: boolean; invoiced?: boolean;
};
type BillableTask = {
  id: string; title: string; billing_value: number | null; billing_enabled: boolean;
  client_id: string | null; project_id: string | null; status: string | null;
  deliverables?: Deliverable[] | null;
};
type BillableDeliverable = {
  key: string; // taskId::deliverableId
  taskId: string; deliverableId: string; taskTitle: string;
  label: string; amount: number;
  client_id: string | null; project_id: string | null;
};

const STATUS_META: Record<InvoiceStatus, { label: string; className: string }> = {
  draft:    { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  issued:   { label: "Emitida",  className: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  pending:  { label: "Emitida",  className: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  paid:     { label: "Paga",     className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  canceled: { label: "Cancelada",className: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

function InvoicesPage() {
  const qc = useQueryClient();
  const search = useSearch({ from: "/_authenticated/invoices" });
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
        .select("id,number,client_id,project_id,status,issue_date,due_date,total,amount,paid_at,notes,payment_terms,payment_link")
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Invoice[];
    },
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-basic"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id,name,tax_id,email").order("name");
      return (data ?? []) as Client[];
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
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Receipt className="h-6 w-6" />Faturas</h1>
          <p className="text-sm text-muted-foreground">Agrupe cobranças e tarefas em uma fatura única.</p>
        </div>
        <Button onClick={() => setWizardOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova fatura</Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-[110px_1fr_1fr_120px_120px_120px_80px] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/40 border-b">
          <div>Número</div><div>Cliente</div><div>Projeto</div>
          <div>Emissão</div><div>Vencimento</div><div className="text-right">Total</div><div className="text-right">Status</div>
        </div>
        {invoices.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma fatura ainda. Clique em <strong>Nova fatura</strong>.</div>
        )}
        {invoices.map(inv => {
          const total = Number(inv.total ?? inv.amount ?? 0);
          const meta = STATUS_META[inv.status] ?? STATUS_META.pending;
          return (
            <button
              key={inv.id}
              onClick={() => setDetailId(inv.id)}
              className="w-full grid grid-cols-[110px_1fr_1fr_120px_120px_120px_80px] gap-3 px-4 py-3 text-sm items-center hover:bg-muted/40 border-b last:border-b-0 text-left"
            >
              <div className="font-mono text-xs">{inv.number}</div>
              <div className="truncate">{inv.client_id ? clientById[inv.client_id]?.name ?? "—" : "—"}</div>
              <div className="truncate text-muted-foreground">{inv.project_id ? projectById[inv.project_id]?.name ?? "—" : "Múltiplos"}</div>
              <div className="text-xs text-muted-foreground">{fmtDate(inv.issue_date)}</div>
              <div className="text-xs text-muted-foreground">{fmtDate(inv.due_date)}</div>
              <div className="text-right font-medium">{money(total)}</div>
              <div className="text-right"><Badge variant="secondary" className={cn("text-[10px]", meta.className)}>{meta.label}</Badge></div>
            </button>
          );
        })}
      </Card>

      {wizardOpen && (
        <NewInvoiceWizard
          initialProjectId={search.projectId}
          clients={clients}
          projects={projects}
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
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

/* ----------------------------------- Wizard ------------------------------ */
function NewInvoiceWizard({
  initialProjectId, clients, projects, onClose, onCreated,
}: {
  initialProjectId?: string;
  clients: Client[]; projects: Project[];
  onClose: () => void; onCreated: (id: string) => void;
}) {
  const initialClient = initialProjectId ? projects.find(p => p.id === initialProjectId)?.client_id ?? "" : "";
  const [step, setStep] = useState(1);
  const [filterClient, setFilterClient] = useState<string>(initialClient);
  const [filterProject, setFilterProject] = useState<string>(initialProjectId ?? "");
  const [selectedCharges, setSelectedCharges] = useState<Set<string>>(new Set());
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [payerClient, setPayerClient] = useState<string>(initialClient);
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState(DEFAULT_LEGAL_NOTES);
  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_PAYMENT_TERMS);
  const [paymentLink, setPaymentLink] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [selectedDeliverables, setSelectedDeliverables] = useState<Set<string>>(new Set());

  // Sincroniza o cliente pagador com o filtro (ou com o cliente do projeto filtrado)
  useEffect(() => {
    const derived = filterClient
      || (filterProject ? projects.find(p => p.id === filterProject)?.client_id ?? "" : "");
    if (derived && derived !== payerClient) setPayerClient(derived);
  }, [filterClient, filterProject, projects, payerClient]);

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
        .select("id,title,billing_value,billing_enabled,client_id,project_id,status,deliverables")
        .eq("billing_enabled", true);
      const ts = (data ?? []) as BillableTask[];
      // Cobranças já existentes (main sem deliverable_id, e por entregável)
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
    (!filterClient || c.client_id === filterClient) &&
    (!filterProject || c.project_id === filterProject),
  ), [charges, filterClient, filterProject]);

  const filteredTasks = useMemo(() => tasks.filter(t =>
    !invoicedMainTaskIds.has(t.id) &&
    (!filterClient || t.client_id === filterClient) &&
    (!filterProject || t.project_id === filterProject) &&
    (t.billing_value ?? 0) > 0,
  ), [tasks, invoicedMainTaskIds, filterClient, filterProject]);

  const billableDeliverables = useMemo<BillableDeliverable[]>(() => {
    const out: BillableDeliverable[] = [];
    for (const t of tasks) {
      if (filterClient && t.client_id !== filterClient) continue;
      if (filterProject && t.project_id !== filterProject) continue;
      const list = Array.isArray(t.deliverables) ? t.deliverables : [];
      for (const d of list) {
        if (!d?.id) continue;
        if (!d.delivered) continue;
        if (!d.billing_enabled) continue;
        const amount = Number(d.billing_value ?? 0);
        if (amount <= 0) continue;
        if (d.invoiced) continue;
        if (invoicedDeliverableIds.has(d.id)) continue;
        const parts = [d.platform, d.channel, d.type].filter(Boolean).join(" • ");
        out.push({
          key: `${t.id}::${d.id}`,
          taskId: t.id,
          deliverableId: d.id,
          taskTitle: t.title,
          label: `Entregável: ${t.title}${parts ? ` — ${parts}` : ""}`,
          amount,
          client_id: t.client_id,
          project_id: t.project_id,
        });
      }
    }
    return out;
  }, [tasks, invoicedDeliverableIds, filterClient, filterProject]);

  const total = useMemo(() => {
    let t = 0;
    for (const c of filteredCharges) if (selectedCharges.has(c.id)) t += Number(c.amount ?? 0);
    for (const tk of filteredTasks) if (selectedTasks.has(tk.id)) t += Number(tk.billing_value ?? 0);
    for (const d of billableDeliverables) if (selectedDeliverables.has(d.key)) t += d.amount;
    return t;
  }, [filteredCharges, filteredTasks, billableDeliverables, selectedCharges, selectedTasks, selectedDeliverables]);

  const canGoNext = step === 1
    ? true
    : step === 2 ? (selectedCharges.size + selectedTasks.size + selectedDeliverables.size) > 0
    : !!payerClient && !!issueDate;

  const previewLines = useMemo(() => {
    const lines: { title: string; detail?: string; amount: number; is_child?: boolean }[] = [];
    for (const c of filteredCharges) if (selectedCharges.has(c.id)) {
      lines.push({ title: c.description || "Cobrança", amount: Number(c.amount ?? 0) });
    }
    for (const tk of filteredTasks) if (selectedTasks.has(tk.id)) {
      lines.push({ title: tk.title, amount: Number(tk.billing_value ?? 0) });
      // entregáveis selecionados desta tarefa (indentados)
      for (const d of billableDeliverables) {
        if (d.taskId === tk.id && selectedDeliverables.has(d.key)) {
          lines.push({ title: d.label, amount: d.amount, is_child: true });
        }
      }
    }
    // entregáveis órfãos (tarefa não selecionada, mas o entregável foi)
    const includedTaskIds = new Set(Array.from(selectedTasks));
    for (const d of billableDeliverables) {
      if (selectedDeliverables.has(d.key) && !includedTaskIds.has(d.taskId)) {
        lines.push({ title: d.label, amount: d.amount });
      }
    }
    return lines;
  }, [filteredCharges, filteredTasks, billableDeliverables, selectedCharges, selectedTasks, selectedDeliverables]);

  function openPreviewPDF() {
    const client = clients.find(c => c.id === payerClient);
    const doc = generateInvoicePDF({
      number: "PRÉVIA",
      issue_date: issueDate || new Date().toISOString().slice(0, 10),
      due_date: dueDate || null,
      client: { name: client?.name ?? "—", document: client?.tax_id, email: client?.email },
      lines: previewLines,
      notes: notes || undefined,
    });
    const url = doc.output("bloburl") as unknown as string;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function submit() {
    setSubmitting(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");

      // Cria as charges para as tarefas escolhidas (ainda sem invoice_id — vamos linkar depois)
      const newCharges: string[] = [];
      for (const tk of filteredTasks) {
        if (!selectedTasks.has(tk.id)) continue;
        const { data: inserted, error } = await supabase.from("charges").insert({
          organization_id: profile.organization_id,
          project_id: tk.project_id,
          task_id: tk.id,
          client_id: tk.client_id,
          description: `Tarefa: ${tk.title}`,
          amount: Number(tk.billing_value ?? 0),
          status: "pending_invoice",
          due_date: dueDate || issueDate,
          type: "income",
        }).select("id").single();
        if (error) throw error;
        if (inserted) newCharges.push(inserted.id);
      }

      // Cria charges para os entregáveis selecionados e marca invoiced=true na tarefa
      const deliverablesByTask = new Map<string, Set<string>>();
      for (const d of billableDeliverables) {
        if (!selectedDeliverables.has(d.key)) continue;
        const { data: inserted, error } = await supabase.from("charges").insert({
          organization_id: profile.organization_id,
          project_id: d.project_id,
          task_id: d.taskId,
          deliverable_id: d.deliverableId,
          client_id: d.client_id,
          description: d.label,
          amount: d.amount,
          status: "pending_invoice",
          due_date: dueDate || issueDate,
          type: "income",
        } as never).select("id").single();
        if (error) throw error;
        if (inserted) newCharges.push(inserted.id);
        if (!deliverablesByTask.has(d.taskId)) deliverablesByTask.set(d.taskId, new Set());
        deliverablesByTask.get(d.taskId)!.add(d.deliverableId);
      }
      // Marcar deliverables como invoiced na coluna JSONB da task
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
      const clientIds = new Set<string>();
      for (const c of filteredCharges) if (selectedCharges.has(c.id)) {
        if (c.project_id) projectIds.add(c.project_id);
        if (c.client_id) clientIds.add(c.client_id);
      }
      for (const tk of filteredTasks) if (selectedTasks.has(tk.id)) {
        if (tk.project_id) projectIds.add(tk.project_id);
        if (tk.client_id) clientIds.add(tk.client_id);
      }
      for (const d of billableDeliverables) if (selectedDeliverables.has(d.key)) {
        if (d.project_id) projectIds.add(d.project_id);
        if (d.client_id) clientIds.add(d.client_id);
      }
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
        subtotal: total,
        status: "issued",
        notes: notes || null,
      }).select("id").single();
      if (invErr) throw invErr;

      const { error: linkErr } = await supabase.from("charges")
        .update({ invoice_id: invoice.id, status: "pending" })
        .in("id", chargeIds);
      if (linkErr) throw linkErr;

      toast.success("Fatura emitida");
      onCreated(invoice.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const stepLabel = ["Filtros", "Itens", "Confirmação"];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Nova fatura</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs mb-2">
          {stepLabel.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={cn("grid place-items-center h-6 w-6 rounded-full font-medium",
                step === i + 1 ? "bg-primary text-primary-foreground" : step > i + 1 ? "bg-emerald-500 text-white" : "bg-muted")}>{i + 1}</div>
              <span className={cn(step === i + 1 && "font-medium")}>{label}</span>
              {i < 2 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cliente (opcional)</label>
              <Select value={filterClient || "all"} onValueChange={(v) => { setFilterClient(v === "all" ? "" : v); setFilterProject(""); }}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Projeto (opcional)</label>
              <Select value={filterProject || "all"} onValueChange={(v) => setFilterProject(v === "all" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os projetos</SelectItem>
                  {projects.filter(p => !filterClient || p.client_id === filterClient).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Deixe em branco para ver tudo pendente na próxima etapa. Você pode misturar clientes e projetos.</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <section>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Cobranças pendentes</h3>
              {filteredCharges.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhuma cobrança pendente.</p>}
              <div className="space-y-1">
                {filteredCharges.map(c => (
                  <label key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border hover:bg-muted/40 cursor-pointer">
                    <Checkbox
                      checked={selectedCharges.has(c.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(selectedCharges);
                        v ? next.add(c.id) : next.delete(c.id);
                        setSelectedCharges(next);
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{c.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {c.client_id ? clients.find(cl => cl.id === c.client_id)?.name : "—"}
                        {c.project_id && ` • ${projects.find(p => p.id === c.project_id)?.name ?? ""}`}
                        {c.due_date && ` • ${fmtDate(c.due_date)}`}
                      </p>
                    </div>
                    <div className="text-sm font-medium">{money(Number(c.amount ?? 0))}</div>
                  </label>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Tarefas prontas para faturar</h3>
              {filteredTasks.length === 0 && billableDeliverables.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">Nenhuma tarefa faturável sem cobrança principal. Ative "Faturamento" na tarefa e defina um valor.</p>
              )}
              <div className="space-y-2">
                {(() => {
                  const delivsByTask = new Map<string, BillableDeliverable[]>();
                  for (const d of billableDeliverables) {
                    if (!delivsByTask.has(d.taskId)) delivsByTask.set(d.taskId, []);
                    delivsByTask.get(d.taskId)!.push(d);
                  }
                  const shownTaskIds = new Set(filteredTasks.map(t => t.id));

                  const renderDelivs = (list: BillableDeliverable[]) => list.map(d => (
                    <label key={d.key} className="flex items-center gap-3 px-3 py-1.5 rounded-md border border-dashed hover:bg-muted/40 cursor-pointer ml-6">
                      <Checkbox
                        checked={selectedDeliverables.has(d.key)}
                        onCheckedChange={(v) => {
                          const next = new Set(selectedDeliverables);
                          v ? next.add(d.key) : next.delete(d.key);
                          setSelectedDeliverables(next);
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate flex items-center gap-2">
                          <span className="text-muted-foreground">↳</span>
                          {d.label.replace(/^Entregável:\s*[^—]+—?\s*/, "") || "Entregável"}
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-emerald-500/15 text-emerald-600">Entregue</span>
                        </p>
                      </div>
                      <div className="text-sm font-medium">{money(d.amount)}</div>
                    </label>
                  ));

                  return (
                    <>
                      {filteredTasks.map(t => {
                        const done = t.status === "done";
                        const taskDelivs = delivsByTask.get(t.id) ?? [];
                        return (
                          <div key={t.id} className="space-y-1">
                            <label className="flex items-center gap-3 px-3 py-2 rounded-lg border hover:bg-muted/40 cursor-pointer">
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
                                <p className="text-sm truncate flex items-center gap-2">
                                  Tarefa: {t.title}
                                  <span className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                                    done ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"
                                  )}>
                                    {done ? "Concluída" : "Em andamento"}
                                  </span>
                                  {taskDelivs.length > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                                      +{taskDelivs.length} entregável{taskDelivs.length > 1 ? "eis" : ""}
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {t.client_id ? clients.find(cl => cl.id === t.client_id)?.name : "—"}
                                  {t.project_id && ` • ${projects.find(p => p.id === t.project_id)?.name ?? ""}`}
                                </p>
                              </div>
                              <div className="text-sm font-medium">{money(Number(t.billing_value ?? 0))}</div>
                            </label>
                            {renderDelivs(taskDelivs)}
                          </div>
                        );
                      })}

                      {/* Entregáveis de tarefas cujo valor principal já foi faturado */}
                      {Array.from(delivsByTask.entries())
                        .filter(([taskId]) => !shownTaskIds.has(taskId))
                        .map(([taskId, list]) => (
                          <div key={taskId} className="space-y-1">
                            <div className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-muted/20">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate flex items-center gap-2 text-muted-foreground">
                                  Tarefa: {list[0].taskTitle}
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">Principal já faturado</span>
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {list[0].client_id ? clients.find(cl => cl.id === list[0].client_id)?.name : "—"}
                                  {list[0].project_id && ` • ${projects.find(p => p.id === list[0].project_id)?.name ?? ""}`}
                                </p>
                              </div>
                            </div>
                            {renderDelivs(list)}
                          </div>
                        ))}
                    </>
                  );
                })()}
              </div>
            </section>


            <div className="sticky bottom-0 bg-background pt-3 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selectedCharges.size + selectedTasks.size + selectedDeliverables.size} item(ns) selecionado(s)
              </span>
              <span className="text-lg font-semibold">Total: {money(total)}</span>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cliente pagador *</label>
              <Select value={payerClient} onValueChange={setPayerClient}>
                <SelectTrigger><SelectValue placeholder="Escolha o cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Emissão</label>
                <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Vencimento</label>
                <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Observações</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Condições de pagamento, notas fiscais, etc." rows={3} />
            </div>
            <div className="rounded-lg border p-3 bg-muted/30 flex items-center justify-between">
              <span className="text-sm">{selectedCharges.size + selectedTasks.size + selectedDeliverables.size} item(ns)</span>
              <span className="text-lg font-semibold">{money(total)}</span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && <Button variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>}
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          {step === 3 && <Button variant="outline" disabled={!canGoNext} onClick={openPreviewPDF}><FileText className="h-4 w-4 mr-1" />Ver prévia do PDF</Button>}
          {step < 3 && <Button disabled={!canGoNext} onClick={() => setStep(step + 1)}>Avançar<ArrowRight className="h-4 w-4 ml-1" /></Button>}
          {step === 3 && <Button disabled={!canGoNext || submitting} onClick={submit}>{submitting ? "Emitindo..." : "Emitir fatura"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------------------------- Detail ------------------------------ */
function InvoiceDetail({ id, clients, onClose }: { id: string; clients: Client[]; onClose: () => void }) {
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
        .select("id,number,client_id,project_id,status,issue_date,due_date,total,amount,paid_at,notes,payment_terms,payment_link")
        .eq("id", id).maybeSingle();
      return (data ?? null) as Invoice | null;
    },
  });

  const { data: charges = [] } = useQuery<PendingCharge[]>({
    queryKey: ["invoice-charges", id],
    queryFn: async () => {
      const { data } = await supabase.from("charges")
        .select("id,description,amount,due_date,client_id,project_id,task_id")
        .eq("invoice_id", id);
      return (data ?? []) as unknown as PendingCharge[];
    },
  });

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

  function downloadPDF() {
    if (!invoice) return;
    const client = clients.find(c => c.id === invoice.client_id);
    const doc = generateInvoicePDF({
      number: invoice.number,
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      client: { name: client?.name ?? "—", document: client?.tax_id, email: client?.email },
      lines: charges.map(c => ({ title: c.description, amount: Number(c.amount ?? 0) })),
      notes: invoice.notes ?? undefined,
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
            Número gerado automaticamente no formato <span className="font-mono">AAAAMM-####</span> (sequencial por mês).
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
            {charges.map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2 border-b last:border-b-0 text-sm gap-2">
                <div className="flex-1 min-w-0 truncate">{c.description}</div>
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
          {!isLocked && !editing && (
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

