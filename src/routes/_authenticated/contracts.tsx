import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EntityDialog, DialogField, DialogCancelButton } from "@/components/entity-dialog";
import { FileSignature, Plus, Trash2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { money } from "@/lib/br-utils";

export const Route = createFileRoute("/_authenticated/contracts")({
  head: () => ({ meta: [{ title: "Contratos · Caritas Agência" }] }),
  component: ContractsPage,
});

type Contract = {
  id: string; number: string; name: string | null;
  client_id: string | null; project_id: string | null;
  status: string; monthly_value: number; total_value: number;
  start_date: string | null; end_date: string | null;
  billing_day: number | null; object: string | null; notes: string | null;
  services: any[]; created_at: string;
};

type Client = { id: string; name: string };
type Project = { id: string; name: string };

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:     { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  active:    { label: "Ativo",    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  ended:     { label: "Encerrado", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  cancelled: { label: "Cancelado", color: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

function ContractsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: contracts = [] } = useQuery<Contract[]>({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data } = await supabase.from("contracts").select("*").order("created_at", { ascending: false });
      return (data as any) ?? [];
    },
  });
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-list"],
    queryFn: async () => (await supabase.from("clients").select("id,name")).data as any ?? [],
  });
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects-list"],
    queryFn: async () => (await supabase.from("projects").select("id,name")).data as any ?? [],
  });

  const clientById = useMemo(() => Object.fromEntries(clients.map(c => [c.id, c.name])), [clients]);

  const filtered = contracts.filter(c =>
    (statusFilter === "all" || c.status === statusFilter) &&
    (clientFilter === "all" || c.client_id === clientFilter)
  );

  const selected = contracts.find(c => c.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-1">Retainers e contratos formais com clientes.</p>
        </div>
        <Button className="rounded-full gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo contrato</Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] rounded-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {Object.keys(STATUS_META).map(k => <SelectItem key={k} value={k}>{STATUS_META[k].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-[220px] rounded-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos clientes</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileSignature className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <div className="font-medium">Nenhum contrato</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Número</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Mensal</th>
                <th className="text-left px-4 py-3">Início</th>
                <th className="text-left px-4 py-3">Fim</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(c => (
                <tr key={c.id} onClick={() => setSelectedId(c.id)} className="hover:bg-muted/30 cursor-pointer">
                  <td className="px-4 py-3 font-medium">{c.number}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.client_id ? clientById[c.client_id] : "—"}</td>
                  <td className="px-4 py-3">{money(c.monthly_value)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.start_date ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.end_date ?? "—"}</td>
                  <td className="px-4 py-3"><Badge className={cn("rounded-full", STATUS_META[c.status]?.color)}>{STATUS_META[c.status]?.label}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <NewContractDialog open={open} onOpenChange={setOpen} clients={clients} projects={projects} onCreated={(id) => { qc.invalidateQueries({ queryKey: ["contracts"] }); setSelectedId(id); }} />
      <ContractSheet contract={selected} clients={clients} projects={projects} onClose={() => setSelectedId(null)} />
    </div>
  );
}

function generateContractNumber() {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `CTR-${year}-${seq}`;
}

