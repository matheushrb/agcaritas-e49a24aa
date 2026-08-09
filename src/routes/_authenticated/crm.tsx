import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
import { LeadMeetingsTab } from "@/components/crm/lead-meetings-tab";
import { LeadOrgTab } from "@/components/crm/lead-org-tab";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search, Plus, ChevronLeft, ChevronRight, FileText, Building2, Mail,
  Phone, Tag, DollarSign, User, GripVertical, TrendingUp, Target,
  Sparkles, X, Flame, Snowflake, Thermometer, CalendarDays, CheckCircle2, Clock, Trash2,
  Send, Inbox,
} from "lucide-react";
import "@/windows.css";
import { toast } from "sonner";
import { BriefingForm } from "@/components/briefing-form";
import {
  fetchBriefingTemplates, type BriefingData, type BriefingTemplate,
} from "@/lib/briefing";
import { useTaskTypes, type TaskTypeRow } from "@/lib/task-types";
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
  service_type_id: string | null;
  next_contact_at: string | null;
  we_approached: boolean | null;
  scope_items: ScopeItem[];
  sectors: string[];
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
const LEAD_SEGMENTS = ["Saúde", "Moda", "Imóveis", "Alimentação", "Educação", "Varejo", "Serviços", "Outro"] as const;

type ClientLite = { id: string; name: string; company: string | null };
type ServiceTypeLite = { id: string; name: string; color: string };
type MemberLite = { id: string; display_name: string | null; full_name: string | null };
type ScopeItem = { task_type_id: string | null; title: string; qty: number; unit_price: number; billing_model: string | null };

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

function useProjectTypesLite() {
  return useQuery({
    queryKey: ["project-types-lite"],
    queryFn: async (): Promise<ServiceTypeLite[]> => {
      const { data, error } = await supabase
        .from("project_types").select("id,name,color").eq("active", true).order("sort_order");
      if (error) throw error;
      return (data ?? []) as ServiceTypeLite[];
    },
  });
}

function useTeamMembersLite() {
  return useQuery({
    queryKey: ["team-members-lite"],
    queryFn: async (): Promise<MemberLite[]> => {
      const { data, error } = await supabase
        .from("profiles").select("id,display_name,full_name").order("display_name");
      if (error) throw error;
      return (data ?? []) as MemberLite[];
    },
  });
}

