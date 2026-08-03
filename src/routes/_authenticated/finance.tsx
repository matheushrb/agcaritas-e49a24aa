import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EntityDialog, DialogField, DialogCancelButton } from "@/components/entity-dialog";
import { Button as UIButton } from "@/components/ui/button";
import { DollarSign, Plus, TrendingUp, TrendingDown, Wallet, AlertCircle, CheckCircle2, Clock, Receipt, Download } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generateInvoicePDF } from "@/lib/pdf/invoice-pdf";

export const Route = createFileRoute("/_authenticated/finance")({
  validateSearch: (s: Record<string, unknown>) => ({
    new: s.new === 1 || s.new === "1" ? 1 : undefined,
  }),
  component: FinancePage,
});

type ChargeStatus = "pending" | "paid" | "overdue" | "cancelled" | "pending_invoice" | "draft";
type Charge = {
  id: string;
  description: string | null;
  amount: number;
  status: ChargeStatus;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  client_id: string | null;
  project_id: string | null;
  created_at: string;
};
type Client = { id: string; name: string };
type Project = { id: string; name: string };

const STATUS_META: Record<ChargeStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending:         { label: "Pendente",           color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  pending_invoice: { label: "A faturar",          color: "bg-blue-500/15 text-blue-600 dark:text-blue-400",    icon: Receipt },
  paid:            { label: "Pago",               color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
  overdue:         { label: "Atrasado",           color: "bg-red-500/15 text-red-600 dark:text-red-400",       icon: AlertCircle },
  cancelled:       { label: "Cancelado",          color: "bg-muted text-muted-foreground",                     icon: AlertCircle },
  draft:           { label: "Rascunho",            color: "bg-muted text-muted-foreground",                     icon: Clock },
};

function money(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function FinancePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const searchParams = Route.useSearch();
  const [tab, setTab] = useState("overview");
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    if (searchParams.new) {
      setNewOpen(true);
      navigate({ to: "/finance", search: {}, replace: true });
    }
  }, [searchParams.new, navigate]);

  const { data: charges = [] } = useQuery<Charge[]>({
    queryKey: ["charges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("charges")
        .select("id,description,amount,status,due_date,paid_at,payment_method,client_id,project_id,created_at")
        .order("due_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Charge[];
    },
  });
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name").order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id,name").order("name");
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });

  const kpis = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let received = 0, pending = 0, overdue = 0, monthTotal = 0;
    for (const c of charges) {
      // Rascunhos (fatura aguardando confirmação) e pending_invoice não são lançamentos ainda
      if (c.status === "draft" || c.status === "pending_invoice") continue;
      const amt = Number(c.amount ?? 0);
      if (c.status === "paid") received += amt;
      if (c.status === "pending") pending += amt;
      if (c.status === "overdue") overdue += amt;
      if ((c.due_date ?? "").startsWith(monthKey) && c.status !== "cancelled") monthTotal += amt;
    }
    return { received, pending, overdue, monthTotal };
  }, [charges]);

  const dre = useMemo(() => {
    const byMonth: Record<string, { in: number; out: number }> = {};
    for (const c of charges) {
      if (c.status === "cancelled") continue;
      const d = c.paid_at ?? c.due_date;
      if (!d) continue;
      const k = d.slice(0, 7);
      byMonth[k] ??= { in: 0, out: 0 };
      byMonth[k].in += Number(c.amount ?? 0);
    }
    return Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a)).slice(0, 6);
  }, [charges]);

  const createCharge = useMutation({
    mutationFn: async (input: Partial<Charge>) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await supabase.from("charges").insert({
        organization_id: profile.organization_id,
        description: input.description ?? "",
        amount: input.amount ?? 0,
        status: (input.status ?? "pending") as ChargeStatus,
        due_date: input.due_date ?? new Date().toISOString().slice(0, 10),
        client_id: input.client_id,
        project_id: input.project_id,
        payment_method: input.payment_method,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["charges"] });
      toast.success("Lançamento criado");
      setNewOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ChargeStatus }) => {
      const { error } = await supabase.from("charges").update({
        status,
        paid_at: status === "paid" ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["charges"] }),
  });

  return (
    <>
      <div className="p-6">
        <Fin01Overview
          charges={charges as unknown as F1Charge[]}
          costs={costs}
          clients={clients}
          projects={projects}
          onNewEntry={() => setNewOpen(true)}
          onNewInvoice={() => navigate({ to: "/invoices", search: { new: 1 } })}
          onExport={() => exportCsv(charges, clients, projects)}
          onOpenInvoices={() => navigate({ to: "/invoices" })}
          onOpenEntries={() => setTab("movements")}
        />
      </div>

      <NewChargeDialog open={newOpen} onOpenChange={setNewOpen} clients={clients} projects={projects}
        onCreate={(v) => createCharge.mutate(v)} />
    </>
  );
}