function NewContractDialog({ open, onOpenChange, clients, projects, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; clients: Client[]; projects: Project[]; onCreated: (id: string) => void }) {
  const [form, setForm] = useState<any>({ status: "draft", monthly_value: 0, billing_day: 5 });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!open) setForm({ status: "draft", monthly_value: 0, billing_day: 5 }); }, [open]);

  const submit = async () => {
    if (!form.client_id) { toast.error("Selecione um cliente"); return; }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", userRes.user!.id).maybeSingle();
      const { data, error } = await supabase.from("contracts").insert({
        ...form,
        number: generateContractNumber(),
        organization_id: p!.organization_id,
        value: Number(form.monthly_value) || 0,
        monthly_value: Number(form.monthly_value) || 0,
        billing_day: Number(form.billing_day) || null,
      }).select("id").single();
      if (error) throw error;
      toast.success("Contrato criado");
      onCreated(data.id);
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <EntityDialog
      open={open} onOpenChange={onOpenChange} icon={FileSignature} tone="purple"
      eyebrow="Novo registro" title="Novo contrato" size="lg"
      main={
        <>
          <DialogField label="Nome do contrato"><Input value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Retainer Marketing 2026" /></DialogField>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="Cliente *">
              <Select value={form.client_id ?? ""} onValueChange={v => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </DialogField>
            <DialogField label="Projeto (opcional)">
              <Select value={form.project_id ?? ""} onValueChange={v => setForm({ ...form, project_id: v || null })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </DialogField>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <DialogField label="Início"><Input type="date" value={form.start_date ?? ""} onChange={e => setForm({ ...form, start_date: e.target.value })} /></DialogField>
            <DialogField label="Fim"><Input type="date" value={form.end_date ?? ""} onChange={e => setForm({ ...form, end_date: e.target.value })} /></DialogField>
            <DialogField label="Dia venc. *"><Input type="number" min={1} max={28} value={form.billing_day} onChange={e => setForm({ ...form, billing_day: e.target.value })} /></DialogField>
          </div>
          <DialogField label="Valor mensal *"><Input type="number" value={form.monthly_value} onChange={e => setForm({ ...form, monthly_value: e.target.value })} /></DialogField>
          <DialogField label="Objeto / escopo"><Textarea rows={3} value={form.object ?? ""} onChange={e => setForm({ ...form, object: e.target.value })} /></DialogField>
        </>
      }
      sidebar={
        <DialogField label="Status">
          <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{Object.keys(STATUS_META).map(k => <SelectItem key={k} value={k}>{STATUS_META[k].label}</SelectItem>)}</SelectContent>
          </Select>
        </DialogField>
      }
      footer={<>
        <DialogCancelButton onClick={() => onOpenChange(false)} />
        <Button className="rounded-full" disabled={saving} onClick={submit}>{saving ? "Salvando..." : "Criar contrato"}</Button>
      </>}
    />
  );
}

function ContractSheet({ contract, clients, projects, onClose }: { contract: Contract | null; clients: Client[]; projects: Project[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [local, setLocal] = useState<Contract | null>(contract);
  useEffect(() => setLocal(contract), [contract?.id]);
  if (!local) return null;

  const commit = async (patch: Partial<Contract>) => {
    setLocal(l => l ? { ...l, ...patch } : l);
    const p = { ...patch } as any;
    if (p.monthly_value !== undefined) p.value = Number(p.monthly_value);
    await supabase.from("contracts").update(p).eq("id", local.id);
    qc.invalidateQueries({ queryKey: ["contracts"] });
  };

  const services: any[] = Array.isArray(local.services) ? local.services : [];
  const totalServices = services.reduce((s, x) => s + Number(x.qty ?? 1) * Number(x.unit ?? 0), 0);

  const addService = () => commit({ services: [...services, { desc: "", qty: 1, unit: 0 }] });
  const updateService = (i: number, patch: any) => commit({ services: services.map((s, idx) => idx === i ? { ...s, ...patch } : s) });
  const removeService = (i: number) => commit({ services: services.filter((_, idx) => idx !== i) });

  const generateCharge = async () => {
    if (!local.client_id) { toast.error("Contrato sem cliente"); return; }
    const now = new Date();
    const day = local.billing_day ?? 5;
    const due = new Date(now.getFullYear(), now.getMonth(), day);
    if (due < now) due.setMonth(due.getMonth() + 1);
    const mes = due.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    const { data: userRes } = await supabase.auth.getUser();
    const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", userRes.user!.id).maybeSingle();
    const { error } = await supabase.from("charges").insert({
      organization_id: p!.organization_id,
      client_id: local.client_id,
      project_id: local.project_id,
      contract_id: local.id,
      description: `Retainer ${mes} — ${local.name ?? local.number}`,
      amount: local.monthly_value,
      due_date: due.toISOString().slice(0, 10),
      status: "pending",
      type: "income",
    });
    if (error) toast.error(error.message);
    else { toast.success("Cobrança gerada"); qc.invalidateQueries({ queryKey: ["contract-charges", local.id] }); qc.invalidateQueries({ queryKey: ["charges"] }); }
  };

  return (
    <Sheet open={!!contract} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{local.name ?? local.number}</SheetTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{local.number}</span>
            <Badge className={cn("rounded-full", STATUS_META[local.status]?.color)}>{STATUS_META[local.status]?.label}</Badge>
          </div>
        </SheetHeader>

        <Tabs defaultValue="data" className="mt-5">
          <TabsList className="rounded-full bg-muted/60 h-auto flex-wrap">
            <TabsTrigger value="data" className="rounded-full">Dados</TabsTrigger>
            <TabsTrigger value="services" className="rounded-full">Serviços</TabsTrigger>
            <TabsTrigger value="charges" className="rounded-full">Cobranças</TabsTrigger>
          </TabsList>

          <TabsContent value="data" className="mt-4 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Cliente</label>
              <Select value={local.client_id ?? ""} onValueChange={v => commit({ client_id: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Projeto</label>
              <Select value={local.project_id ?? ""} onValueChange={v => commit({ project_id: v || null as any })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Início</label>
                <Input type="date" defaultValue={local.start_date ?? ""} onBlur={e => commit({ start_date: e.target.value })} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Fim</label>
                <Input type="date" defaultValue={local.end_date ?? ""} onBlur={e => commit({ end_date: e.target.value })} className="rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Valor mensal</label>
                <Input type="number" defaultValue={local.monthly_value} onBlur={e => commit({ monthly_value: Number(e.target.value) })} className="rounded-xl" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Dia de vencimento</label>
                <Input type="number" min={1} max={28} defaultValue={local.billing_day ?? ""} onBlur={e => commit({ billing_day: Number(e.target.value) })} className="rounded-xl" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Objeto/escopo</label>
              <Textarea defaultValue={local.object ?? ""} onBlur={e => commit({ object: e.target.value })} rows={4} className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Observações</label>
              <Textarea defaultValue={local.notes ?? ""} onBlur={e => commit({ notes: e.target.value })} rows={3} className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={local.status} onValueChange={v => commit({ status: v })}>
                <SelectTrigger className="rounded-full w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.keys(STATUS_META).map(k => <SelectItem key={k} value={k}>{STATUS_META[k].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="services" className="mt-4 space-y-3">
            {services.map((s, i) => (
              <Card key={i} className="rounded-2xl p-3 flex gap-2 items-center">
                <Input value={s.desc ?? ""} onChange={e => updateService(i, { desc: e.target.value })} placeholder="Descrição" className="flex-1" />
                <Input type="number" value={s.qty ?? 1} onChange={e => updateService(i, { qty: Number(e.target.value) })} className="w-20" />
                <Input type="number" value={s.unit ?? 0} onChange={e => updateService(i, { unit: Number(e.target.value) })} className="w-28" placeholder="Valor un." />
                <div className="w-24 text-right text-sm">{money(Number(s.qty ?? 1) * Number(s.unit ?? 0))}</div>
                <Button size="icon" variant="ghost" onClick={() => removeService(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </Card>
            ))}
            <div className="flex items-center justify-between">
              <Button variant="outline" className="rounded-full gap-1" onClick={addService}><Plus className="h-4 w-4" />Serviço</Button>
              <div className="text-sm font-medium">Total: {money(totalServices)}</div>
            </div>
          </TabsContent>

          <TabsContent value="charges" className="mt-4 space-y-3">
            <Button className="rounded-full gap-1.5" onClick={generateCharge}><Receipt className="h-4 w-4" /> Gerar cobrança do mês</Button>
            <ContractChargesList contractId={local.id} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function ContractChargesList({ contractId }: { contractId: string }) {
  const { data: charges = [] } = useQuery({
    queryKey: ["contract-charges", contractId],
    queryFn: async () => {
      const { data } = await supabase.from("charges").select("*").eq("contract_id", contractId).order("due_date", { ascending: false });
      return data ?? [];
    },
  });
  if (charges.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">Nenhuma cobrança gerada.</p>;
  return (
    <div className="space-y-2">
      {charges.map((c: any) => (
        <Card key={c.id} className="rounded-2xl p-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-medium">{c.description}</div>
            <div className="text-xs text-muted-foreground">Vencimento: {c.due_date}</div>
          </div>
          <div className="font-semibold">{money(c.amount)}</div>
          <Badge variant="outline" className="rounded-full">{c.status}</Badge>
        </Card>
      ))}
    </div>
  );
}
