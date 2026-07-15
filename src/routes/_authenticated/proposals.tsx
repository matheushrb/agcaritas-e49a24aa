import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState, useEffect } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search, Plus, FileText, DollarSign, TrendingUp, CheckCircle2, Send,
  Eye, XCircle, Trash2, Building2, Calendar, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({
  leadId: z.string().optional(),
  clientId: z.string().optional(),
}).partial();

export const Route = createFileRoute("/_authenticated/proposals")({
  head: () => ({ meta: [{ title: "Propostas · Caritas Agência" }] }),
  validateSearch: searchSchema,
  component: ProposalsPage,
});

// ---------- Domain ----------
type Status = "draft" | "sent" | "viewed" | "approved" | "declined";
type Billing = "monthly" | "one_time" | "hourly" | "package";

interface Item { title: string; qty: number; unit_price: number; }

interface Proposal {
  id: string;
  organization_id: string;
  number: string;
  client_id: string | null;
  lead_id: string | null;
  status: Status;
  total_value: number;
  billing_model: Billing;
  valid_until: string | null;
  items: Item[] | unknown;
  created_at: string;
  updated_at: string;
}

interface Client { id: string; name: string; company: string | null; }
interface Lead { id: string; name: string; company: string | null; client_id: string | null; }

const STATUS_META: Record<Status, { label: string; tone: string; icon: any }> = {
  draft:     { label: "Rascunho",  tone: "bg-slate-500/15 text-slate-400 border-slate-500/20",   icon: FileText },
  sent:      { label: "Enviada",   tone: "bg-blue-500/15 text-blue-400 border-blue-500/20",     icon: Send },
  viewed:    { label: "Visualizada", tone: "bg-violet-500/15 text-violet-400 border-violet-500/20", icon: Eye },
  approved:  { label: "Aprovada",  tone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  declined:  { label: "Recusada",  tone: "bg-rose-500/15 text-rose-400 border-rose-500/20",     icon: XCircle },
};

const BILLING_LABEL: Record<Billing, string> = {
  monthly: "Mensal",
  one_time: "Único",
  hourly: "Por hora",
  package: "Pacote",
};

const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    .format(Number(v ?? 0));

// ---------- Data ----------
const proposalsKey = ["proposals"] as const;

async function currentOrgId(): Promise<string> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) throw new Error("Sem sessão");
  const { data } = await supabase.from("profiles").select("organization_id").eq("id", userRes.user.id).maybeSingle();
  if (!data?.organization_id) throw new Error("Sem organização");
  return data.organization_id;
}

function useProposals() {
  return useQuery({
    queryKey: proposalsKey,
    queryFn: async (): Promise<Proposal[]> => {
      const { data, error } = await supabase.from("proposals").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Proposal[];
    },
  });
}

