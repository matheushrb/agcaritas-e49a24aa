import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Clock, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Fin01Overview, type F1Charge, type F1Cost } from "@/components/fin01-overview";
import { FinanceEntryWindow } from "@/components/finance-entry-window";


export const Route = createFileRoute("/_authenticated/finance")({
  validateSearch: (s: Record<string, unknown>): { new?: 1 } => ({
    new: s.new === 1 || s.new === "1" ? (1 as const) : undefined,
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

function FinancePage() {
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

  const { data: costs = [] } = useQuery<F1Cost[]>({
    queryKey: ["project-costs-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_costs")
        .select("id,amount,kind,status,description,occurred_on")
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as F1Cost[];
    },
  });

  const { data: teamMembers = [] } = useQuery<{ id: string; name: string; payment_day: number | null }[]>({
    queryKey: ["team-members-min"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("team_members").select("id,name,payment_day").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; payment_day: number | null }[];
    },
  });

  const queryClient = useQueryClient();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any).rpc("ensure_recurring_charges");
      if (!cancelled && !error && Number(data ?? 0) > 0) {
        queryClient.invalidateQueries({ queryKey: ["charges"] });
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);





  return (
    <>
      <div className="p-6">
        <Fin01Overview
          charges={charges as unknown as F1Charge[]}
          costs={costs}
          clients={clients}
          projects={projects}
          onNewEntry={() => setNewOpen(true)}
          onNewInvoice={() => navigate({ to: "/invoices", search: { new: "1" } })}
          onExport={() => exportCsv(charges, clients, projects)}
          onOpenInvoices={() => navigate({ to: "/invoices" })}
          onOpenEntries={() => setTab("movements")}
        />
      </div>

      <FinanceEntryWindow open={newOpen} onOpenChange={setNewOpen} clients={clients} projects={projects} teamMembers={teamMembers} />
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
