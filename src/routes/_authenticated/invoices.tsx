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
import { generateInvoicePDF } from "@/lib/pdf/invoice-pdf";
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
};
type Client = { id: string; name: string; tax_id?: string | null; email?: string | null };
type Project = { id: string; name: string; client_id: string | null };
type PendingCharge = {
  id: string; description: string; amount: number; due_date: string;
  client_id: string | null; project_id: string | null; task_id: string | null;
};
type BillableTask = {
  id: string; title: string; billing_value: number | null; billing_enabled: boolean;
  client_id: string | null; project_id: string | null; status: string | null;
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
        .select("id,number,client_id,project_id,status,issue_date,due_date,total,amount,paid_at,notes")
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
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const { data: tasks = [] } = useQuery<BillableTask[]>({
    queryKey: ["invoices-billable-tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id,title,billing_value,billing_enabled,client_id,project_id,status")
        .eq("billing_enabled", true);
      const ts = (data ?? []) as BillableTask[];
      // Só ocultamos tarefas cujo valor principal (charge sem deliverable_id) já foi faturado.
      // Cobranças de entregáveis não bloqueiam — permitem faturar o principal antes e entregáveis depois (e vice-versa).
      const { data: mainCharges } = await supabase
        .from("charges")
        .select("task_id")
        .not("task_id", "is", null)
        .is("deliverable_id", null);
      const set = new Set((mainCharges ?? []).map(r => r.task_id as string));
      return ts.filter(t => !set.has(t.id));
    },
  });

  const filteredCharges = useMemo(() => charges.filter(c =>
    (!filterClient || c.client_id === filterClient) &&
    (!filterProject || c.project_id === filterProject),
  ), [charges, filterClient, filterProject]);

  const filteredTasks = useMemo(() => tasks.filter(t =>
    (!filterClient || t.client_id === filterClient) &&
    (!filterProject || t.project_id === filterProject) &&
    (t.billing_value ?? 0) > 0,
  ), [tasks, filterClient, filterProject]);

  const total = useMemo(() => {
    let t = 0;
    for (const c of filteredCharges) if (selectedCharges.has(c.id)) t += Number(c.amount ?? 0);
    for (const tk of filteredTasks) if (selectedTasks.has(tk.id)) t += Number(tk.billing_value ?? 0);
    return t;
  }, [filteredCharges, filteredTasks, selectedCharges, selectedTasks]);

  const canGoNext = step === 1
    ? true
    : step === 2 ? (selectedCharges.size + selectedTasks.size) > 0
    : !!payerClient && !!issueDate;

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
              {filteredTasks.length === 0 && <p className="text-xs text-muted-foreground py-2">Nenhuma tarefa faturável sem cobrança principal. Ative "Faturamento" na tarefa e defina um valor.</p>}
              <div className="space-y-1">
                {filteredTasks.map(t => {
                  const done = t.status === "done";
                  return (
                  <label key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border hover:bg-muted/40 cursor-pointer">
                    <Checkbox
                      checked={selectedTasks.has(t.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(selectedTasks);
                        v ? next.add(t.id) : next.delete(t.id);
                        setSelectedTasks(next);
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
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.client_id ? clients.find(cl => cl.id === t.client_id)?.name : "—"}
                        {t.project_id && ` • ${projects.find(p => p.id === t.project_id)?.name ?? ""}`}
                      </p>
                    </div>
                    <div className="text-sm font-medium">{money(Number(t.billing_value ?? 0))}</div>
                  </label>
                  );
                })}
              </div>
            </section>

            <div className="sticky bottom-0 bg-background pt-3 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selectedCharges.size + selectedTasks.size} item(ns) selecionado(s)
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
              <span className="text-sm">{selectedCharges.size + selectedTasks.size} item(ns)</span>
              <span className="text-lg font-semibold">{money(total)}</span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && <Button variant="ghost" onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>}
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
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

  const { data: invoice } = useQuery<Invoice | null>({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data } = await supabase.from("invoices")
        .select("id,number,client_id,project_id,status,issue_date,due_date,total,amount,paid_at,notes")
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

  const markPaid = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const { error: e1 } = await supabase.from("invoices").update({ status: "paid", paid_at: now }).eq("id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("charges").update({ status: "paid", paid_at: now }).eq("invoice_id", id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["charges"] });
      toast.success("Fatura marcada como paga");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      const { error: e1 } = await supabase.from("invoices").update({ status: "canceled" }).eq("id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("charges").update({ status: "pending_invoice", invoice_id: null }).eq("invoice_id", id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["charges"] });
      toast.success("Fatura cancelada. Itens voltaram para pendentes.");
      onClose();
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
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText className="h-5 w-5" />
            Fatura {invoice.number}
            <Badge variant="secondary" className={cn("text-[10px]", meta.className)}>{meta.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />
            <span>{clients.find(c => c.id === invoice.client_id)?.name ?? "—"}</span>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground text-xs">Emissão </span>{fmtDate(invoice.issue_date)}
            <span className="text-muted-foreground text-xs ml-3">Vencimento </span>{fmtDate(invoice.due_date)}
          </div>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="max-h-[45vh] overflow-y-auto">
            {charges.map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2 border-b last:border-b-0 text-sm">
                <div className="flex-1 min-w-0 truncate">{c.description}</div>
                <div className="font-medium">{money(Number(c.amount ?? 0))}</div>
              </div>
            ))}
            {charges.length === 0 && <p className="text-xs text-muted-foreground p-4">Sem itens.</p>}
          </div>
          <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-t">
            <span className="text-sm text-muted-foreground">{charges.length} item(ns)</span>
            <span className="text-lg font-semibold">{money(total)}</span>
          </div>
        </Card>

        {invoice.notes && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={downloadPDF}><Download className="h-4 w-4 mr-1" />PDF</Button>
          <div className="flex-1" />
          {invoice.status !== "canceled" && invoice.status !== "paid" && (
            <>
              <Button variant="ghost" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                <XCircle className="h-4 w-4 mr-1" />Cancelar fatura
              </Button>
              <Button onClick={() => markPaid.mutate()} disabled={markPaid.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-1" />Marcar como paga
              </Button>
            </>
          )}
          {(invoice.status === "canceled" || invoice.status === "paid") && (
            <Button onClick={onClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
