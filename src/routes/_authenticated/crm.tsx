import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search, Plus, ChevronLeft, ChevronRight, FileText, Building2, Mail,
  Phone, Tag, DollarSign, User, GripVertical, TrendingUp, Target,
  Sparkles, X, Flame, Snowflake, Thermometer, CalendarDays, CheckCircle2, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { BriefingForm } from "@/components/briefing-form";
import {
  fetchBriefingTemplates, type BriefingData, type BriefingTemplate,
} from "@/lib/briefing";
import { fetchStages, stagesKey, type PipelineStage } from "@/components/settings/pipeline-stages-editor";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({ meta: [{ title: "CRM · Caritas Agência" }] }),
  validateSearch: (s: Record<string, unknown>): { new?: 1 } => ({
    new: s.new === 1 || s.new === "1" ? (1 as const) : undefined,
  }),
  component: CrmPage,
});

// ---------- Domain ----------
type Temperature = "cold" | "warm" | "hot";

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
  stage: string;
  stage_id: string | null;
  probability: number | null;
  temperature: Temperature | null;
  expected_close_date: string | null;
  notes: string | null;
  briefing_template_id: string | null;
  briefing: BriefingData | null;
  owner_id: string | null;
  entered_stage_at: string;
  created_at: string;
  updated_at: string;
  client_id: string | null;
}

interface LeadActivity {
  id: string;
  lead_id: string;
  kind: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  done: boolean;
  created_at: string;
}

const ACTIVITY_KINDS = [
  { value: "note", label: "Nota" },
  { value: "call", label: "Ligação" },
  { value: "meeting", label: "Reunião" },
  { value: "email", label: "E-mail" },
  { value: "task", label: "Tarefa" },
];

const TEMPERATURES: { value: Temperature; label: string; icon: any; tone: string }[] = [
  { value: "cold", label: "Frio",  icon: Snowflake,   tone: "text-sky-500" },
  { value: "warm", label: "Morno", icon: Thermometer, tone: "text-amber-500" },
  { value: "hot",  label: "Quente",icon: Flame,       tone: "text-rose-500" },
];

const LEAD_SOURCES = ["Indicação", "Instagram", "Facebook", "Google Ads", "Site", "Evento", "Prospecção ativa", "Outro"] as const;

type ClientLite = { id: string; name: string; company: string | null };

