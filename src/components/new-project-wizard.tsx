import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  X, ChevronDown, ChevronRight, ChevronLeft, Check, Info, Plus, Pencil, Trash2,
  Clock, GripVertical, Save, FolderKanban, Users, DollarSign, ClipboardCheck,
  CalendarDays, Flag, Zap, FileText, RefreshCcw, CircleDollarSign, Search,
} from "lucide-react";
import "@/windows.css";

/* ============================================================
   Tipos
   ============================================================ */
export type ProjectStage = { id: string; name: string; description: string; duration: string; color: string };
export type ProjectParticipant = {
  id: string; user_id: string | null; name: string; role: string;
  department: string; permission: "admin" | "editor" | "collaborator" | "viewer"; load: string;
};

export type ProjectWizardValue = {
  /* Etapa 1 */
  name: string;
  client_id: string | null;
  description: string;
  project_type: string;
  initial_status: "planning" | "active" | "paused";
  owner_id: string | null;
  cost_center: string;
  create_default_tasks: boolean;
  /* Etapa 2 */
  start_date: string | null;
  end_date: string | null;
  urgency: "low" | "medium" | "high" | "critical";
  recurring: boolean;
  initial_progress: number;
  stages: ProjectStage[];
  /* Etapa 3 */
  creative_lead_id: string | null;
  client_contact: string;
  participants: ProjectParticipant[];
  notify_members: boolean;
  allow_finance_view: boolean;
  /* Etapa 4 */
  billing_model: "per_task" | "fixed" | "contract" | "monthly";
  fixed_value: number | null;
  bill_per_task_default: boolean;
  bill_per_deliverable: boolean;
  use_task_type_value: boolean;
  allow_value_override: boolean;
  finance_owner_id: string | null;
  payment_terms: string;
  due_days: string;
  finance_notes: string;
  /* Escopo complementar (preservado do fluxo anterior) */
  social_platforms: string[];
  tools: string[];
  strategy_enabled: boolean;
  scope_flags: {
    swot: boolean; personas: boolean; competitors: boolean;
    roadmap: boolean; kpis: boolean; action_plan: boolean;
  };
  traffic_budget: { enabled: boolean; amount: number | null; platforms: string[] } | null;
  other_budgets: { label: string; amount: number }[];
};

type CatalogItem = { id: string; name: string; slug: string | null; color: string | null; icon: string | null; category?: string | null; base_tasks?: any };
type Person = { id: string; full_name: string; display_name: string | null; role_title: string | null };

const STAGE_COLORS = ["#1769F6", "#16A34A", "#7C3AED", "#F97316", "#0EA5E9", "#EC4899"];

const BILLING_OPTIONS = [
  { value: "per_task", label: "Por tarefa", desc: "A receita será formada pelas tarefas e entregáveis faturáveis do projeto.", icon: Zap },
  { value: "fixed", label: "Valor fixo", desc: "Um valor fechado para todo o projeto.", icon: CircleDollarSign },
  { value: "contract", label: "Contrato / Proposta", desc: "Vinculado a uma proposta ou contrato comercial.", icon: FileText },
  { value: "monthly", label: "Recorrente mensal", desc: "Cobrança recorrente em ciclos mensais.", icon: RefreshCcw },
] as const;

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Urgente" },
];

const STRATEGY_ITEMS: { key: keyof ProjectWizardValue["scope_flags"]; label: string }[] = [
  { key: "swot", label: "Análise SWOT" },
  { key: "personas", label: "Personas" },
  { key: "competitors", label: "Concorrentes" },
  { key: "roadmap", label: "Roadmap" },
  { key: "kpis", label: "KPIs & Metas" },
  { key: "action_plan", label: "Plano de ação" },
];

const STEPS = [
  { id: 1, title: "Informações básicas", desc: "Dados principais do projeto", icon: FolderKanban },
  { id: 2, title: "Prazos e planejamento", desc: "Datas, prazos e etapas", icon: CalendarDays },
  { id: 3, title: "Equipe", desc: "Responsáveis e participantes", icon: Users },
  { id: 4, title: "Financeiro", desc: "Custos, receitas e condições", icon: DollarSign },
  { id: 5, title: "Revisão", desc: "Confirme os dados do projeto", icon: ClipboardCheck },
];

export const defaultProjectWizardValue: ProjectWizardValue = {
  name: "", client_id: null, description: "", project_type: "",
  initial_status: "active", owner_id: null, cost_center: "", create_default_tasks: true,
  start_date: null, end_date: null, urgency: "medium", recurring: false,
  initial_progress: 0, stages: [],
  creative_lead_id: null, client_contact: "", participants: [],
  notify_members: true, allow_finance_view: true,
  billing_model: "per_task", fixed_value: null,
  bill_per_task_default: true, bill_per_deliverable: true,
  use_task_type_value: false, allow_value_override: true,
  finance_owner_id: null, payment_terms: "30 dias", due_days: "30 dias", finance_notes: "",
  social_platforms: [], tools: [], strategy_enabled: false,
  scope_flags: { swot: false, personas: false, competitors: false, roadmap: false, kpis: false, action_plan: false },
  traffic_budget: { enabled: false, amount: null, platforms: [] },
  other_budgets: [],
};

const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR") : "—");

/* ============================================================
   Componente principal
   ============================================================ */