function exportCsv(charges: Charge[], clients: Client[], projects: Project[]) {
  const head = ["Descrição", "Cliente", "Projeto", "Vencimento", "Status", "Valor"];
  const rows = charges.map(c => [
    c.description ?? "",
    clients.find(x => x.id === c.client_id)?.name ?? "",
    projects.find(x => x.id === c.project_id)?.name ?? "",
    c.due_date ?? "",
    STATUS_META[c.status]?.label ?? c.status,
    String(Number(c.amount ?? 0).toFixed(2)),
  ]);
  const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `financeiro-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Exportação gerada");
}


function NewChargeDialog({ open, onOpenChange, clients, projects, onCreate }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  clients: Client[]; projects: Project[];
  onCreate: (v: Partial<Charge>) => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [status, setStatus] = useState<ChargeStatus>("pending");
  const [notes, setNotes] = useState("");

  const reset = () => { setDescription(""); setAmount(""); setDueDate(""); setClientId(""); setProjectId(""); setStatus("pending"); setNotes(""); };
  const handleOpenChange = (v: boolean) => { onOpenChange(v); if (!v) reset(); };

  const previewAmount = Number(amount || 0);

  return (
    <EntityDialog
      open={open} onOpenChange={handleOpenChange}
      icon={Receipt} tone="emerald"
      eyebrow="Financeiro"
      title="Novo lançamento"
      subtitle="Registre uma cobrança, recebimento ou faturamento."
      main={
        <>
          <DialogField label="Descrição">
            <Input placeholder="Ex.: Mensalidade Bella Estética - Nov/25" value={description}
              onChange={e => setDescription(e.target.value)} autoFocus />
          </DialogField>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="Valor (R$)">
              <Input type="number" step="0.01" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} />
            </DialogField>
            <DialogField label="Vencimento">
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </DialogField>
          </div>
          <DialogField label="Observações">
            <Textarea rows={3} placeholder="Notas internas (opcional)" value={notes} onChange={e => setNotes(e.target.value)} />
          </DialogField>
          <div className="rounded-xl border bg-emerald-500/5 p-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Valor previsto</span>
            <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{money(previewAmount)}</span>
          </div>
        </>
      }
      sidebar={
        <>
          <DialogField label="Status">
            <Select value={status} onValueChange={(v) => setStatus(v as ChargeStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_META) as ChargeStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DialogField>
          <DialogField label="Cliente">
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </DialogField>
          <DialogField label="Projeto">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </DialogField>
        </>
      }
      footer={
        <>
          <DialogCancelButton onClick={() => handleOpenChange(false)} />
          <UIButton className="rounded-full" onClick={() => onCreate({
            description, amount: previewAmount, due_date: dueDate || null,
            client_id: clientId || null, project_id: projectId || null, status,
          })} disabled={!description || !amount}>Criar lançamento</UIButton>
        </>
      }
    />
  );
}