function useClientsLite() {
  return useQuery({
    queryKey: ["clients-lite"],
    queryFn: async (): Promise<ClientLite[]> => {
      const { data, error } = await supabase.from("clients").select("id,name,company").order("name");
      if (error) throw error;
      return (data ?? []) as ClientLite[];
    },
  });
}

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
      return (data ?? []) as unknown as Lead[];
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
  const { data: stages = [] } = useQuery({ queryKey: stagesKey, queryFn: fetchStages });
  const { data: templates = [] } = useQuery({ queryKey: ["briefing_templates"], queryFn: fetchBriefingTemplates });
  const { data: clients = [] } = useClientsLite();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<string>("all");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [wonBanner, setWonBanner] = useState<Lead | null>(null);
  const searchParams = Route.useSearch();

  useEffect(() => {
    if (searchParams.new) {
      setModalOpen(true);
      navigate({ to: "/crm", search: {}, replace: true });
    }
  }, [searchParams.new, navigate]);

  const openLead = useMemo(() => leads.find(l => l.id === openLeadId) ?? null, [leads, openLeadId]);

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

  const firstStageId = stages[0]?.id ?? null;

  const byStage = useMemo(() => {
    const map = new Map<string, Lead[]>();
    stages.forEach(s => map.set(s.id, []));
    filtered.forEach(l => {
      const key = l.stage_id && map.has(l.stage_id) ? l.stage_id : firstStageId;
      if (key) map.get(key)?.push(l);
    });
    return map;
  }, [filtered, stages, firstStageId]);

  const stageById = useMemo(() => new Map(stages.map(s => [s.id, s])), [stages]);
  const isClosed = (l: Lead) => {
    const s = l.stage_id ? stageById.get(l.stage_id) : undefined;
    return !!s && (s.is_won || s.is_lost);
  };

  // KPIs
  const pipeline = leads.filter(l => !isClosed(l)).reduce((a, l) => a + Number(l.estimated_value ?? 0), 0);
  const wonLeads = leads.filter(l => l.stage_id && stageById.get(l.stage_id)?.is_won);
  const wonValue = wonLeads.reduce((a, l) => a + Number(l.estimated_value ?? 0), 0);
  const conversion = leads.length ? Math.round((wonLeads.length / leads.length) * 100) : 0;
  const weighted = leads
    .filter(l => !isClosed(l))
    .reduce((a, l) => a + Number(l.estimated_value ?? 0) * (Number(l.probability ?? 0) / 100), 0);

  // Mutations
  const updateLead = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, any> }) => {
      const { error } = await supabase.from("leads").update(values as any).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, values }) => {
      await qc.cancelQueries({ queryKey: leadsKey });
      const prev = qc.getQueryData<Lead[]>(leadsKey);
      qc.setQueryData<Lead[]>(leadsKey, (old = []) => old.map(l => (l.id === id ? { ...l, ...values } : l)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(leadsKey, ctx.prev);
      toast.error("Não deu para salvar o lead");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: leadsKey }),
  });

  const moveToStage = (lead: Lead, stage: PipelineStage) => {
    updateLead.mutate({
      id: lead.id,
      values: {
        stage_id: stage.id,
        probability: stage.default_probability,
        entered_stage_at: new Date().toISOString(),
      },
    });
    if (stage.is_won) setWonBanner(lead);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragStart = (e: DragStartEvent) => setDragId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const overId = e.over?.id;
    if (!overId) return;
    const lead = leads.find(l => l.id === String(e.active.id));
    const stage = stages.find(s => s.id === String(overId));
    if (!lead || !stage || lead.stage_id === stage.id) return;
    moveToStage(lead, stage);
  };

  const dragging = dragId ? leads.find(l => l.id === dragId) ?? null : null;
  const currentIdx = openLead?.stage_id ? stages.findIndex(s => s.id === openLead.stage_id) : 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Prospecção
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Pipeline de vendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Arraste os cards entre as etapas. As etapas do funil são configuráveis em Configurações › Funil CRM.
          </p>
        </div>
        <Button className="rounded-full gap-2" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Novo lead
        </Button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Pipeline em aberto" value={brl(pipeline)} icon={TrendingUp} tone="text-blue-500" />
        <KpiCard label="Previsão ponderada" value={brl(weighted)} icon={Target} tone="text-violet-500" />
        <KpiCard label="Receita ganha" value={brl(wonValue)} icon={DollarSign} tone="text-emerald-500" />
        <KpiCard label="Taxa de conversão" value={`${conversion}%`} icon={CheckCircle2} tone="text-amber-500" />
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
      {isLoading || stages.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-96 rounded-3xl" />)}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
            {stages.map(stage => (
              <Column
                key={stage.id}
                stage={stage}
                leads={byStage.get(stage.id) ?? []}
                onOpen={l => setOpenLeadId(l.id)}
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
        stages={stages}
        templates={templates}
        clients={clients}
        onClose={() => setOpenLeadId(null)}
        onPatch={(values) => openLead && updateLead.mutate({ id: openLead.id, values })}
        onAdvance={dir => {
          if (!openLead) return;
          const next = stages[currentIdx + dir];
          if (!next) return;
          moveToStage(openLead, next);
        }}
        onCreateProposal={() => {
          if (!openLead) return;
          navigate({ to: "/proposals", search: { leadId: openLead.id } as any });
        }}
      />

      {/* Modal new lead */}
      <NewLeadModal open={modalOpen} onOpenChange={setModalOpen} segments={segments} stages={stages} templates={templates} clients={clients} />

      {/* Banner "ganho" → plano de marketing */}
      {wonBanner && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-elevated)]">
            <Sparkles className="h-5 w-5 text-primary" />
            <div className="text-sm">
              <p className="font-medium">Lead ganho: {wonBanner.name}</p>
              <p className="text-xs text-muted-foreground">Criar um Plano de Marketing para este cliente?</p>
            </div>
            <Button
              size="sm"
              className="rounded-full ml-2"
              onClick={() => {
                navigate({ to: "/marketing-plans", search: { leadId: wonBanner.id } as any });
                setWonBanner(null);
              }}
            >
              Criar plano
            </Button>
            <button
              onClick={() => setWonBanner(null)}
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
  stage: PipelineStage;
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
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: stage.color }} />
          <p className="text-sm font-semibold truncate">{stage.name}</p>
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
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : 1 }} className="group">
      <div className="flex items-stretch gap-1">
        <button
          {...attributes}
          {...listeners}
          className="grid w-5 place-items-center rounded-l-2xl text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
          aria-label="Arrastar"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={() => onOpen(lead)} className="flex-1 text-left min-w-0">
          <LeadCard lead={lead} />
        </button>
      </div>
    </div>
  );
}