export function NewProjectWizard({
  open, onOpenChange, clients, onCreate, pending, onSaveDraft,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clients: { id: string; name: string }[];
  onCreate: (v: ProjectWizardValue) => void;
  pending: boolean;
  onSaveDraft?: (v: ProjectWizardValue) => void;
}) {
  const [step, setStep] = useState(1);
  const [v, setV] = useState<ProjectWizardValue>(defaultProjectWizardValue);
  const [touched, setTouched] = useState(false);

  const { data: projectTypes = [] } = useQuery({
    queryKey: ["project_types"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("project_types").select("*").eq("active", true).order("sort_order");
      return (data ?? []) as CatalogItem[];
    },
  });
  const { data: platforms = [] } = useQuery({
    queryKey: ["platforms"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("platforms").select("*").eq("active", true).order("sort_order");
      return (data ?? []) as CatalogItem[];
    },
  });
  const { data: taskTypes = [] } = useQuery({
    queryKey: ["task_types_min"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("task_types").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const { data: people = [] } = useQuery({
    queryKey: ["profiles_people"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,display_name,role_title").order("full_name");
      return (data ?? []) as Person[];
    },
  });

  const typeOptions = projectTypes.map(t => ({ value: t.id, label: t.name, raw: t }));
  const selectedType = typeOptions.find(t => t.value === v.project_type);
  const personName = (id: string | null) => people.find(p => p.id === id)?.display_name || people.find(p => p.id === id)?.full_name || "—";
  const clientName = clients.find(c => c.id === v.client_id)?.name ?? "—";

  const patch = <K extends keyof ProjectWizardValue>(k: K, val: ProjectWizardValue[K]) => {
    setTouched(true);
    setV(p => ({ ...p, [k]: val }));
  };

  const reset = () => { setStep(1); setV(defaultProjectWizardValue); setTouched(false); };
  const handleOpen = (o: boolean) => { onOpenChange(o); if (!o) reset(); };
  const requestClose = () => {
    if (touched && !window.confirm("Existem alterações não salvas. Deseja fechar mesmo assim?")) return;
    handleOpen(false);
  };

  /* Carrega etapas do tipo de projeto selecionado */
  const applyTypeStages = (typeValue: string) => {
    const t = typeOptions.find(o => o.value === typeValue)?.raw;
    const base = Array.isArray(t?.base_tasks) ? (t!.base_tasks as any[]) : [];
    const stages: ProjectStage[] = base.map((b: any, i: number) => ({
      id: `s-${i}-${Math.random().toString(36).slice(2, 7)}`,
      name: typeof b === "string"
        ? b
        : (b?.name ?? b?.title ?? taskTypes.find(t => t.id === b?.task_type_id)?.name ?? `Etapa ${i + 1}`),
      description: typeof b === "string" ? "" : (b?.description ?? ""),
      duration: typeof b === "string" ? "1 dia" : (b?.duration ?? "1 dia"),
      color: STAGE_COLORS[i % STAGE_COLORS.length],
    }));
    const typePlatformIds: string[] = Array.isArray(t?.platform_ids) ? (t!.platform_ids as string[]) : [];
    const typePlatformNames = typePlatformIds
      .map(id => (platforms as any[]).find(p => p.id === id)?.name)
      .filter(Boolean) as string[];
    setV(p => ({
      ...p,
      project_type: typeValue,
      stages: stages.length ? stages : p.stages,
      social_platforms: typePlatformNames.length
        ? Array.from(new Set([...p.social_platforms, ...typePlatformNames]))
        : p.social_platforms,
    }));
    setTouched(true);
  };


  const errors = {
    name: !v.name.trim(),
    client: !v.client_id,
    type: !v.project_type,
    owner: !v.owner_id,
    dates: !v.start_date || !v.end_date,
  };
  const step1Ok = !errors.name && !errors.client && !errors.type && !errors.owner;
  const step2Ok = !errors.dates;
  const allOk = step1Ok && step2Ok;

  const canGo = (target: number) => {
    if (target <= step) return true;
    if (target >= 2 && !step1Ok) return false;
    if (target >= 3 && !step2Ok) return false;
    return true;
  };
  const next = () => setStep(s => Math.min(5, s + 1));
  const back = () => setStep(s => Math.max(1, s - 1));

  const nextDisabled = (step === 1 && !step1Ok) || (step === 2 && !step2Ok);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent
        className="cw p-0 gap-0 border-0 overflow-hidden [&>button:last-of-type]:hidden w-[calc(100vw-2rem)] max-w-[1105px] sm:max-w-[1105px]"
        style={{ borderRadius: 14, boxShadow: "0 24px 60px rgba(15,25,40,.20)" }}
      >
        <div className="cw-window">
          {/* HEADER */}
          <div className="cw-header">
            <div className="min-w-0 flex-1">
              <DialogTitle asChild><h2>Novo Projeto</h2></DialogTitle>
              <p>Crie um novo projeto em 5 etapas simples</p>
            </div>
            <button type="button" className="cw-close" onClick={requestClose} aria-label="Fechar"><X size={18} /></button>
          </div>

          <div className="cw-body">
            {/* STEPPER */}
            <div className="cw-stepper">
              {STEPS.map((s, i) => {
                const active = s.id === step;
                const done = s.id < step;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!canGo(s.id)}
                    onClick={() => canGo(s.id) && setStep(s.id)}
                    className={`cw-step${active ? " is-active" : ""}${done ? " is-done" : ""}`}
                  >
                    {i < STEPS.length - 1 && <span className="cw-step-line" />}
                    <span className="cw-step-num">{done ? <Check size={13} /> : s.id}</span>
                    <span className="min-w-0">
                      <span className="cw-step-title block">{s.title}</span>
                      <span className="cw-step-desc block">{s.desc}</span>
                    </span>
                  </button>
                );
              })}
              <div className="cw-help">
                <Info size={15} style={{ color: "var(--cw-cobalt)", flexShrink: 0 }} />
                <div>
                  <strong>Precisando de ajuda?</strong>
                  <span>Você pode salvar o rascunho e continuar depois.</span>
                </div>
              </div>
            </div>

            {/* CONTEÚDO */}
            <div className="cw-content">
              {step === 1 && (
                <StepBasics
                  v={v} patch={patch} errors={errors} clients={clients}
                  typeOptions={typeOptions} people={people} applyTypeStages={applyTypeStages}
                  platforms={platforms}
                />

              )}
              {step === 2 && <StepPlanning v={v} patch={patch} errors={errors} selectedTypeLabel={selectedType?.label ?? null} />}
              {step === 3 && <StepTeam v={v} patch={patch} people={people} />}
              {step === 4 && <StepFinance v={v} patch={patch} people={people} platforms={platforms} />}
              {step === 5 && (
                <StepReview
                  v={v} allOk={allOk} goTo={setStep}
                  clientName={clientName} typeLabel={selectedType?.label ?? "—"} personName={personName}
                />
              )}
            </div>
          </div>

          {/* RODAPÉ */}
          <div className="cw-footer">
            <div className="cw-foot-group">
              <button type="button" className="cw-btn cw-btn-secondary" onClick={requestClose}>Cancelar</button>
              {step > 1 && onSaveDraft && (
                <button type="button" className="cw-btn cw-btn-secondary" onClick={() => onSaveDraft(v)}>
                  <Save /> Salvar rascunho
                </button>
              )}
            </div>
            <div className="cw-foot-group">
              <button type="button" className="cw-btn cw-btn-secondary" onClick={back} disabled={step === 1}>
                <ChevronLeft /> Voltar
              </button>
              {step < 5 ? (
                <button type="button" className="cw-btn cw-btn-primary" onClick={next} disabled={nextDisabled}>
                  Continuar <ChevronRight />
                </button>
              ) : (
                <button type="button" className="cw-btn cw-btn-primary" disabled={pending || !allOk} onClick={() => onCreate(v)}>
                  {pending ? "Criando…" : "Criar projeto"} <Check />
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   Primitivos
   ============================================================ */
function Field({ label, required, hint, error, children, className = "" }: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`cw-field ${className}`}>
      <span className="cw-label">{label}{required && <span className="req">*</span>}</span>
      {children}
      {error ? <span className="cw-error">{error}</span> : hint ? <span className="cw-hint">{hint}</span> : null}
    </div>
  );
}

function Sel({ value, onChange, children, invalid }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; invalid?: boolean;
}) {
  return (
    <div className="cw-select-wrap">
      <select className={`cw-select${invalid ? " is-error" : ""}`} value={value} onChange={e => onChange(e.target.value)}>
        {children}
      </select>
      <ChevronDown />
    </div>
  );
}

function Switch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return <button type="button" role="switch" aria-checked={on} className={`cw-switch${on ? " is-on" : ""}`} onClick={onToggle} />;
}

