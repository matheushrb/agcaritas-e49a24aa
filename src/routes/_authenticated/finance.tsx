import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, Plus, TrendingUp, TrendingDown, Wallet, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/finance")({
  component: FinancePage,
});

type ChargeStatus = "pending" | "paid" | "overdue" | "cancelled";
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
  pending:   { label: "Pendente",  color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", icon: Clock },
  paid:      { label: "Pago",      color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
  overdue:   { label: "Atrasado",  color: "bg-red-500/15 text-red-600 dark:text-red-400", icon: AlertCircle },
  cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground", icon: AlertCircle },
};

function money(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function FinancePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [newOpen, setNewOpen] = useState(false);

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
        due_date: input.due_date ?? undefined,
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><DollarSign className="size-6" />Financeiro</h1>
          <p className="text-sm text-muted-foreground">Faturamento, recebimentos e DRE.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="size-4 mr-1" />Novo lançamento</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Recebido" value={money(kpis.received)} icon={TrendingUp} tone="emerald" />
        <KpiCard label="A receber" value={money(kpis.pending)} icon={Wallet} tone="amber" />
        <KpiCard label="Em atraso" value={money(kpis.overdue)} icon={TrendingDown} tone="red" />
        <KpiCard label="Mês corrente" value={money(kpis.monthTotal)} icon={DollarSign} tone="blue" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
          <TabsTrigger value="invoicing">Faturamentos</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
          <TabsTrigger value="params">Parâmetros</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card className="p-4">
            <h3 className="font-medium mb-3">Próximos vencimentos</h3>
            <ChargeTable
              rows={charges.filter(c => c.status === "pending" || c.status === "overdue").slice(0, 10)}
              clients={clients} projects={projects}
              onStatus={(id, status) => updateStatus.mutate({ id, status })}
            />
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          <Card className="p-4">
            <ChargeTable rows={charges} clients={clients} projects={projects}
              onStatus={(id, status) => updateStatus.mutate({ id, status })} />
          </Card>
        </TabsContent>

        <TabsContent value="invoicing" className="mt-4">
          <Card className="p-4">
            <h3 className="font-medium mb-3">Faturamentos por cliente</h3>
            <div className="space-y-2">
              {Object.entries(charges.reduce<Record<string, number>>((acc, c) => {
                if (c.status === "canceled" || !c.client_id) return acc;
                acc[c.client_id] = (acc[c.client_id] ?? 0) + Number(c.amount ?? 0);
                return acc;
              }, {})).sort(([, a], [, b]) => b - a).map(([cid, total]) => (
                <div key={cid} className="flex justify-between border-b py-2 text-sm">
                  <span>{clients.find(c => c.id === cid)?.name ?? "—"}</span>
                  <span className="font-medium">{money(total)}</span>
                </div>
              ))}
              {charges.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="dre" className="mt-4">
          <Card className="p-4">
            <h3 className="font-medium mb-3">Resumo por mês (últimos 6)</h3>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground border-b">
                <tr><th className="py-2">Mês</th><th className="py-2">Entrada</th></tr>
              </thead>
              <tbody>
                {dre.map(([m, v]) => (
                  <tr key={m} className="border-b"><td className="py-2">{m}</td><td className="py-2">{money(v.in)}</td></tr>
                ))}
                {dre.length === 0 && <tr><td colSpan={2} className="py-4 text-muted-foreground">Sem dados.</td></tr>}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="params" className="mt-4">
          <Card className="p-4 space-y-2 text-sm text-muted-foreground">
            <p>Configurações de faturamento, categorias e regras de recorrência estarão disponíveis em breve.</p>
          </Card>
        </TabsContent>
      </Tabs>

      <NewChargeDialog open={newOpen} onOpenChange={setNewOpen} clients={clients} projects={projects}
        onCreate={(v) => createCharge.mutate(v)} />
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof DollarSign; tone: "emerald" | "amber" | "red" | "blue" }) {
  const tones = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
    red: "text-red-600 dark:text-red-400",
    blue: "text-blue-600 dark:text-blue-400",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={cn("size-4", tones[tone])} />
      </div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </Card>
  );
}

function ChargeTable({ rows, clients, projects, onStatus }: {
  rows: Charge[]; clients: Client[]; projects: Project[];
  onStatus: (id: string, s: ChargeStatus) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Sem lançamentos.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-muted-foreground border-b">
        <tr>
          <th className="py-2">Descrição</th><th>Cliente</th><th>Projeto</th>
          <th>Vencimento</th><th>Valor</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(c => {
          const M = STATUS_META[c.status];
          return (
            <tr key={c.id} className="border-b hover:bg-muted/40">
              <td className="py-2">{c.description ?? "—"}</td>
              <td>{clients.find(x => x.id === c.client_id)?.name ?? "—"}</td>
              <td>{projects.find(x => x.id === c.project_id)?.name ?? "—"}</td>
              <td>{c.due_date ?? "—"}</td>
              <td className="font-medium">{money(Number(c.amount ?? 0))}</td>
              <td>
                <Select value={c.status} onValueChange={(v) => onStatus(c.id, v as ChargeStatus)}>
                  <SelectTrigger className="h-7 w-auto gap-2 border-none px-2">
                    <Badge className={M.color}><M.icon className="size-3 mr-1" />{M.label}</Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_META) as ChargeStatus[]).map(s => (
                      <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
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

  const reset = () => { setDescription(""); setAmount(""); setDueDate(""); setClientId(""); setProjectId(""); setStatus("pending"); };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Descrição" value={description} onChange={e => setDescription(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" step="0.01" placeholder="Valor (R$)" value={amount} onChange={e => setAmount(e.target.value)} />
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger><SelectValue placeholder="Cliente (opcional)" /></SelectTrigger>
            <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue placeholder="Projeto (opcional)" /></SelectTrigger>
            <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as ChargeStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_META) as ChargeStatus[]).map(s => (
                <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onCreate({
            description, amount: Number(amount || 0), due_date: dueDate || null,
            client_id: clientId || null, project_id: projectId || null, status,
          })} disabled={!description || !amount}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