const memberLabel = (m: MemberLite) => m.display_name ?? m.full_name ?? "Sem nome";

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
  const { data: serviceTypes = [] } = useProjectTypesLite();
  const { data: teamMembers = [] } = useTeamMembersLite();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const serviceTypeById = useMemo(() => new Map(serviceTypes.map(s => [s.id, s])), [serviceTypes]);

  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<string>("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");
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
    () => Array.from(new Set([
      ...LEAD_SEGMENTS,
      ...(leads.map(l => l.segment).filter(Boolean) as string[]),
    ])).sort(),
    [leads],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter(l => {
      if (segment !== "all" && l.segment !== segment) return false;
      if (serviceTypeFilter !== "all" && l.service_type_id !== serviceTypeFilter) return false;
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        (l.company ?? "").toLowerCase().includes(q) ||
        (l.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, query, segment, serviceTypeFilter]);

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

  const createClientFromLead = useMutation({
    mutationFn: async (lead: Lead) => {
      const org = await currentOrgId();
      const { data, error } = await supabase
        .from("clients")
        .insert({
          organization_id: org,
          name: lead.company || lead.name,
          segment: lead.segment,
          email: lead.email,
          phone: lead.phone,
          contact_name: lead.name,
          contact_email: lead.email,
          contact_phone: lead.phone,
        })
        .select("id")
        .single();
      if (error) throw error;
      return { clientId: data.id as string, leadId: lead.id };
    },
    onSuccess: ({ clientId, leadId }) => {
      updateLead.mutate({ id: leadId, values: { client_id: clientId } });
      qc.invalidateQueries({ queryKey: ["clients-list"] });
      toast.success("Cliente criado e vinculado ao lead");
      setWonBanner(b => (b ? { ...b, client_id: clientId } : b));
    },
    onError: (e: Error) => toast.error(e.message),
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
        <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
          <SelectTrigger className="w-[200px] rounded-full">
            <SelectValue placeholder="Tipo de serviço" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os serviços</SelectItem>
            {serviceTypes.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
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
                serviceTypeById={serviceTypeById}
                onOpen={l => setOpenLeadId(l.id)}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {dragging ? (
              <LeadCard
                lead={dragging}
                serviceType={(dragging.service_type_id && serviceTypeById.get(dragging.service_type_id)) || null}
                dragging
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Drawer */}
      <LeadDrawer
        lead={openLead}
        stages={stages}
        templates={templates}
        clients={clients}
        segments={segments}
        serviceTypes={serviceTypes}
        teamMembers={teamMembers}
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
      <NewLeadModal open={modalOpen} onOpenChange={setModalOpen} segments={segments} stages={stages} templates={templates} clients={clients} serviceTypes={serviceTypes} teamMembers={teamMembers} />

      {/* Banner "ganho" → plano de marketing */}
      {wonBanner && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-elevated)]">
            <Sparkles className="h-5 w-5 text-primary" />
            <div className="text-sm">
              <p className="font-medium">Lead ganho: {wonBanner.name}</p>
              <p className="text-xs text-muted-foreground">Criar um Plano de Marketing para este cliente?</p>
            </div>
            {!wonBanner.client_id && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full ml-2"
                disabled={createClientFromLead.isPending}
                onClick={() => createClientFromLead.mutate(wonBanner)}
              >
                Criar cliente
              </Button>
            )}
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
  stage, leads, serviceTypeById, onOpen,
}: {
  stage: PipelineStage;
  leads: Lead[];
  serviceTypeById: Map<string, ServiceTypeLite>;
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
          <DraggableCard
            key={l.id}
            lead={l}
            serviceType={(l.service_type_id && serviceTypeById.get(l.service_type_id)) || null}
            onOpen={onOpen}
          />
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

function DraggableCard({ lead, serviceType, onOpen }: { lead: Lead; serviceType: ServiceTypeLite | null; onOpen: (l: Lead) => void }) {
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
          <LeadCard lead={lead} serviceType={serviceType} />
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

function LeadCard({ lead, serviceType = null, dragging = false }: { lead: Lead; serviceType?: ServiceTypeLite | null; dragging?: boolean }) {
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
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {lead.segment ? (
            <Badge variant="outline" className="rounded-full text-[10px] font-normal">{lead.segment}</Badge>
          ) : null}
          {serviceType ? (
            <Badge variant="outline" className="rounded-full text-[10px] font-normal gap-1">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: serviceType.color }} />
              {serviceType.name}
            </Badge>
          ) : null}
        </div>
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
  lead, stages, templates, clients, segments, serviceTypes, teamMembers, onClose, onPatch, onAdvance, onCreateProposal,
}: {
  lead: Lead | null;
  stages: PipelineStage[];
  templates: BriefingTemplate[];
  clients: ClientLite[];
  segments: string[];
  serviceTypes: ServiceTypeLite[];
  teamMembers: MemberLite[];
  onClose: () => void;
  onPatch: (values: Record<string, any>) => void;
  onAdvance: (dir: -1 | 1) => void;
  onCreateProposal: () => void;
}) {
  const qc = useQueryClient();
  const { data: taskTypes = [] } = useTaskTypes();
  const [activity, setActivity] = useState({ kind: "note", title: "", notes: "", due_date: "" });
  const [briefing, setBriefing] = useState<BriefingData>({});
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([]);

  useEffect(() => { setBriefing((lead?.briefing as BriefingData) ?? {}); }, [lead?.id]);
  useEffect(() => { setScopeItems((lead?.scope_items as ScopeItem[]) ?? []); }, [lead?.id]);

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
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
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
            <TabsTrigger value="meetings" className="flex-1">Reuniões</TabsTrigger>
            <TabsTrigger value="org" className="flex-1">Organização</TabsTrigger>
            <TabsTrigger value="plan" className="flex-1">Plano de ação</TabsTrigger>
            <TabsTrigger value="history" className="flex-1">Histórico</TabsTrigger>
          </TabsList>

          {/* --- Dados --- */}
          <TabsContent value="info" className="mt-4 space-y-3">
            <div className="cw">
              <div className="cw-grid cw-grid-2">
                <button type="button" className={`cw-choice${lead.we_approached === true ? " is-on" : ""}`} onClick={() => onPatch({ we_approached: true })}>
                  <span className="cw-choice-title"><Send size={15} /> Nós abordamos</span>
                  <span className="cw-choice-desc">Prospecção ativa da agência</span>
                </button>
                <button type="button" className={`cw-choice${lead.we_approached === false ? " is-on" : ""}`} onClick={() => onPatch({ we_approached: false })}>
                  <span className="cw-choice-title"><Inbox size={15} /> Fomos abordados</span>
                  <span className="cw-choice-desc">O lead chegou até nós</span>
                </button>
              </div>
            </div>
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

                <Label className="text-xs">Fechamento previsto</Label>
                <Input
                  type="date" className="mt-1"
                  defaultValue={lead.expected_close_date ?? ""}
                  onBlur={e => onPatch({ expected_close_date: e.target.value || null })}
                />
              </div>
              <div>
                <Label className="text-xs">Próximo contato previsto</Label>
                <Input
                  type="date" className="mt-1"
                  defaultValue={lead.next_contact_at ?? ""}
                  onBlur={e => onPatch({ next_contact_at: e.target.value || null })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <ScopeBuilder items={scopeItems} onChange={setScopeItems} taskTypes={taskTypes} />
              <Button
                variant="outline"
                className="w-full rounded-full"
                onClick={() => onPatch({
                  scope_items: scopeItems.filter(i => i.title.trim()),
                  estimated_value: scopeItems.reduce((a, i) => a + Number(i.qty || 0) * Number(i.unit_price || 0), 0),
                })}
              >
                Salvar escopo
              </Button>
            </div>


            <div>
              <Label className="text-xs flex items-center gap-1.5"><User className="size-3.5" />Responsável</Label>
              <Select
                value={lead.owner_id ?? "none"}
                onValueChange={v => onPatch({ owner_id: v === "none" ? null : v })}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{memberLabel(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <InfoRow icon={Building2} label="Empresa" value={lead.company ?? "—"} />
            <InfoRow icon={Mail} label="Email" value={lead.email ?? "—"} />
            <InfoRow icon={Phone} label="Telefone" value={lead.phone ?? "—"} />

            <div>
              <Label className="text-xs flex items-center gap-1.5"><Tag className="size-3.5" />Segmento</Label>
              <Select value={lead.segment ?? undefined} onValueChange={v => onPatch({ segment: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Definir segmento" /></SelectTrigger>
                <SelectContent>
                  {segments.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs flex items-center gap-1.5"><Sparkles className="size-3.5" />Tipo de serviço</Label>
              <Select
                value={lead.service_type_id ?? undefined}
                onValueChange={v => onPatch({ service_type_id: v })}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Definir tipo de serviço" /></SelectTrigger>
                <SelectContent>
                  {serviceTypes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs flex items-center gap-1.5"><FileText className="size-3.5" />Origem</Label>
              <Select value={lead.source ?? undefined} onValueChange={v => onPatch({ source: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Definir origem" /></SelectTrigger>
                <SelectContent>
                  {LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs flex items-center gap-1.5"><Building2 className="size-3.5" />Cliente vinculado</Label>
              <Select
                value={lead.client_id ?? "none"}
                onValueChange={v => onPatch({ client_id: v === "none" ? null : v })}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Nenhum cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum cliente</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>


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

          {/* --- Reuniões --- */}
          <TabsContent value="meetings" className="mt-4">
            <LeadMeetingsTab leadId={lead.id} organizationId={lead.organization_id} />
          </TabsContent>

          {/* --- Organização --- */}
          <TabsContent value="org" className="mt-4">
            <LeadOrgTab
              leadId={lead.id}
              organizationId={lead.organization_id}
              sectors={(lead.sectors as string[]) ?? []}
              onSectorsChange={(sectors) => onPatch({ sectors })}
            />
          </TabsContent>

          {/* --- Plano de ação --- */}
          <TabsContent value="plan" className="mt-4">
            <LeadPlanTab leadId={lead.id} leadName={lead.name} organizationId={lead.organization_id} />
          </TabsContent>


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

// ---------- Plano de ação ----------
function LeadPlanTab({ leadId, leadName, organizationId }: { leadId: string; leadName: string; organizationId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const key = ["strategic_plans", leadId];

  const { data: plan } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("strategic_plans")
        .select("id,name")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return (data?.[0] ?? null) as { id: string; name: string } | null;
    },
  });

  const createPlan = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any)
        .from("strategic_plans")
        .insert({
          organization_id: organizationId,
          lead_id: leadId,
          name: `Plano de ação — ${leadName}`,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["strategic_plans"] });
      navigate({ to: "/strategy/$planId", params: { planId: created.id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar plano"),
  });

  return (
    <div className="cw space-y-3">
      {plan ? (
        <div className="cw-card cw-card-pad flex items-center justify-between gap-3">
          <p className="truncate text-sm font-medium">{plan.name}</p>
          <Link to="/strategy/$planId" params={{ planId: plan.id }} className="cw-btn cw-btn-primary">
            Abrir plano de ação →
          </Link>
        </div>
      ) : (
        <div className="cw-card cw-card-pad space-y-3">
          <p className="text-sm text-muted-foreground">Este lead ainda não tem um plano de ação.</p>
          <button className="cw-btn cw-btn-primary" disabled={createPlan.isPending} onClick={() => createPlan.mutate()}>
            + Criar plano de ação
          </button>
        </div>
      )}
    </div>
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
  open, onOpenChange, segments, stages, templates, clients, serviceTypes, teamMembers,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  segments: string[];
  stages: PipelineStage[];
  templates: BriefingTemplate[];
  clients: ClientLite[];
  serviceTypes: ServiceTypeLite[];
  teamMembers: MemberLite[];
}) {
  const qc = useQueryClient();
  const { data: taskTypes = [] } = useTaskTypes();
  const empty = {
    name: "", company: "", email: "", phone: "",
    segment: "", stage_id: "", source: "", client_id: "",
    service_type_id: "", owner_id: "", next_contact_at: "",
    temperature: "warm" as Temperature, briefing_template_id: "",
    approach: "" as "" | "we" | "them",
  };
  const [form, setForm] = useState(empty);
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([]);
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
        client_id: form.client_id || null,
        service_type_id: form.service_type_id || null,
        owner_id: form.owner_id || null,
        next_contact_at: form.next_contact_at || null,
        we_approached: form.approach === "we" ? true : form.approach === "them" ? false : null,
        scope_items: scopeItems.filter(i => i.title.trim()),
        estimated_value: scopeItems.reduce((a, i) => a + Number(i.qty || 0) * Number(i.unit_price || 0), 0),
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
      setScopeItems([]);
      setBriefing({});
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar lead"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo lead</DialogTitle>
          <DialogDescription>Cadastre o contato e, se quiser, já preencha o briefing inicial.</DialogDescription>
        </DialogHeader>

        <div className="cw">
          <div className="cw-grid cw-grid-2">
            <button type="button" className={`cw-choice${form.approach === "we" ? " is-on" : ""}`} onClick={() => setForm({ ...form, approach: "we" })}>
              <span className="cw-choice-title"><Send size={15} /> Nós abordamos</span>
              <span className="cw-choice-desc">Prospecção ativa da agência</span>
            </button>
            <button type="button" className={`cw-choice${form.approach === "them" ? " is-on" : ""}`} onClick={() => setForm({ ...form, approach: "them" })}>
              <span className="cw-choice-title"><Inbox size={15} /> Fomos abordados</span>
              <span className="cw-choice-desc">O lead chegou até nós</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome*" className="col-span-2">
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Cliente vinculado">
            <Select
              value={form.client_id || "none"}
              onValueChange={v => setForm({ ...form, client_id: v === "none" ? "" : v })}
            >
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.company ? ` · ${c.company}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Empresa">
            <Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
          </Field>
          <Field label="Segmento">
            <Select value={form.segment || undefined} onValueChange={v => setForm({ ...form, segment: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar segmento" /></SelectTrigger>
              <SelectContent>
                {segments.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tipo de serviço *">
            <Select value={form.service_type_id || undefined} onValueChange={v => setForm({ ...form, service_type_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar tipo de serviço" /></SelectTrigger>
              <SelectContent>
                {serviceTypes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Responsável">
            <Select
              value={form.owner_id || "none"}
              onValueChange={v => setForm({ ...form, owner_id: v === "none" ? "" : v })}
            >
              <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem responsável</SelectItem>
                {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{memberLabel(m)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Próximo contato previsto">
            <Input
              type="date"
              value={form.next_contact_at}
              onChange={e => setForm({ ...form, next_contact_at: e.target.value })}
            />
          </Field>

          <Field label="Telefone">
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Origem">
            <Select value={form.source || undefined} onValueChange={v => setForm({ ...form, source: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar origem" /></SelectTrigger>
              <SelectContent>
                {LEAD_SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
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

        <ScopeBuilder items={scopeItems} onChange={setScopeItems} taskTypes={taskTypes} />



        {template && (
          <div className="border-t border-border pt-4">
            <BriefingForm template={template} data={briefing} onChange={setBriefing} />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={!form.name.trim() || !form.service_type_id || create.isPending}>
            {create.isPending ? "Salvando…" : "Salvar lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Escopo (itens de precificação) ----------
function ScopeBuilder({
  items, onChange, taskTypes,
}: { items: ScopeItem[]; onChange: (items: ScopeItem[]) => void; taskTypes: TaskTypeRow[] }) {
  const patch = (i: number, p: Partial<ScopeItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...p } : it)));
  const total = items.reduce((a, i) => a + Number(i.qty || 0) * Number(i.unit_price || 0), 0);

  return (
    <div className="rounded-2xl border border-border p-3 space-y-2">
      <Label className="text-xs">Escopo / itens</Label>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum item. Adicione serviços do catálogo ou um valor livre.</p>
      )}

      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-[1fr_70px_110px_36px] gap-2 items-center">
          {item.task_type_id !== null ? (
            <Select
              value={item.task_type_id || undefined}
              onValueChange={v => {
                const t = taskTypes.find(tt => tt.id === v);
                patch(i, {
                  task_type_id: v,
                  title: t?.name ?? "",
                  unit_price: t?.default_price ?? 0,
                  billing_model: t?.default_billing_model ?? null,
                });
              }}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar serviço" /></SelectTrigger>
              <SelectContent>
                {taskTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="h-9"
              placeholder="Descrição do item"
              value={item.title}
              onChange={e => patch(i, { title: e.target.value })}
            />
          )}
          <Input
            className="h-9" type="number" min={0} step="1"
            value={item.qty}
            onChange={e => patch(i, { qty: Number(e.target.value) || 0 })}
          />
          <Input
            className="h-9" type="number" min={0} step="0.01"
            value={item.unit_price}
            onChange={e => patch(i, { unit_price: Number(e.target.value) || 0 })}
          />
          <Button variant="ghost" size="icon" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          variant="outline" size="sm" className="rounded-full"
          onClick={() => onChange([...items, { task_type_id: "", title: "", qty: 1, unit_price: 0, billing_model: null }])}
        >
          <Plus className="size-3.5 mr-1" /> Adicionar item do catálogo
        </Button>
        <Button
          variant="outline" size="sm" className="rounded-full"
          onClick={() => onChange([...items, { task_type_id: null, title: "", qty: 1, unit_price: 0, billing_model: null }])}
        >
          <Plus className="size-3.5 mr-1" /> Valor livre
        </Button>
      </div>

      <div className="flex justify-between border-t border-border pt-2 text-sm">
        <span className="text-muted-foreground">Total</span>
        <span className="font-semibold tabular-nums">{brl(total)}</span>
      </div>
    </div>
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
