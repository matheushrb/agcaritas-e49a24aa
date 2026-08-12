import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Clock, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Fin01Overview, type F1Charge, type F1Cost } from "@/components/fin01-overview";
import { FinanceEntryWindow } from "@/components/finance-entry-window";
import { CashflowPanel, DrePanel, PlannerPanel, IntelligencePanel, MonthGoalBanner, type FinDataset } from "@/components/finance/fin-panels";
import { useAgencyPricing } from "@/components/settings/agency-pricing";
import { DEFAULT_RESERVES, type ReserveSettings } from "@/lib/finance-analytics";
import { LayoutDashboard, Waves, FileSpreadsheet, Target, Brain, ListOrdered } from "lucide-react";
import { EntriesPanel } from "@/components/finance/fin-entries";


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





  const { data: pricing } = useAgencyPricing();
  const { data: tasks = [] } = useQuery({
    queryKey: ["fin-tasks"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select("id,title,status,task_type_id,assignee_id,project_id,estimated_hours,billing_value,billing_base_value,billing_enabled,created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: taskTypes = [] } = useQuery({
    queryKey: ["fin-task-types"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("task_types").select("id,name,color,default_price");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: authUserId } = useQuery({
    queryKey: ["fin-auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });
  const { data: members = [] } = useQuery({
    queryKey: ["fin-members"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("team_members")
        .select("id,user_id,name,cost_mode,monthly_salary,monthly_hours,hourly_rate,default_task_rate,task_rate_overrides");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: entries = [] } = useQuery({
    queryKey: ["fin-time-entries"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("time_entries").select("id,task_id,user_id,duration_seconds");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: allCosts = [] } = useQuery({
    queryKey: ["fin-project-costs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_costs")
        .select("id,task_id,project_id,amount,kind,status,occurred_on");
      if (error) throw error;
      return data ?? [];
    },
  });

  const reserves: ReserveSettings = {
    ...DEFAULT_RESERVES,
    ...(((pricing as any)?.reserves ?? {}) as Partial<ReserveSettings>),
    ...(pricing ? { profit_pct: (pricing as any)?.reserves?.profit_pct ?? pricing.profit_margin_pct ?? DEFAULT_RESERVES.profit_pct,
                    tax_pct: (pricing as any)?.reserves?.tax_pct ?? pricing.tax_pct ?? DEFAULT_RESERVES.tax_pct } : {}),
  };

  const dataset: FinDataset = {
    charges: charges as any,
    costs: allCosts as any,
    tasks: tasks as any,
    taskTypes: taskTypes as any,
    members: members as any,
    entries: entries as any,
    currentUserId: authUserId ?? null,
    pricing: (pricing ?? { fixed_costs: [], variable_costs: [], billable_hours_month: 120, profit_margin_pct: 30, tax_pct: 6 }) as any,
    reserves,
  };

  const TABS = [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard, hint: "Resumo do caixa" },
    { id: "movements", label: "Lançamentos", icon: ListOrdered, hint: "Receitas e despesas" },
    { id: "cashflow", label: "Fluxo de caixa", icon: Waves, hint: "Realizado e previsto" },
    { id: "dre", label: "DRE", icon: FileSpreadsheet, hint: "Resultado gerencial" },
    { id: "planner", label: "Planejador", icon: Target, hint: "Reservas e metas" },
    { id: "intelligence", label: "Análise inteligente", icon: Brain, hint: "Custo x preço por serviço" },
  ];

  return (
    <>
      <div className="p-6 flex gap-5 items-start">
        <nav className="w-56 shrink-0 space-y-1 sticky top-6">
          <div className="px-2 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Financeiro</div>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full text-left rounded-xl px-3 py-2.5 border transition ${active ? "bg-primary/10 border-primary/40" : "bg-card border-transparent hover:border-border hover:bg-muted/50"}`}
              >
                <span className={`flex items-center gap-2 text-sm font-medium ${active ? "text-primary" : ""}`}>
                  <Icon className="h-4 w-4" />{t.label}
                </span>
                <span className="block pl-6 text-[11px] text-muted-foreground">{t.hint}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0">
          {tab === "movements" ? (
            <EntriesPanel clients={clients} projects={projects} teamMembers={teamMembers} />
          ) : tab === "overview" ? (
            <><MonthGoalBanner data={dataset} onOpenPlanner={() => setTab("planner")} /><Fin01Overview
              charges={charges as unknown as F1Charge[]}
              costs={costs}
              clients={clients}
              projects={projects}
              onNewEntry={() => setNewOpen(true)}
              onNewInvoice={() => navigate({ to: "/invoices", search: { new: "1" } })}
              onExport={() => exportCsv(charges, clients, projects)}
              onOpenInvoices={() => navigate({ to: "/invoices" })}
              onOpenEntries={() => setTab("movements")}
            /></>
          ) : tab === "cashflow" ? (
            <CashflowPanel data={dataset} />
          ) : tab === "dre" ? (
            <DrePanel data={dataset} />
          ) : tab === "planner" ? (
            <PlannerPanel data={dataset} />
          ) : (
            <IntelligencePanel data={dataset} />
          )}
        </div>
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