function TemperatureIcon({ value }: { value: Temperature | null }) {
  const t = TEMPERATURES.find(t => t.value === value);
  if (!t) return null;
  const Icon = t.icon;
  return <Icon className={`h-3.5 w-3.5 ${t.tone}`} aria-label={t.label} />;
}

function LeadCard({ lead, dragging = false }: { lead: Lead; dragging?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-3 ${
        dragging ? "shadow-[var(--shadow-elevated)] rotate-1" : "hover:border-primary/40 transition-colors"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium truncate">{lead.name}</p>
        <TemperatureIcon value={lead.temperature} />
      </div>
      {lead.company && <p className="text-xs text-muted-foreground truncate">{lead.company}</p>}
      <div className="mt-2 flex items-center justify-between gap-2">
        {lead.segment ? (
          <Badge variant="outline" className="rounded-full text-[10px] font-normal">{lead.segment}</Badge>
        ) : <span />}
        {lead.estimated_value ? (
          <p className="text-xs font-semibold text-emerald-500 dark:text-emerald-400">
            {brl(Number(lead.estimated_value))}
          </p>
        ) : null}
      </div>
      {(lead.probability ?? 0) > 0 && (
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: `${lead.probability}%` }} />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">{lead.probability}%</span>
        </div>
      )}
    </div>
  );
}