function useClients() {
  return useQuery({
    queryKey: ["clients-lite"],
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase.from("clients").select("id,name,company").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useLeads() {
  return useQuery({
    queryKey: ["leads-lite"],
    queryFn: async (): Promise<Lead[]> => {
      const { data, error } = await supabase.from("leads").select("id,name,company,client_id").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ---------- Page ----------
function ProposalsPage() {
  const { data: proposals = [], isLoading } = useProposals();
  const { data: clients = [] } = useClients();
  const { data: leads = [] } = useLeads();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/proposals" });

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [open, setOpen] = useState<Proposal | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Auto-open create modal if arriving from CRM with ?leadId=
  useEffect(() => {
    if (search.leadId || search.clientId) setModalOpen(true);
  }, [search.leadId, search.clientId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return proposals.filter(p => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      const client = clients.find(c => c.id === p.client_id);
      const lead = leads.find(l => l.id === p.lead_id);
      return (
        p.number.toLowerCase().includes(q) ||
        (client?.name.toLowerCase().includes(q) ?? false) ||
        (client?.company?.toLowerCase().includes(q) ?? false) ||
        (lead?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [proposals, query, statusFilter, clients, leads]);

  // KPIs
  const totalOpen = proposals.filter(p => p.status === "sent" || p.status === "viewed")
    .reduce((a, p) => a + Number(p.total_value), 0);
  const totalApproved = proposals.filter(p => p.status === "approved")
    .reduce((a, p) => a + Number(p.total_value), 0);
  const approvalRate = proposals.length
    ? Math.round((proposals.filter(p => p.status === "approved").length / proposals.length) * 100)
    : 0;

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("proposals").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalsKey });
      toast.success("Status atualizado");
    },
    onError: () => toast.error("Falha ao atualizar status"),
  });

  const removeProposal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("proposals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalsKey });
      setOpen(null);
      toast.success("Proposta removida");
    },
    onError: () => toast.error("Falha ao remover"),
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Comercial
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Propostas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Criação, envio e acompanhamento de propostas comerciais.
          </p>
        </div>
        <Button className="rounded-full gap-2" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Nova proposta
        </Button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Em aberto" value={brl(totalOpen)} icon={TrendingUp} tone="text-blue-500" />
        <KpiCard label="Aprovadas" value={brl(totalApproved)} icon={DollarSign} tone="text-emerald-500" />
        <KpiCard label="Taxa de aprovação" value={`${approvalRate}%`} icon={CheckCircle2} tone="text-violet-500" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, cliente ou lead"
            className="pl-9 rounded-full bg-card border-border"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[200px] rounded-full">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(STATUS_META) as Status[]).map(s => (
              <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="ml-auto text-xs text-muted-foreground">
          {filtered.length} de {proposals.length} propostas
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => setModalOpen(true)} />
      ) : (
        <div className="rounded-3xl border border-border/60 bg-card overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground border-b border-border/60">
            <div className="col-span-2">Número</div>
            <div className="col-span-3">Cliente / Lead</div>
            <div className="col-span-2">Modelo</div>
            <div className="col-span-2">Valor</div>
            <div className="col-span-2">Validade</div>
            <div className="col-span-1 text-right">Status</div>
          </div>
          <div className="divide-y divide-border/60">
            {filtered.map(p => {
              const client = clients.find(c => c.id === p.client_id);
              const lead = leads.find(l => l.id === p.lead_id);
              const meta = STATUS_META[p.status];
              const Icon = meta.icon;
              return (
                <button
                  key={p.id}
                  onClick={() => setOpen(p)}
                  className="w-full grid grid-cols-12 gap-2 px-5 py-4 text-left hover:bg-muted/40 transition items-center"
                >
                  <div className="col-span-2 font-mono text-sm">{p.number}</div>
                  <div className="col-span-3 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {client?.name ?? lead?.name ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {client?.company ?? lead?.company ?? (lead ? "Lead" : "Sem cliente")}
                    </p>
                  </div>
                  <div className="col-span-2 text-sm text-muted-foreground">
                    {BILLING_LABEL[p.billing_model]}
                  </div>
                  <div className="col-span-2 text-sm font-semibold">{brl(p.total_value)}</div>
                  <div className="col-span-2 text-sm text-muted-foreground">
                    {p.valid_until ? new Date(p.valid_until).toLocaleDateString("pt-BR") : "—"}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Badge variant="outline" className={`gap-1 border ${meta.tone}`}>
                      <Icon className="h-3 w-3" /> {meta.label}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Drawer */}
      <ProposalDrawer
        proposal={open}
        client={open ? clients.find(c => c.id === open.client_id) ?? null : null}
        lead={open ? leads.find(l => l.id === open.lead_id) ?? null : null}
        onClose={() => setOpen(null)}
        onStatus={(status) => open && updateStatus.mutate({ id: open.id, status })}
        onDelete={() => open && removeProposal.mutate(open.id)}
        onCreateContract={() => {
          if (!open) return;
          navigate({ to: "/contracts", search: { proposalId: open.id } as any });
        }}
      />

      {/* Create modal */}
      <CreateProposalModal
        open={modalOpen}
        onOpenChange={(v) => {
          setModalOpen(v);
          if (!v && (search.leadId || search.clientId)) {
            navigate({ to: "/proposals", search: {} });
          }
        }}
        clients={clients}
        leads={leads}
        defaultLeadId={search.leadId}
        defaultClientId={search.clientId}
      />
    </div>
  );
}

// ---------- Empty ----------
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
        <FileText className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">Nenhuma proposta ainda</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
        Crie sua primeira proposta comercial. Ela pode ser vinculada a um lead do CRM ou a um cliente existente.
      </p>
      <Button className="mt-5 rounded-full gap-2" onClick={onCreate}>
        <Plus className="h-4 w-4" /> Nova proposta
      </Button>
    </div>
  );
}

// ---------- KPI ----------
function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <p className="mt-3 font-display text-2xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

// ---------- Drawer ----------
function ProposalDrawer({
  proposal, client, lead, onClose, onStatus, onDelete, onCreateContract,
}: {
  proposal: Proposal | null;
  client: Client | null;
  lead: Lead | null;
  onClose: () => void;
  onStatus: (status: Status) => void;
  onDelete: () => void;
  onCreateContract: () => void;
}) {
  if (!proposal) return null;
  const meta = STATUS_META[proposal.status];
  const Icon = meta.icon;
  const items = Array.isArray(proposal.items) ? proposal.items as Item[] : [];

  return (
    <Sheet open={!!proposal} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{proposal.number}</p>
              <SheetTitle className="font-display text-2xl">
                {client?.name ?? lead?.name ?? "Proposta"}
              </SheetTitle>
              <SheetDescription>
                {client?.company ?? lead?.company ?? "Sem cliente vinculado"}
              </SheetDescription>
            </div>
            <Badge variant="outline" className={`gap-1 border ${meta.tone}`}>
              <Icon className="h-3 w-3" /> {meta.label}
            </Badge>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <SummaryTile label="Valor total" value={brl(proposal.total_value)} icon={DollarSign} />
            <SummaryTile label="Modelo" value={BILLING_LABEL[proposal.billing_model]} icon={Sparkles} />
            <SummaryTile label="Validade" value={proposal.valid_until ? new Date(proposal.valid_until).toLocaleDateString("pt-BR") : "—"} icon={Calendar} />
            <SummaryTile label="Criada em" value={new Date(proposal.created_at).toLocaleDateString("pt-BR")} icon={FileText} />
          </div>

          {/* Items */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-3">
              Escopo
            </h4>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum item cadastrado.</p>
            ) : (
              <div className="rounded-2xl border border-border/60 divide-y divide-border/60">
                {items.map((it, i) => (
                  <div key={i} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{it.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {it.qty} × {brl(it.unit_price)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">{brl(it.qty * it.unit_price)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status transitions */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-3">
              Fluxo
            </h4>
            <div className="flex flex-wrap gap-2">
              {(["draft","sent","viewed","approved","declined"] as Status[]).map(s => {
                const m = STATUS_META[s];
                const M = m.icon;
                const active = proposal.status === s;
                return (
                  <Button
                    key={s}
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className="rounded-full gap-1"
                    onClick={() => !active && onStatus(s)}
                  >
                    <M className="h-3 w-3" /> {m.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Approved automation */}
          {proposal.status === "approved" && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <p className="text-sm font-semibold">Proposta aprovada</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Gere o contrato para dar sequência ao fluxo do cliente.
              </p>
              <Button className="mt-3 rounded-full gap-2" size="sm" onClick={onCreateContract}>
                <FileText className="h-4 w-4" /> Criar contrato
              </Button>
            </div>
          )}

          {/* Danger */}
          <div className="pt-4 border-t border-border/60">
            <Button variant="ghost" size="sm" className="gap-2 text-rose-400 hover:text-rose-300" onClick={onDelete}>
              <Trash2 className="h-4 w-4" /> Excluir proposta
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SummaryTile({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">{label}</p>
      </div>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

// ---------- Create modal ----------
function CreateProposalModal({
  open, onOpenChange, clients, leads, defaultLeadId, defaultClientId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clients: Client[];
  leads: Lead[];
  defaultLeadId?: string;
  defaultClientId?: string;
}) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<"client" | "lead">(defaultClientId ? "client" : "lead");
  const [clientId, setClientId] = useState<string>(defaultClientId ?? "");
  const [leadId, setLeadId] = useState<string>(defaultLeadId ?? "");
  const [billing, setBilling] = useState<Billing>("one_time");
  const [validUntil, setValidUntil] = useState<string>("");
  const [items, setItems] = useState<Item[]>([{ title: "", qty: 1, unit_price: 0 }]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setTarget(defaultClientId ? "client" : "lead");
      setClientId(defaultClientId ?? "");
      setLeadId(defaultLeadId ?? "");
      setBilling("one_time");
      setValidUntil("");
      setItems([{ title: "", qty: 1, unit_price: 0 }]);
      setNotes("");
    }
  }, [open, defaultClientId, defaultLeadId]);

  const total = items.reduce((a, it) => a + Number(it.qty || 0) * Number(it.unit_price || 0), 0);

  const create = useMutation({
    mutationFn: async () => {
      const orgId = await currentOrgId();
      const cleanItems = items.filter(it => it.title.trim().length > 0);
      const number = `PROP-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      const payload: any = {
        organization_id: orgId,
        number,
        status: "draft",
        billing_model: billing,
        total_value: total,
        valid_until: validUntil || null,
        items: cleanItems,
        client_id: target === "client" ? clientId || null : null,
        lead_id: target === "lead" ? leadId || null : null,
      };
      const { error } = await supabase.from("proposals").insert(payload);
      if (error) throw error;
      return number;
    },
    onSuccess: (num) => {
      qc.invalidateQueries({ queryKey: proposalsKey });
      toast.success(`Proposta ${num} criada`);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar proposta"),
  });

  const canSubmit =
    (target === "client" ? !!clientId : !!leadId) &&
    items.some(it => it.title.trim().length > 0) &&
    total > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Nova proposta</DialogTitle>
          <DialogDescription>
            Vincule a proposta a um lead do CRM ou a um cliente existente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Target */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTarget("lead")}
              className={`rounded-2xl border p-3 text-left transition ${target === "lead" ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"}`}
            >
              <p className="text-xs font-semibold">Para um lead</p>
              <p className="text-[11px] text-muted-foreground">Vinculado ao pipeline do CRM</p>
            </button>
            <button
              type="button"
              onClick={() => setTarget("client")}
              className={`rounded-2xl border p-3 text-left transition ${target === "client" ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"}`}
            >
              <p className="text-xs font-semibold">Para um cliente</p>
              <p className="text-[11px] text-muted-foreground">Cliente já cadastrado</p>
            </button>
          </div>

          {target === "lead" ? (
            <div>
              <Label className="text-xs">Lead</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione um lead" /></SelectTrigger>
                <SelectContent>
                  {leads.length === 0 ? (
                    <SelectItem value="__none" disabled>Nenhum lead cadastrado</SelectItem>
                  ) : leads.map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}{l.company ? ` · ${l.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label className="text-xs">Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.length === 0 ? (
                    <SelectItem value="__none" disabled>Nenhum cliente cadastrado</SelectItem>
                  ) : clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.company ? ` · ${c.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Modelo de cobrança</Label>
              <Select value={billing} onValueChange={(v) => setBilling(v as Billing)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(BILLING_LABEL) as Billing[]).map(b => (
                    <SelectItem key={b} value={b}>{BILLING_LABEL[b]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Válida até</Label>
              <Input type="date" className="mt-1" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Escopo</Label>
              <Button type="button" variant="ghost" size="sm" className="gap-1 h-7"
                onClick={() => setItems([...items, { title: "", qty: 1, unit_price: 0 }])}>
                <Plus className="h-3 w-3" /> Item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <Input
                    className="col-span-6"
                    placeholder="Descrição"
                    value={it.title}
                    onChange={e => {
                      const copy = [...items]; copy[i] = { ...it, title: e.target.value }; setItems(copy);
                    }}
                  />
                  <Input
                    className="col-span-2"
                    type="number" min={1} placeholder="Qtd"
                    value={it.qty}
                    onChange={e => {
                      const copy = [...items]; copy[i] = { ...it, qty: Number(e.target.value) || 0 }; setItems(copy);
                    }}
                  />
                  <Input
                    className="col-span-3"
                    type="number" min={0} placeholder="Valor unit."
                    value={it.unit_price}
                    onChange={e => {
                      const copy = [...items]; copy[i] = { ...it, unit_price: Number(e.target.value) || 0 }; setItems(copy);
                    }}
                  />
                  <Button
                    type="button" variant="ghost" size="icon" className="col-span-1 h-9 w-9"
                    onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Total</p>
              <p className="font-display text-lg font-bold">{brl(total)}</p>
            </div>
          </div>

          <div>
            <Label className="text-xs">Observações internas</Label>
            <Textarea className="mt-1" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anotações que ficam apenas no seu time" />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={!canSubmit || create.isPending} className="gap-2">
            <FileText className="h-4 w-4" /> Criar proposta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
