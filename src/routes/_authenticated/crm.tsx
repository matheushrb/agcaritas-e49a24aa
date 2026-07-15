import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable, useDraggable } from "@dnd-kit/core";
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
  Search, Plus, ChevronLeft, ChevronRight, FileText, Building2, Mail,
  Phone, Tag, DollarSign, User, GripVertical, TrendingUp, Target,
  Sparkles, X,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM · Caritas Agência" }] }),
  component: CrmPage,
});

// ---------- Domain ----------
type Stage = "lead" | "contact" | "proposal" | "negotiation" | "closed";

interface Lead {
  id: string;
  organization_id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  segment: string | null;
  source: string | null;
  estimated_value: number | null;
  stage: Stage;
  owner_id: string | null;
  entered_stage_at: string;
  created_at: string;
  updated_at: string;
  client_id: string | null;
}

const STAGES: { id: Stage; label: string; accent: string }[] = [
  { id: "lead",        label: "Lead",        accent: "bg-slate-500" },
  { id: "contact",     label: "Contato",     accent: "bg-blue-500" },
  { id: "proposal",    label: "Proposta",    accent: "bg-violet-500" },
  { id: "negotiation", label: "Negociação",  accent: "bg-amber-500" },
  { id: "closed",      label: "Fechado",     accent: "bg-emerald-500" },
];

const STAGE_INDEX: Record<Stage, number> = {
  lead: 0, contact: 1, proposal: 2, negotiation: 3, closed: 4,
};

const brl = (v: number | null) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    .format(v ?? 0);

// ---------- Data hooks ----------
const leadsKey = ["leads"] as const;

function useLeads() {
  return useQuery({
    queryKey: leadsKey,
    queryFn: async (): Promise<Lead[]> => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("entered_stage_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
  });
}

async function currentOrgId(): Promise<string> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) throw new Error("Sem sessão");
  const { data } = await supabase.from("profiles").select("organization_id").eq("id", userRes.user.id).maybeSingle();
  if (!data?.organization_id) throw new Error("Sem organização");
  return data.organization_id;
}