// ---------- Drawer ----------
function LeadDrawer({
  lead, stages, templates, clients, onClose, onPatch, onAdvance, onCreateProposal,
}: {
  lead: Lead | null;
  stages: PipelineStage[];
  templates: BriefingTemplate[];
  clients: ClientLite[];
  onClose: () => void;
  onPatch: (values: Record<string, any>) => void;
  onAdvance: (dir: -1 | 1) => void;
  onCreateProposal: () => void;
}) {
  const qc = useQueryClient();
  const [activity, setActivity] = useState({ kind: "note", title: "", notes: "", due_date: "" });
  const [briefing, setBriefing] = useState<BriefingData>({});

  useEffect(() => { setBriefing((lead?.briefing as BriefingData) ?? {}); }, [lead?.id]);

  const { data: activities = [] } = useQuery({
    queryKey: ["lead_activities", lead?.id],
    enabled: !!lead,
    queryFn: async (): Promise<LeadActivity[]> => {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", lead!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LeadActivity[];
    },
  });

  const addActivity = useMutation({
    mutationFn: async () => {
      if (!lead) return;
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("lead_activities").insert({
        organization_id: lead.organization_id,
        lead_id: lead.id,
        kind: activity.kind,
        title: activity.title.trim(),
        notes: activity.notes.trim() || null,
        due_date: activity.due_date || null,
        created_by: userRes.user?.id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Interação registrada");
      setActivity({ kind: "note", title: "", notes: "", due_date: "" });
      qc.invalidateQueries({ queryKey: ["lead_activities", lead?.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao registrar"),
  });

  const toggleActivity = useMutation({
    mutationFn: async (a: LeadActivity) => {
      const { error } = await supabase.from("lead_activities")
        .update({ done: !a.done, done_at: a.done ? null : new Date().toISOString() } as any)
        .eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead_activities", lead?.id] }),
  });

  if (!lead) return null;
  const idx = Math.max(0, stages.findIndex(s => s.id === lead.stage_id));
  const stage = stages[idx];
  const briefingTemplates = templates.filter(t => t.template_type === "briefing");
  const template = briefingTemplates.find(t => t.id === lead.briefing_template_id) ?? null;

  return (
    <Sheet open={!!lead} onOpenChange={o => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
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
            {stages.map((s, i) => (
              <div
                key={s.id}
                className="h-1.5 flex-1 rounded-full"
                style={{ background: i <= idx ? s.color : "hsl(var(--muted))" }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <Badge className="rounded-full" style={{ background: stage?.color, color: "#fff" }}>
              {stage?.name ?? "—"}
            </Badge>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="rounded-full gap-1" disabled={idx === 0} onClick={() => onAdvance(-1)}>
                <ChevronLeft className="h-3.5 w-3.5" /> Voltar
              </Button>
              <Button size="sm" className="rounded-full gap-1" disabled={idx >= stages.length - 1} onClick={() => onAdvance(1)}>
                Avançar <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="info" className="mt-6">
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">Dados</TabsTrigger>
            <TabsTrigger value="briefing" className="flex-1">Briefing</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">Histórico</TabsTrigger>
          </TabsList>

          {/* --- Dados --- */}
          <TabsContent value="info" className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Temperatura</Label>
                <Select
                  value={lead.temperature ?? undefined}
                  onValueChange={v => onPatch({ temperature: v })}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Definir" /></SelectTrigger>
                  <SelectContent>
                    {TEMPERATURES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Probabilidade (%)</Label>
                <Input
                  type="number" min={0} max={100} className="mt-1"
                  defaultValue={lead.probability ?? 0}
                  onBlur={e => onPatch({ probability: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label className="text-xs">Valor estimado (R$)</Label>
                <Input
                  type="number" min={0} step={100} className="mt-1"
                  defaultValue={lead.estimated_value ?? ""}
                  onBlur={e => onPatch({ estimated_value: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div>
                <Label className="text-xs">Fechamento previsto</Label>
                <Input
                  type="date" className="mt-1"
                  defaultValue={lead.expected_close_date ?? ""}
                  onBlur={e => onPatch({ expected_close_date: e.target.value || null })}
                />
              </div>
            </div>

            <InfoRow icon={User} label="Responsável" value={lead.owner_id ? "Atribuído" : "Sem responsável"} />
            <InfoRow icon={Building2} label="Empresa" value={lead.company ?? "—"} />
            <InfoRow icon={Mail} label="Email" value={lead.email ?? "—"} />
            <InfoRow icon={Phone} label="Telefone" value={lead.phone ?? "—"} />
            <InfoRow icon={Tag} label="Segmento" value={lead.segment ?? "—"} />
            <InfoRow icon={FileText} label="Origem" value={lead.source ?? "—"} />

            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea
                rows={3} className="mt-1"
                defaultValue={lead.notes ?? ""}
                onBlur={e => onPatch({ notes: e.target.value || null })}
              />
            </div>

            <Button className="w-full rounded-full gap-2" onClick={onCreateProposal}>
              <FileText className="h-4 w-4" /> Criar proposta
            </Button>
          </TabsContent>

          {/* --- Briefing --- */}
          <TabsContent value="briefing" className="mt-4 space-y-4">
            <div>
              <Label className="text-xs">Modelo de briefing</Label>
              <Select
                value={lead.briefing_template_id ?? undefined}
                onValueChange={v => onPatch({ briefing_template_id: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={briefingTemplates.length ? "Escolher modelo" : "Nenhum modelo cadastrado"} />
                </SelectTrigger>
                <SelectContent>
                  {briefingTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {template ? (
              <>
                <BriefingForm template={template} data={briefing} onChange={setBriefing} />
                <Button className="w-full rounded-full" onClick={() => onPatch({ briefing })}>
                  Salvar briefing
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Escolha um modelo para preencher o briefing. Crie modelos em Configurações › Modelos de Briefing.
              </p>
            )}
          </TabsContent>

          {/* --- Histórico --- */}
          <TabsContent value="history" className="mt-4 space-y-4">
            <div className="rounded-2xl border border-border p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Select value={activity.kind} onValueChange={v => setActivity({ ...activity, kind: v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_KINDS.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input
                  type="date" className="h-9"
                  value={activity.due_date}
                  onChange={e => setActivity({ ...activity, due_date: e.target.value })}
                />
              </div>
              <Input
                placeholder="Título da interação"
                className="h-9"
                value={activity.title}
                onChange={e => setActivity({ ...activity, title: e.target.value })}
              />
              <Textarea
                rows={2} placeholder="Detalhes"
                value={activity.notes}
                onChange={e => setActivity({ ...activity, notes: e.target.value })}
              />
              <div className="flex justify-end">
                <Button
                  size="sm" className="rounded-full"
                  disabled={!activity.title.trim() || addActivity.isPending}
                  onClick={() => addActivity.mutate()}
                >
                  Registrar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {activities.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma interação registrada ainda.</p>
              )}
              {activities.map(a => (
                <div key={a.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-3">
                  <button
                    onClick={() => toggleActivity.mutate(a)}
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                      a.done ? "border-emerald-500 text-emerald-500" : "border-border text-muted-foreground"
                    }`}
                    aria-label={a.done ? "Reabrir" : "Concluir"}
                  >
                    {a.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium truncate ${a.done ? "line-through text-muted-foreground" : ""}`}>
                        {a.title}
                      </p>
                      <Badge variant="secondary" className="text-[10px]">
                        {ACTIVITY_KINDS.find(k => k.value === a.kind)?.label ?? a.kind}
                      </Badge>
                    </div>
                    {a.notes && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.notes}</p>}
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      {a.due_date
                        ? new Date(a.due_date + "T00:00:00").toLocaleDateString("pt-BR")
                        : new Date(a.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
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
  open, onOpenChange, segments, stages, templates,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  segments: string[];
  stages: PipelineStage[];
  templates: BriefingTemplate[];
}) {
  const qc = useQueryClient();
  const empty = {
    name: "", company: "", email: "", phone: "",
    segment: "", estimated_value: "", stage_id: "", source: "",
    temperature: "warm" as Temperature, briefing_template_id: "",
  };
  const [form, setForm] = useState(empty);
  const [briefing, setBriefing] = useState<BriefingData>({});

  useEffect(() => {
    if (open && !form.stage_id && stages[0]) setForm(f => ({ ...f, stage_id: stages[0].id }));
  }, [open, stages]);

  const briefingTemplates = templates.filter(t => t.template_type === "briefing");
  const template = briefingTemplates.find(t => t.id === form.briefing_template_id) ?? null;

  const create = useMutation({
    mutationFn: async () => {
      const org = await currentOrgId();
      const stage = stages.find(s => s.id === form.stage_id);
      const { error } = await supabase.from("leads").insert({
        organization_id: org,
        name: form.name.trim(),
        company: form.company.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        segment: form.segment.trim() || null,
        source: form.source.trim() || null,
        estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
        stage_id: form.stage_id || null,
        probability: stage?.default_probability ?? 0,
        temperature: form.temperature,
        briefing_template_id: form.briefing_template_id || null,
        briefing,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead criado");
      qc.invalidateQueries({ queryKey: leadsKey });
      onOpenChange(false);
      setForm({ ...empty, stage_id: stages[0]?.id ?? "" });
      setBriefing({});
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar lead"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
          <DialogDescription>Cadastre o contato e, se quiser, já preencha o briefing inicial.</DialogDescription>
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
          <Field label="Etapa inicial">
            <Select value={form.stage_id} onValueChange={v => setForm({ ...form, stage_id: v })}>
              <SelectTrigger><SelectValue placeholder="Etapa" /></SelectTrigger>
              <SelectContent>
                {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Temperatura">
            <Select value={form.temperature} onValueChange={v => setForm({ ...form, temperature: v as Temperature })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPERATURES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Modelo de briefing" className="col-span-2">
            <Select
              value={form.briefing_template_id || undefined}
              onValueChange={v => setForm({ ...form, briefing_template_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder={briefingTemplates.length ? "Opcional — escolher modelo" : "Nenhum modelo cadastrado"} />
              </SelectTrigger>
              <SelectContent>
                {briefingTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {template && (
          <div className="border-t border-border pt-4">
            <BriefingForm template={template} data={briefing} onChange={setBriefing} />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={!form.name.trim() || create.isPending}>
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
      <p className="mt-2 font-display text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