function SwitchRow({ title, desc, on, onToggle }: { title: string; desc?: string; on: boolean; onToggle: () => void }) {
  return (
    <div className="cw-switch-row">
      <div>
        <div className="cw-sw-title">{title}</div>
        {desc && <div className="cw-sw-desc">{desc}</div>}
      </div>
      <Switch on={on} onToggle={onToggle} />
    </div>
  );
}

type Patch = <K extends keyof ProjectWizardValue>(k: K, val: ProjectWizardValue[K]) => void;

/* ============================================================
   NP-01 — Informações básicas
   ============================================================ */
function StepBasics({ v, patch, errors, clients, typeOptions, people, applyTypeStages, platforms }: {
  v: ProjectWizardValue; patch: Patch; errors: Record<string, boolean>;
  clients: { id: string; name: string }[];
  typeOptions: { value: string; label: string }[];
  people: Person[];
  applyTypeStages: (t: string) => void;
  platforms: CatalogItem[];
}) {
  const togglePlatformName = (name: string) =>
    patch("social_platforms", v.social_platforms.includes(name)
      ? v.social_platforms.filter(x => x !== name)
      : [...v.social_platforms, name]);

  return (
    <>
      <h3>Informações básicas</h3>
      <p className="cw-sub">Preencha os dados principais do seu projeto.</p>

      <div className="cw-grid cw-grid-2">
        <Field label="Nome do projeto" required>
          <input
            className={`cw-input${errors.name ? " is-error" : ""}`}
            maxLength={100}
            autoFocus
            value={v.name}
            onChange={e => patch("name", e.target.value)}
            placeholder="Ex.: Reforma Clínica Odontológica"
          />
          <span className="cw-count">{v.name.length} / 100</span>
        </Field>

        <div className="cw-field">
          <span className="cw-label">Cliente<span className="req">*</span></span>
          <div className="cw-select-wrap">
            <Search style={{ position: "absolute", right: 32, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--cw-muted)", pointerEvents: "none" }} />
            <select
              className={`cw-select${errors.client ? " is-error" : ""}`}
              value={v.client_id ?? ""}
              onChange={e => patch("client_id", e.target.value || null)}
            >
              <option value="">Selecione ou busque o cliente</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown />
          </div>
          <div style={{ textAlign: "right" }}>
            <a className="cw-link" href="/clients" style={{ display: "inline-flex" }}>+ Novo cliente</a>
          </div>
        </div>

        <Field label="Tipo de projeto" required hint="Gerencie os tipos em Configurações → Tipos de Projeto.">
          <Sel value={v.project_type} onChange={applyTypeStages} invalid={errors.type}>
            <option value="">Selecione o tipo de projeto</option>
            {typeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Sel>
        </Field>

        <Field label="Status inicial" required>
          <Sel value={v.initial_status} onChange={val => patch("initial_status", val as ProjectWizardValue["initial_status"])}>
            <option value="active">Ativo</option>
            <option value="planning">Planejamento</option>
            <option value="paused">Pausado</option>
          </Sel>
        </Field>

        <div className="cw-field cw-span-2">
          <span className="cw-label">Descrição do projeto</span>
          <textarea
            className="cw-textarea"
            rows={4}
            maxLength={500}
            value={v.description}
            onChange={e => patch("description", e.target.value)}
            placeholder="Descreva o objetivo, escopo e observações importantes..."
          />
          <span className="cw-count">{v.description.length} / 500</span>
        </div>

        <Field label="Responsável principal" required>
          <Sel value={v.owner_id ?? ""} onChange={val => patch("owner_id", val || null)} invalid={errors.owner}>
            <option value="">Selecione o responsável</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.display_name || p.full_name}</option>)}
          </Sel>
        </Field>

        <Field label="Centro de custo">
          <input className="cw-input" value={v.cost_center} onChange={e => patch("cost_center", e.target.value)} placeholder="Selecione o centro de custo" />
        </Field>
      </div>

      <label className="flex items-center gap-2 mt-4" style={{ fontSize: 12 }}>
        <input type="checkbox" checked={v.create_default_tasks} onChange={e => patch("create_default_tasks", e.target.checked)} />
        Criar tarefas padrão para este projeto
      </label>

      <div className="cw-section">
        <div className="cw-section-head">
          <div>
            <h4>Plataformas do projeto</h4>
            <p>Selecione os canais em que a agência vai trabalhar. Eles filtram as plataformas das tarefas.</p>
          </div>
          {v.social_platforms.length > 0 && (
            <span className="cw-chip">{v.social_platforms.length} selecionada(s)</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {platforms.map(p => {
            const on = v.social_platforms.includes(p.name);
            return (
              <button key={p.id} type="button" className={`cw-chip${on ? "" : " is-neutral"}`}
                onClick={() => togglePlatformName(p.name)}>
                {on && <Check size={12} />} {p.name}
              </button>
            );
          })}
          {platforms.length === 0 && (
            <span style={{ fontSize: 11, color: "var(--cw-muted)" }}>Cadastre plataformas em Configurações → Plataformas.</span>
          )}
        </div>
      </div>


      <div className="cw-section">
        <div className="cw-section-head">
          <div>
            <h4>Escopo estratégico</h4>
            <p>Ative os blocos que serão liberados na aba Estratégia do projeto.</p>
          </div>
          <Switch on={v.strategy_enabled} onToggle={() => patch("strategy_enabled", !v.strategy_enabled)} />
        </div>
        {v.strategy_enabled && (
          <div className="flex flex-wrap gap-2">
            {STRATEGY_ITEMS.map(it => {
              const on = v.scope_flags[it.key];
              return (
                <button
                  key={it.key}
                  type="button"
                  className={`cw-chip${on ? "" : " is-neutral"}`}
                  onClick={() => patch("scope_flags", { ...v.scope_flags, [it.key]: !on })}
                >
                  {on && <Check size={12} />} {it.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/* ============================================================
   NP-02 — Prazos e planejamento
   ============================================================ */
function StepPlanning({ v, patch, errors, selectedTypeLabel }: {
  v: ProjectWizardValue; patch: Patch; errors: Record<string, boolean>; selectedTypeLabel: string | null;
}) {
  const [editing, setEditing] = useState<string | null>(null);

  const addStage = () => {
    patch("stages", [...v.stages, {
      id: `s-${Date.now()}`, name: "Nova etapa", description: "", duration: "1 dia",
      color: STAGE_COLORS[v.stages.length % STAGE_COLORS.length],
    }]);
  };
  const updStage = (id: string, p: Partial<ProjectStage>) =>
    patch("stages", v.stages.map(s => (s.id === id ? { ...s, ...p } : s)));
  const delStage = (id: string) => patch("stages", v.stages.filter(s => s.id !== id));

  return (
    <>
      <h3>Prazos e planejamento</h3>
      <p className="cw-sub">Defina as datas, prioridade e as etapas que compõem este projeto.</p>

      <div className="cw-grid cw-grid-4">
        <Field label="Data de início" required>
          <input type="date" className={`cw-input${errors.dates && !v.start_date ? " is-error" : ""}`}
            value={v.start_date ?? ""} onChange={e => patch("start_date", e.target.value || null)} />
        </Field>
        <Field label="Prazo final" required>
          <input type="date" className={`cw-input${errors.dates && !v.end_date ? " is-error" : ""}`}
            value={v.end_date ?? ""} onChange={e => patch("end_date", e.target.value || null)} />
        </Field>
        <Field label="Prioridade" required>
          <Sel value={v.urgency} onChange={val => patch("urgency", val as ProjectWizardValue["urgency"])}>
            {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Sel>
        </Field>
        <div className="cw-field">
          <span className="cw-label">Projeto recorrente</span>
          <div className="flex items-center gap-3" style={{ height: 42 }}>
            <Switch on={v.recurring} onToggle={() => patch("recurring", !v.recurring)} />
            <span style={{ fontSize: 12, color: "var(--cw-muted)" }}>{v.recurring ? "Sim" : "Não"}</span>
          </div>
        </div>

        <div className="cw-field cw-span-2">
          <span className="cw-label">Progresso inicial<span className="req">*</span></span>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input type="range" min={0} max={100} step={5} className="cw-slider"
                value={v.initial_progress} onChange={e => patch("initial_progress", Number(e.target.value))} />
              <div className="cw-slider-scale"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
            </div>
            <div className="cw-input" style={{ width: 66, display: "grid", placeItems: "center", fontWeight: 600 }}>
              {v.initial_progress}%
            </div>
          </div>
        </div>
        <Field label="Centro de custo" className="cw-span-2">
          <input className="cw-input" value={v.cost_center} onChange={e => patch("cost_center", e.target.value)} placeholder="Selecione o centro de custo" />
        </Field>
      </div>

      <div className="cw-section">
        <div className="cw-section-head">
          <div>
            <h4>Etapas do projeto</h4>
            <p>Etapas carregadas automaticamente do tipo de projeto selecionado.</p>
          </div>
          <button type="button" className="cw-btn cw-btn-secondary sm" onClick={addStage}><Plus /> Adicionar etapa</button>
        </div>

        <div className="cw-callout" style={{ marginBottom: 14 }}>
          <Info />
          <span>
            As etapas abaixo vêm do tipo de projeto e serão criadas automaticamente para este projeto.<br />
            Alterações feitas aqui não alteram o modelo original.
          </span>
        </div>

        <div className="flex items-center gap-2 mb-3" style={{ fontSize: 11.5, color: "var(--cw-muted)" }}>
          Tipo de projeto selecionado:
          <span className="cw-chip">{selectedTypeLabel ?? "Nenhum"}</span>
        </div>

        <table className="cw-table">
          <thead>
            <tr>
              <th style={{ width: 34 }} />
              <th style={{ width: 58 }}>Ordem</th>
              <th style={{ width: 180 }}>Etapa</th>
              <th>Descrição</th>
              <th style={{ width: 130 }}>Duração estimada</th>
              <th style={{ width: 72 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {v.stages.length === 0 && (
              <tr><td colSpan={6} className="cw-mut" style={{ textAlign: "center" }}>Nenhuma etapa definida. Selecione um tipo de projeto ou adicione manualmente.</td></tr>
            )}
            {v.stages.map((s, i) => {
              const isEdit = editing === s.id;
              return (
                <tr key={s.id}>
                  <td><GripVertical size={15} color="#b6bfc9" /></td>
                  <td><span className="cw-ordem inline-grid place-items-center">{i + 1}</span></td>
                  <td>
                    <span className="cw-dot" style={{ background: s.color }} />
                    {isEdit
                      ? <input className="cw-table-inline-input" style={{ width: 120 }} value={s.name} onChange={e => updStage(s.id, { name: e.target.value })} />
                      : <span className="cw-strong">{s.name}</span>}
                  </td>
                  <td className="cw-mut">
                    {isEdit
                      ? <input className="cw-table-inline-input" value={s.description} onChange={e => updStage(s.id, { description: e.target.value })} placeholder="Descrição da etapa" />
                      : (s.description || "—")}
                  </td>
                  <td>
                    <Clock size={13} style={{ display: "inline", marginRight: 6, color: "var(--cw-muted)" }} />
                    {isEdit
                      ? <input className="cw-table-inline-input" style={{ width: 70 }} value={s.duration} onChange={e => updStage(s.id, { duration: e.target.value })} />
                      : s.duration}
                  </td>
                  <td>
                    <div className="flex gap-1.5">
                      <button type="button" className="cw-row-icon" onClick={() => setEditing(isEdit ? null : s.id)}>
                        {isEdit ? <Check size={13} /> : <Pencil size={13} />}
                      </button>
                      <button type="button" className="cw-row-icon" onClick={() => delStage(s.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ============================================================
   NP-03 — Equipe
   ============================================================ */
const PERMISSION_LABEL: Record<ProjectParticipant["permission"], string> = {
  admin: "Administrador", editor: "Editor", collaborator: "Colaborador", viewer: "Leitura",
};

function StepTeam({ v, patch, people }: { v: ProjectWizardValue; patch: Patch; people: Person[] }) {
  const [pick, setPick] = useState("");

  const addParticipant = () => {
    const person = people.find(p => p.id === pick);
    if (!person) return;
    if (v.participants.some(p => p.user_id === person.id)) return;
    patch("participants", [...v.participants, {
      id: `p-${Date.now()}`, user_id: person.id,
      name: person.display_name || person.full_name,
      role: person.role_title ?? "Participante",
      department: "—", permission: "collaborator", load: "8h/sem",
    }]);
    setPick("");
  };
  const upd = (id: string, p: Partial<ProjectParticipant>) =>
    patch("participants", v.participants.map(x => (x.id === id ? { ...x, ...p } : x)));
  const del = (id: string) => patch("participants", v.participants.filter(x => x.id !== id));

  return (
    <>
      <h3>Equipe</h3>
      <p className="cw-sub">Defina os responsáveis e participantes do projeto.</p>

      <div className="cw-grid cw-grid-3">
        <Field label="Responsável principal" required>
          <Sel value={v.owner_id ?? ""} onChange={val => patch("owner_id", val || null)}>
            <option value="">Selecione</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.display_name || p.full_name}</option>)}
          </Sel>
        </Field>
        <Field label="Líder de criação">
          <Sel value={v.creative_lead_id ?? ""} onChange={val => patch("creative_lead_id", val || null)}>
            <option value="">Selecione</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.display_name || p.full_name}</option>)}
          </Sel>
        </Field>
        <Field label="Cliente / ponto focal">
          <input className="cw-input" value={v.client_contact} onChange={e => patch("client_contact", e.target.value)} placeholder="Nome do contato no cliente" />
        </Field>
      </div>

      <div className="cw-field cw-span-full" style={{ marginTop: 16 }}>
        <span className="cw-label">Equipe interna</span>
        <div className="flex flex-wrap gap-2 items-center" style={{ minHeight: 42, border: "1px solid var(--cw-input-border)", borderRadius: 8, padding: "7px 10px" }}>
          {v.participants.length === 0 && <span style={{ fontSize: 12, color: "#98a2ad" }}>Nenhum participante adicionado</span>}
          {v.participants.map(p => (
            <span key={p.id} className="cw-chip is-neutral">
              <span className="cw-avatar sm">{initials(p.name)}</span>
              {p.name}
              <button type="button" onClick={() => del(p.id)}><X size={11} /></button>
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-end gap-2 justify-end" style={{ marginTop: 12 }}>
        <div style={{ width: 240 }}>
          <Sel value={pick} onChange={setPick}>
            <option value="">Selecione uma pessoa</option>
            {people.filter(p => !v.participants.some(x => x.user_id === p.id)).map(p => (
              <option key={p.id} value={p.id}>{p.display_name || p.full_name}</option>
            ))}
          </Sel>
        </div>
        <button type="button" className="cw-btn cw-btn-secondary" onClick={addParticipant} disabled={!pick}>
          <Plus /> Adicionar participante
        </button>
      </div>

      <div className="cw-section">
        <div className="cw-section-head"><div><h4>Participantes do projeto</h4></div></div>
        <table className="cw-table">
          <thead>
            <tr>
              <th style={{ width: 180 }}>Nome</th>
              <th style={{ width: 165 }}>Função no projeto</th>
              <th style={{ width: 135 }}>Departamento</th>
              <th style={{ width: 135 }}>Permissão</th>
              <th style={{ width: 100 }}>Carga prevista</th>
              <th style={{ width: 72 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {v.participants.length === 0 && (
              <tr><td colSpan={6} className="cw-mut" style={{ textAlign: "center" }}>Nenhum participante adicionado ainda.</td></tr>
            )}
            {v.participants.map(p => (
              <tr key={p.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="cw-avatar">{initials(p.name)}</span>
                    <span className="cw-strong">{p.name}</span>
                  </div>
                </td>
                <td><input className="cw-table-inline-input" value={p.role} onChange={e => upd(p.id, { role: e.target.value })} /></td>
                <td><input className="cw-table-inline-input" value={p.department} onChange={e => upd(p.id, { department: e.target.value })} /></td>
                <td>
                  <select
                    className="cw-chip"
                    style={{ appearance: "none", cursor: "pointer", fontFamily: "var(--cw-font)" }}
                    value={p.permission}
                    onChange={e => upd(p.id, { permission: e.target.value as ProjectParticipant["permission"] })}
                  >
                    {(Object.keys(PERMISSION_LABEL) as ProjectParticipant["permission"][]).map(k => (
                      <option key={k} value={k}>{PERMISSION_LABEL[k]}</option>
                    ))}
                  </select>
                </td>
                <td><input className="cw-table-inline-input" value={p.load} onChange={e => upd(p.id, { load: e.target.value })} /></td>
                <td><button type="button" className="cw-row-icon" onClick={() => del(p.id)}><Trash2 size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="cw-callout" style={{ marginTop: 14 }}>
          <Info />
          <span>Participantes podem ser ajustados a qualquer momento. As permissões definem o nível de colaboração e visibilidade no projeto.</span>
        </div>
      </div>

      <div className="cw-section">
        <div className="cw-section-head"><div><h4>Notificações e acesso</h4></div></div>
        <SwitchRow title="Notificar novos participantes por e-mail" on={v.notify_members} onToggle={() => patch("notify_members", !v.notify_members)} />
        <SwitchRow title="Permitir que membros vejam financeiro do projeto" on={v.allow_finance_view} onToggle={() => patch("allow_finance_view", !v.allow_finance_view)} />
      </div>
    </>
  );
}

/* ============================================================
   NP-04 — Financeiro
   ============================================================ */
function StepFinance({ v, patch, people, platforms }: {
  v: ProjectWizardValue; patch: Patch; people: Person[]; platforms: CatalogItem[];
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const tb = v.traffic_budget ?? { enabled: false, amount: null, platforms: [] };

  const togglePlatform = (name: string) => patch("traffic_budget", {
    ...tb,
    platforms: tb.platforms.includes(name) ? tb.platforms.filter(x => x !== name) : [...tb.platforms, name],
  });

  return (
    <>
      <h3>Financeiro do projeto</h3>
      <p className="cw-sub">Defina como o projeto será faturado e configure as condições comerciais.</p>

      <div className="cw-section-head"><div><h4>Modelo de cobrança do projeto</h4></div></div>
      <div className="cw-grid cw-grid-4">
        {BILLING_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const on = v.billing_model === opt.value;
          return (
            <button key={opt.value} type="button" className={`cw-choice${on ? " is-on" : ""}`}
              onClick={() => patch("billing_model", opt.value as ProjectWizardValue["billing_model"])}>
              <span className="cw-choice-title"><Icon size={15} /> {opt.label}</span>
              <span className="cw-choice-desc">{opt.desc}</span>
            </button>
          );
        })}
      </div>

      <div className="cw-callout" style={{ marginTop: 14 }}>
        <Info />
        <span>
          {v.billing_model === "per_task"
            ? "No modelo \"Por tarefa\", a receita prevista do projeto será calculada automaticamente com base nas tarefas e entregáveis faturáveis. Você verá o valor atualizado no resumo ao lado conforme eles forem criados."
            : "A receita prevista deste projeto será baseada no valor definido abaixo, somada aos faturamentos gerados durante a execução."}
        </span>
      </div>

      <div className="grid gap-5 mt-5" style={{ gridTemplateColumns: "minmax(0,1fr) 290px" }}>
        {/* Configurações comerciais */}
        <div>
          <div className="cw-section-head"><div><h4>Configurações comerciais</h4></div></div>

          {(v.billing_model === "fixed" || v.billing_model === "monthly") && (
            <div style={{ maxWidth: 240, marginBottom: 12 }}>
              <Field label={v.billing_model === "fixed" ? "Valor total (R$)" : "Fee mensal (R$)"}>
                <input type="number" step="0.01" className="cw-input" value={v.fixed_value ?? ""}
                  onChange={e => patch("fixed_value", e.target.value ? Number(e.target.value) : null)} placeholder="0,00" />
              </Field>
            </div>
          )}

          <SwitchRow title="Faturamento por tarefa ativado por padrão" desc="Novas tarefas serão criadas com faturamento ativado."
            on={v.bill_per_task_default} onToggle={() => patch("bill_per_task_default", !v.bill_per_task_default)} />
          <SwitchRow title="Permitir faturamento por entregável" desc="Entregáveis poderão ser faturados individualmente."
            on={v.bill_per_deliverable} onToggle={() => patch("bill_per_deliverable", !v.bill_per_deliverable)} />
          <SwitchRow title="Usar valor padrão do tipo de tarefa" desc="Sugere o valor configurado no tipo de tarefa ao criar."
            on={v.use_task_type_value} onToggle={() => patch("use_task_type_value", !v.use_task_type_value)} />
          <SwitchRow title="Permitir alteração do valor nas tarefas" desc="O valor poderá ser ajustado manualmente nas tarefas."
            on={v.allow_value_override} onToggle={() => patch("allow_value_override", !v.allow_value_override)} />

          <div className="cw-grid cw-grid-2" style={{ marginTop: 16 }}>
            <Field label="Responsável financeiro">
              <Sel value={v.finance_owner_id ?? ""} onChange={val => patch("finance_owner_id", val || null)}>
                <option value="">Selecione</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.display_name || p.full_name}</option>)}
              </Sel>
            </Field>
            <Field label="Centro de custo">
              <input className="cw-input" value={v.cost_center} onChange={e => patch("cost_center", e.target.value)} placeholder="Selecione o centro de custo" />
            </Field>
            <Field label="Condição de pagamento padrão">
              <Sel value={v.payment_terms} onChange={val => patch("payment_terms", val)}>
                {["À vista", "15 dias", "30 dias", "45 dias", "60 dias"].map(o => <option key={o} value={o}>{o}</option>)}
              </Sel>
            </Field>
            <Field label="Vencimento padrão após faturamento">
              <Sel value={v.due_days} onChange={val => patch("due_days", val)}>
                {["7 dias", "15 dias", "30 dias", "45 dias"].map(o => <option key={o} value={o}>{o}</option>)}
              </Sel>
            </Field>
          </div>

          <div className="cw-card" style={{ marginTop: 16 }}>
            <button type="button" className="w-full flex items-center justify-between cw-card-pad" onClick={() => setNotesOpen(o => !o)}>
              <span style={{ textAlign: "left" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, display: "block" }}>Observações financeiras <span style={{ color: "var(--cw-muted)", fontWeight: 400 }}>(opcional)</span></span>
                <span style={{ fontSize: 10.5, color: "var(--cw-muted)" }}>Informações adicionais sobre condições comerciais do projeto.</span>
              </span>
              <ChevronDown size={16} style={{ color: "var(--cw-muted)", transform: notesOpen ? "rotate(180deg)" : undefined }} />
            </button>
            {notesOpen && (
              <div style={{ padding: "0 16px 14px" }}>
                <textarea className="cw-textarea" rows={3} value={v.finance_notes}
                  onChange={e => patch("finance_notes", e.target.value)} placeholder="Condições, descontos, particularidades..." />
              </div>
            )}
          </div>

          {/* Verbas e plataformas — preserva o fluxo existente */}
          <div className="cw-section">
            <div className="cw-section-head">
              <div>
                <h4>Verba de mídia e plataformas</h4>
                <p>Verba de tráfego separada do fee da agência.</p>
              </div>
              <Switch on={tb.enabled} onToggle={() => patch("traffic_budget", { ...tb, enabled: !tb.enabled })} />
            </div>
            {tb.enabled && (
              <>
                <div style={{ maxWidth: 220, marginBottom: 12 }}>
                  <Field label="Verba mensal (R$)">
                    <input type="number" step="0.01" className="cw-input" value={tb.amount ?? ""}
                      onChange={e => patch("traffic_budget", { ...tb, amount: e.target.value ? Number(e.target.value) : null })} placeholder="0,00" />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  {platforms.map(p => {
                    const on = tb.platforms.includes(p.name);
                    return (
                      <button key={p.id} type="button" className={`cw-chip${on ? "" : " is-neutral"}`} onClick={() => togglePlatform(p.name)}>
                        {on && <Check size={12} />} {p.name}
                      </button>
                    );
                  })}
                  {platforms.length === 0 && <span style={{ fontSize: 11, color: "var(--cw-muted)" }}>Cadastre plataformas em Configurações.</span>}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Resumo financeiro */}
        <div className="flex flex-col gap-3">
          <div className="cw-card cw-card-pad">
            <h5>Resumo financeiro <span style={{ fontWeight: 400, color: "var(--cw-muted)", fontSize: 10.5 }}>(calculado automaticamente)</span></h5>
            <div style={{ fontSize: 10.5, color: "var(--cw-muted)" }}>Receita prevista atual</div>
            <div style={{ fontSize: 22, fontWeight: 600, margin: "2px 0 10px", fontVariantNumeric: "tabular-nums" }}>
              {brl(v.billing_model === "per_task" ? 0 : (v.fixed_value ?? 0))}
            </div>
            {[["Tarefas faturáveis", "0"], ["Entregáveis faturáveis", "0"], ["Cobranças geradas", "0"], ["Faturas emitidas", "0"], ["Receita realizada", brl(0)]].map(([k, val]) => (
              <div key={k} className="cw-side-line"><span>{k}</span><span>{val}</span></div>
            ))}
          </div>
          <div className="cw-callout">
            <Info />
            <span>Esse resumo será preenchido à medida que tarefas e entregáveis faturáveis forem criados e faturados.</span>
          </div>
          <div className="cw-card cw-card-pad">
            <h5>Custos do projeto</h5>
            <div style={{ fontSize: 10.5, color: "var(--cw-muted)", marginBottom: 10 }}>
              Registre os custos previstos ou reais depois de criar o projeto, na aba Financeiro.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   NP-05 — Revisão
   ============================================================ */
function StepReview({ v, allOk, goTo, clientName, typeLabel, personName }: {
  v: ProjectWizardValue; allOk: boolean; goTo: (n: number) => void;
  clientName: string; typeLabel: string; personName: (id: string | null) => string;
}) {
  const priority = PRIORITY_OPTIONS.find(p => p.value === v.urgency)?.label ?? "—";
  const billing = BILLING_OPTIONS.find(b => b.value === v.billing_model)?.label ?? "—";

  const Item = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10.5, color: "var(--cw-muted)" }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 500 }}>{value}</div>
    </div>
  );
  const EditBtn = ({ to }: { to: number }) => (
    <button type="button" className="cw-btn cw-btn-secondary sm" onClick={() => goTo(to)}>Editar</button>
  );

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3>Revisão do projeto</h3>
          <p className="cw-sub">Confira todas as informações antes de criar o projeto.</p>
        </div>
        <div className={`cw-callout${allOk ? " is-green" : ""}`} style={{ maxWidth: 230 }}>
          {allOk ? <Check /> : <Info />}
          <span>
            <strong style={{ display: "block", fontWeight: 600 }}>{allOk ? "Tudo certo!" : "Faltam dados"}</strong>
            {allOk ? "Todos os campos obrigatórios foram preenchidos." : "Revise as etapas destacadas antes de criar."}
          </span>
        </div>
      </div>

      <div className="cw-grid cw-grid-2">
        <div className="cw-card cw-card-pad">
          <div className="flex items-center justify-between mb-2">
            <h5><FolderKanban size={15} /> Informações básicas</h5>
            <EditBtn to={1} />
          </div>
          <Item label="Nome do projeto" value={v.name || "—"} />
          <Item label="Cliente" value={<span style={{ color: "var(--cw-cobalt)" }}>{clientName}</span>} />
          <Item label="Tipo de projeto" value={typeLabel} />
          <Item label="Descrição" value={v.description || "—"} />
        </div>

        <div className="cw-card cw-card-pad">
          <div className="flex items-center justify-between mb-2">
            <h5><CalendarDays size={15} /> Prazos e planejamento</h5>
            <EditBtn to={2} />
          </div>
          <div className="cw-grid cw-grid-2">
            <Item label="Data de início" value={fmtDate(v.start_date)} />
            <Item label="Prazo final" value={fmtDate(v.end_date)} />
            <Item label="Prioridade" value={<span className="inline-flex items-center gap-1.5"><Flag size={12} color="#e14545" /> {priority}</span>} />
            <Item label="Projeto recorrente" value={v.recurring ? "Sim" : "Não"} />
            <Item label="Progresso inicial" value={`${v.initial_progress}%`} />
            <Item label="Centro de custo" value={v.cost_center || "—"} />
          </div>
        </div>
      </div>

      <div className="cw-card cw-card-pad" style={{ marginTop: 16 }}>
        <div className="flex items-center justify-between mb-2">
          <h5>Etapas do projeto <span style={{ fontWeight: 400, color: "var(--cw-muted)" }}>(vinculadas ao tipo selecionado)</span></h5>
          <EditBtn to={2} />
        </div>
        <table className="cw-table">
          <thead><tr><th style={{ width: 70 }}>Ordem</th><th style={{ width: 180 }}>Etapa</th><th>Descrição</th><th style={{ width: 140 }}>Duração estimada</th></tr></thead>
          <tbody>
            {v.stages.length === 0 && <tr><td colSpan={4} className="cw-mut" style={{ textAlign: "center" }}>Nenhuma etapa definida.</td></tr>}
            {v.stages.map((s, i) => (
              <tr key={s.id}>
                <td><span className="cw-ordem inline-grid place-items-center">{i + 1}</span></td>
                <td><span className="cw-dot" style={{ background: s.color }} /><span className="cw-strong">{s.name}</span></td>
                <td className="cw-mut">{s.description || "—"}</td>
                <td><Clock size={13} style={{ display: "inline", marginRight: 6, color: "var(--cw-muted)" }} />{s.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cw-grid cw-grid-3" style={{ marginTop: 16 }}>
        <div className="cw-card cw-card-pad">
          <div className="flex items-center justify-between mb-2">
            <h5><Users size={15} /> Equipe do projeto</h5>
            <EditBtn to={3} />
          </div>
          <Item label="Gerente do projeto" value={personName(v.owner_id)} />
          <Item label="Responsável financeiro" value={personName(v.finance_owner_id ?? v.owner_id)} />
          <Item label={`Participantes (${v.participants.length})`} value={v.participants.map(p => p.name).join(", ") || "—"} />
        </div>

        <div className="cw-card cw-card-pad">
          <div className="flex items-center justify-between mb-2">
            <h5><DollarSign size={15} /> Financeiro do projeto</h5>
            <EditBtn to={4} />
          </div>
          <Item label="Modelo de cobrança" value={<span className="cw-chip is-green">{billing}</span>} />
          <Item label="Receita prevista atual" value={brl(v.billing_model === "per_task" ? 0 : (v.fixed_value ?? 0))} />
          <div className="cw-side-line"><span>Tarefas faturáveis</span><span>0</span></div>
          <div className="cw-side-line"><span>Entregáveis faturáveis</span><span>0</span></div>
          <div className="cw-side-line"><span>Cobranças geradas</span><span>0</span></div>
        </div>

        <div className="cw-card cw-card-pad">
          <h5>Custos do projeto</h5>
          <div style={{ fontSize: 11, color: "var(--cw-muted)" }}>Nenhum custo cadastrado até o momento.</div>
        </div>
      </div>
    </>
  );
}