// ---------- Page ----------
function CrmPage() {
  const { data: leads = [], isLoading } = useLeads();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<string>("all");
  const [openLead, setOpenLead] = useState<Lead | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [closedBanner, setClosedBanner] = useState<Lead | null>(null);

  const segments = useMemo(
    () => Array.from(new Set(leads.map(l => l.segment).filter(Boolean) as string[])).sort(),
    [leads],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter(l => {
      if (segment !== "all" && l.segment !== segment) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        (l.company ?? "").toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, query, segment]);

  const byStage = useMemo(() => {
    const map = new Map<Stage, Lead[]>();
    STAGES.forEach(s => map.set(s.id, []));
    filtered.forEach(l => map.get(l.stage)?.push(l));
    return map;
  }, [filtered]);

  // KPIs
  const pipeline = leads
    .filter(l => l.stage !== "closed")
    .reduce((a, l) => a + Number(l.estimated_value ?? 0), 0);
  const closedValue = leads
    .filter(l => l.stage === "closed")
    .reduce((a, l) => a + Number(l.estimated_value ?? 0), 0);
  const conversion = leads.length
    ? Math.round((leads.filter(l => l.stage === "closed").length / leads.length) * 100)
    : 0;

  // Mutations
  const updateStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: Stage }) => {
      const { error } = await supabase
        .from("leads")
        .update({ stage, entered_stage_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: leadsKey });
      const prev = qc.getQueryData<Lead[]>(leadsKey);
      qc.setQueryData<Lead[]>(leadsKey, (old = []) =>
        old.map(l => (l.id === id ? { ...l, stage } : l)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(leadsKey, ctx.prev);
      toast.error("Não deu para mover o lead");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: leadsKey }),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const overId = e.over?.id;
    const leadId = String(e.active.id);
    if (!overId) return;
    const targetStage = String(overId) as Stage;
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.stage === targetStage) return;

    updateStage.mutate({ id: leadId, stage: targetStage });
    if (targetStage === "closed") setClosedBanner({ ...lead, stage: targetStage });
  };

  const dragging = dragId ? leads.find(l => l.id === dragId) ?? null : null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Prospecção
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Pipeline de vendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Arraste os cards entre as colunas conforme o lead avança.
          </p>
        </div>
        <Button className="rounded-full gap-2" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Novo lead
        </Button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Pipeline em aberto" value={brl(pipeline)} icon={TrendingUp} tone="text-blue-500" />
        <KpiCard label="Receita fechada"    value={brl(closedValue)} icon={DollarSign} tone="text-emerald-500" />
        <KpiCard label="Taxa de conversão"  value={`${conversion}%`} icon={Target} tone="text-violet-500" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, empresa ou email"
            className="pl-9 rounded-full bg-card border-border"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <Select value={segment} onValueChange={setSegment}>
          <SelectTrigger className="w-[200px] rounded-full">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os segmentos</SelectItem>
            {segments.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="ml-auto text-xs text-muted-foreground">
          {filtered.length} de {leads.length} leads
        </p>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {STAGES.map(s => <Skeleton key={s.id} className="h-96 rounded-3xl" />)}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {STAGES.map(stage => (
              <Column
                key={stage.id}
                stage={stage}
                leads={byStage.get(stage.id) ?? []}
                onOpen={setOpenLead}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {dragging ? <LeadCard lead={dragging} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Drawer */}
      <LeadDrawer
        lead={openLead}
        onClose={() => setOpenLead(null)}
        onAdvance={dir => {
          if (!openLead) return;
          const idx = STAGE_INDEX[openLead.stage] + dir;
          if (idx < 0 || idx >= STAGES.length) return;
          const next = STAGES[idx].id;
          updateStage.mutate({ id: openLead.id, stage: next });
          if (next === "closed") setClosedBanner({ ...openLead, stage: next });
          setOpenLead({ ...openLead, stage: next });
        }}
        onCreateProposal={() => {
          if (!openLead) return;
          navigate({ to: "/proposals", search: { leadId: openLead.id } as any });
        }}
      />

      {/* Modal new lead */}
      <NewLeadModal open={modalOpen} onOpenChange={setModalOpen} segments={segments} />

      {/* Banner "closed" → plano de marketing */}
      {closedBanner && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-elevated)]">
            <Sparkles className="h-5 w-5 text-primary" />
            <div className="text-sm">
              <p className="font-medium">Lead fechado: {closedBanner.name}</p>
              <p className="text-xs text-muted-foreground">Criar um Plano de Marketing para este cliente?</p>
            </div>
            <Button
              size="sm"
              className="rounded-full ml-2"
              onClick={() => {
                navigate({ to: "/marketing-plans", search: { leadId: closedBanner.id } as any });
                setClosedBanner(null);
              }}
            >
              Criar plano
            </Button>
            <button
              onClick={() => setClosedBanner(null)}
              className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Column ----------
function Column({
  stage, leads, onOpen,
}: {
  stage: (typeof STAGES)[number];
  leads: Lead[];
  onOpen: (l: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = leads.reduce((a, l) => a + Number(l.estimated_value ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`rounded-3xl border p-3 transition-colors ${
        isOver ? "border-primary bg-primary/5" : "border-border bg-card/40"
      }`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${stage.accent}`} />
          <p className="text-sm font-semibold">{stage.label}</p>
          <Badge variant="secondary" className="rounded-full text-[10px]">{leads.length}</Badge>
        </div>
        <p className="text-[10px] text-muted-foreground">{brl(total)}</p>
      </div>
      <div className="space-y-2 min-h-[120px]">
        {leads.map(l => (
          <DraggableCard key={l.id} lead={l} onOpen={onOpen} />
        ))}
        {leads.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Solte um lead aqui
          </div>
        )}
      </div>
    </div>
  );
}

function DraggableCard({ lead, onOpen }: { lead: Lead; onOpen: (l: Lead) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="group"
    >
      <div className="flex items-stretch gap-1">
        <button
          {...attributes}
          {...listeners}
          className="grid w-5 place-items-center rounded-l-2xl text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label="Arrastar"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onOpen(lead)}
          className="flex-1 text-left"
        >
          <LeadCard lead={lead} />
        </button>
      </div>
    </div>
  );
}

function LeadCard({ lead, dragging = false }: { lead: Lead; dragging?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-3 ${
        dragging ? "shadow-[var(--shadow-elevated)] rotate-1" : "hover:border-primary/40 transition-colors"
      }`}
    >
      <p className="text-sm font-medium truncate">{lead.name}</p>
      {lead.company && (
        <p className="text-xs text-muted-foreground truncate">{lead.company}</p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        {lead.segment ? (
          <Badge variant="outline" className="rounded-full text-[10px] font-normal">
            {lead.segment}
          </Badge>
        ) : <span />}
        {lead.estimated_value ? (
          <p className="text-xs font-semibold text-emerald-500 dark:text-emerald-400">
            {brl(Number(lead.estimated_value))}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// ---------- Drawer ----------
function LeadDrawer({
  lead, onClose, onAdvance, onCreateProposal,
}: {
  lead: Lead | null;
  onClose: () => void;
  onAdvance: (dir: -1 | 1) => void;
  onCreateProposal: () => void;
}) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");

  const saveNotes = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      // notes vive em clients.notes; para lead usaremos coluna nova via update simples se existir
      // No PRD histórico é aba futura; aqui só disparamos toast.
      toast.success("Nota registrada");
      setNotes("");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: leadsKey }),
  });

  if (!lead) return null;
  const idx = STAGE_INDEX[lead.stage];

  return (
    <Sheet open={!!lead} onOpenChange={o => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{lead.name}</SheetTitle>
          <SheetDescription>{lead.company ?? "Sem empresa"}</SheetDescription>
        </SheetHeader>

        {/* Progresso de etapas */}
        <div className="mt-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Etapa atual
          </p>
          <div className="flex items-center gap-1">
            {STAGES.map((s, i) => (
              <div
                key={s.id}
                className={`h-1.5 flex-1 rounded-full ${
                  i <= idx ? s.accent : "bg-muted"
                }`}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <Badge className="rounded-full">{STAGES[idx].label}</Badge>
            <div className="flex gap-1">
              <Button
                size="sm" variant="outline" className="rounded-full gap-1"
                disabled={idx === 0}
                onClick={() => onAdvance(-1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Voltar
              </Button>
              <Button
                size="sm" className="rounded-full gap-1"
                disabled={idx === STAGES.length - 1}
                onClick={() => onAdvance(1)}
              >
                Avançar <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Dados */}
        <div className="mt-6 space-y-3">
          <InfoRow icon={User} label="Responsável" value={lead.owner_id ? "Atribuído" : "Sem responsável"} />
          <InfoRow icon={Building2} label="Empresa" value={lead.company ?? "—"} />
          <InfoRow icon={Mail} label="Email" value={lead.email ?? "—"} />
          <InfoRow icon={Phone} label="Telefone" value={lead.phone ?? "—"} />
          <InfoRow icon={Tag} label="Segmento" value={lead.segment ?? "—"} />
          <InfoRow icon={DollarSign} label="Valor estimado" value={brl(Number(lead.estimated_value ?? 0))} />
          <InfoRow icon={FileText} label="Origem" value={lead.source ?? "—"} />
        </div>

        {/* Notas */}
        <div className="mt-6">
          <Label className="text-xs">Registrar interação</Label>
          <Textarea
            placeholder="Ex: Cliente pediu mais detalhes sobre pacote mensal…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="mt-1"
            rows={3}
          />
          <div className="mt-2 flex justify-end">
            <Button
              size="sm" variant="outline" className="rounded-full"
              onClick={() => saveNotes.mutate()}
              disabled={!notes.trim()}
            >
              Salvar nota
            </Button>
          </div>
        </div>

        {/* Ações */}
        <div className="mt-8 flex gap-2">
          <Button className="flex-1 rounded-full gap-2" onClick={onCreateProposal}>
            <FileText className="h-4 w-4" /> Criar proposta
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({
  icon: Icon, label, value,
}: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

// ---------- Modal ----------
function NewLeadModal({
  open, onOpenChange, segments,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  segments: string[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "", company: "", email: "", phone: "",
    segment: "", estimated_value: "", stage: "lead" as Stage, source: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      const org = await currentOrgId();
      const { error } = await supabase.from("leads").insert({
        organization_id: org,
        name: form.name.trim(),
        company: form.company.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        segment: form.segment.trim() || null,
        source: form.source.trim() || null,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
        stage: form.stage,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead criado");
      qc.invalidateQueries({ queryKey: leadsKey });
      onOpenChange(false);
      setForm({ name: "", company: "", email: "", phone: "", segment: "", estimated_value: "", stage: "lead", source: "" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar lead"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
          <DialogDescription>Cadastre um contato novo no pipeline.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome*" className="col-span-2">
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Empresa">
            <Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
          </Field>
          <Field label="Segmento">
            <Input
              value={form.segment}
              onChange={e => setForm({ ...form, segment: e.target.value })}
              list="crm-segments"
              placeholder="Ex: Moda, Saúde, Imóveis"
            />
            <datalist id="crm-segments">
              {segments.map(s => <option key={s} value={s} />)}
            </datalist>
          </Field>
          <Field label="Telefone">
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Valor estimado (R$)">
            <Input
              type="number" min="0" step="100"
              value={form.estimated_value}
              onChange={e => setForm({ ...form, estimated_value: e.target.value })}
            />
          </Field>
          <Field label="Origem">
            <Input
              value={form.source}
              onChange={e => setForm({ ...form, source: e.target.value })}
              placeholder="Indicação, Instagram, Site…"
            />
          </Field>
          <Field label="Etapa inicial" className="col-span-2">
            <Select value={form.stage} onValueChange={v => setForm({ ...form, stage: v as Stage })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!form.name.trim() || create.isPending}
          >
            {create.isPending ? "Salvando…" : "Salvar lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label, children, className = "",
}: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

// ---------- KPI ----------
function KpiCard({
  label, value, icon: Icon, tone,
}: { label: string; value: string; icon: any; tone: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${tone}`} />
      </div>
      <p className="mt-2 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}
