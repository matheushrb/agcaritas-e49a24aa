import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  FolderPlus, ChevronLeft, ChevronRight, Check, Zap, DollarSign,
  Wrench, Target, Rocket, Flag, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectWizardValue = {
  name: string;
  client_id: string | null;
  description: string;
  project_type: string;
  billing_model: "per_task" | "fixed" | "contract" | "monthly";
  fixed_value: number | null;
  urgency: "low" | "medium" | "high" | "critical";
  start_date: string | null;
  end_date: string | null;
  tools: string[];
  scope_flags: {
    swot: boolean;
    personas: boolean;
    competitors: boolean;
    roadmap: boolean;
    kpis: boolean;
    action_plan: boolean;
  };
  traffic_budget: { enabled: boolean; amount: number | null; platforms: string[] } | null;
  other_budgets: { label: string; amount: number }[];
};

const PROJECT_TYPES = [
  { value: "marketing", label: "Marketing Digital" },
  { value: "branding", label: "Branding & Identidade" },
  { value: "social_media", label: "Social Media" },
  { value: "traffic", label: "Tráfego Pago" },
  { value: "web", label: "Site / Landing Page" },
  { value: "content", label: "Conteúdo / Copy" },
  { value: "consulting", label: "Consultoria" },
  { value: "other", label: "Outro" },
];

const BILLING_OPTIONS = [
  { value: "per_task", label: "Por tarefa", desc: "Cada task tem valor próprio", icon: Zap },
  { value: "fixed", label: "Valor fixo", desc: "Escopo fechado, pagamento único", icon: DollarSign },
  { value: "contract", label: "Contrato / Proposta", desc: "Vinculado a uma proposta aprovada", icon: Flag },
  { value: "monthly", label: "Recorrente mensal", desc: "Fee mensal de agência (MRR)", icon: Sparkles },
];

const URGENCY = [
  { value: "low", label: "Baixa", color: "bg-muted text-muted-foreground" },
  { value: "medium", label: "Média", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  { value: "high", label: "Alta", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { value: "critical", label: "Urgente", color: "bg-red-500/15 text-red-600 dark:text-red-400" },
];

const TOOLS = [
  "Meta Ads", "Google Ads", "TikTok Ads", "LinkedIn Ads", "Buffer", "RD Station",
  "HubSpot", "Figma", "Canva", "Notion", "ClickUp", "Adobe CC", "CapCut",
  "Google Analytics", "Search Console", "Hotjar", "Semrush", "WordPress",
];

const TRAFFIC_PLATFORMS = ["Meta", "Google", "TikTok", "LinkedIn", "YouTube", "Pinterest", "X (Twitter)"];

const STRATEGY_ITEMS: { key: keyof ProjectWizardValue["scope_flags"]; label: string; desc: string }[] = [
  { key: "swot", label: "Análise SWOT", desc: "Forças, Fraquezas, Oportunidades e Ameaças" },
  { key: "personas", label: "Personas", desc: "Perfis de público-alvo detalhados" },
  { key: "competitors", label: "Concorrentes", desc: "Benchmarking do mercado" },
  { key: "roadmap", label: "Roadmap", desc: "Cronograma estratégico de execução" },
  { key: "kpis", label: "KPIs & Metas", desc: "Indicadores de performance por área" },
  { key: "action_plan", label: "Plano de Ação", desc: "Iniciativas priorizadas e responsáveis" },
];

const STEPS = [
  { id: 1, title: "Escopo",           icon: FolderPlus },
  { id: 2, title: "Faturamento",      icon: DollarSign },
  { id: 3, title: "Ferramentas",      icon: Wrench },
  { id: 4, title: "Verbas",           icon: Target },
  { id: 5, title: "Estratégia",       icon: Rocket },
];

const defaultValue: ProjectWizardValue = {
  name: "", client_id: null, description: "",
  project_type: "marketing", billing_model: "fixed",
  fixed_value: null, urgency: "medium",
  start_date: null, end_date: null,
  tools: [],
  scope_flags: { swot: false, personas: false, competitors: false, roadmap: false, kpis: false, action_plan: false },
  traffic_budget: { enabled: false, amount: null, platforms: [] },
  other_budgets: [],
};

export function NewProjectWizard({
  open, onOpenChange, clients, onCreate, pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clients: { id: string; name: string }[];
  onCreate: (v: ProjectWizardValue) => void;
  pending: boolean;
}) {
  const [step, setStep] = useState(1);
  const [v, setV] = useState<ProjectWizardValue>(defaultValue);

  const reset = () => { setStep(1); setV(defaultValue); };
  const handleOpen = (o: boolean) => { onOpenChange(o); if (!o) reset(); };

  const canNext = step === 1 ? v.name.trim().length > 0 : true;
  const isLast = step === STEPS.length;

  const patch = <K extends keyof ProjectWizardValue>(k: K, val: ProjectWizardValue[K]) => setV(p => ({ ...p, [k]: val }));
  const toggleTool = (t: string) => setV(p => ({
    ...p, tools: p.tools.includes(t) ? p.tools.filter(x => x !== t) : [...p.tools, t],
  }));
  const togglePlatform = (t: string) => setV(p => {
    const tb = p.traffic_budget ?? { enabled: false, amount: null, platforms: [] };
    return {
      ...p,
      traffic_budget: {
        ...tb,
        platforms: tb.platforms.includes(t) ? tb.platforms.filter(x => x !== t) : [...tb.platforms, t],
      },
    };
  });

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="p-0 gap-0 rounded-3xl overflow-hidden w-[calc(100vw-2rem)] max-w-[980px] max-h-[90vh] flex flex-col sm:max-w-[980px]">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border bg-blue-500/5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-background shadow-sm">
              <FolderPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wider font-medium text-blue-600 dark:text-blue-400">Projetos</div>
              <DialogTitle className="text-lg font-semibold">Novo projeto</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                {STEPS[step - 1].title} — passo {step} de {STEPS.length}
              </p>
            </div>
          </div>

          {/* Stepper */}
          <div className="mt-5 flex items-center gap-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = s.id === step;
              const done = s.id < step;
              return (
                <div key={s.id} className="flex items-center gap-2 flex-1">
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      active ? "bg-primary text-primary-foreground" :
                      done ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" :
                      "bg-muted text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{s.title}</span>
                  </button>
                  {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto px-6 py-5">
          {step === 1 && <StepScope v={v} patch={patch} clients={clients} />}
          {step === 2 && <StepBilling v={v} patch={patch} />}
          {step === 3 && <StepTools v={v} toggleTool={toggleTool} />}
          {step === 4 && <StepBudgets v={v} patch={patch} togglePlatform={togglePlatform} />}
          {step === 5 && <StepStrategy v={v} patch={patch} />}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-3 flex items-center justify-between bg-background">
          <Button variant="ghost" className="rounded-full gap-1.5" disabled={step === 1}
            onClick={() => setStep(s => Math.max(1, s - 1))}>
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          <div className="text-xs text-muted-foreground hidden sm:block">
            {v.name || "Sem título"} · {PROJECT_TYPES.find(t => t.value === v.project_type)?.label}
          </div>
          {isLast ? (
            <Button className="rounded-full gap-1.5" disabled={pending || !v.name.trim()}
              onClick={() => onCreate(v)}>
              <Check className="h-4 w-4" /> {pending ? "Criando…" : "Criar projeto"}
            </Button>
          ) : (
            <Button className="rounded-full gap-1.5" disabled={!canNext}
              onClick={() => setStep(s => Math.min(STEPS.length, s + 1))}>
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================ */

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted-foreground">{children}</label>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function StepScope({ v, patch, clients }: {
  v: ProjectWizardValue;
  patch: <K extends keyof ProjectWizardValue>(k: K, val: ProjectWizardValue[K]) => void;
  clients: { id: string; name: string }[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-4">
        <div className="space-y-1.5">
          <Label>Nome do projeto</Label>
          <Input autoFocus value={v.name} onChange={e => patch("name", e.target.value)}
            placeholder="Ex.: Rebrand Bella Estética Q2/2026" />
        </div>
        <div className="space-y-1.5">
          <Label>Descrição / objetivo</Label>
          <Textarea rows={5} value={v.description} onChange={e => patch("description", e.target.value)}
            placeholder="Escopo, entregáveis principais e resultado esperado." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Início</Label>
            <Input type="date" value={v.start_date ?? ""} onChange={e => patch("start_date", e.target.value || null)} />
          </div>
          <div className="space-y-1.5">
            <Label>Prazo final</Label>
            <Input type="date" value={v.end_date ?? ""} onChange={e => patch("end_date", e.target.value || null)} />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Cliente</Label>
          <Select value={v.client_id ?? "none"} onValueChange={val => patch("client_id", val === "none" ? null : val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem cliente (interno)</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Tipo de projeto</Label>
          <Select value={v.project_type} onValueChange={val => patch("project_type", val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROJECT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Urgência</Label>
          <div className="flex flex-wrap gap-2">
            {URGENCY.map(u => (
              <button
                key={u.value}
                type="button"
                onClick={() => patch("urgency", u.value as ProjectWizardValue["urgency"])}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                  v.urgency === u.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
                )}
              >{u.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBilling({ v, patch }: {
  v: ProjectWizardValue;
  patch: <K extends keyof ProjectWizardValue>(k: K, val: ProjectWizardValue[K]) => void;
}) {
  return (
    <div className="space-y-5">
      <Section title="Como este projeto será faturado?">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {BILLING_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const active = v.billing_model === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => patch("billing_model", opt.value as ProjectWizardValue["billing_model"])}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                  active ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:bg-muted/50",
                )}
              >
                <div className={cn("grid h-10 w-10 place-items-center rounded-xl shrink-0",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {(v.billing_model === "fixed" || v.billing_model === "monthly") && (
        <div className="space-y-1.5 max-w-xs">
          <Label>{v.billing_model === "fixed" ? "Valor total (R$)" : "Fee mensal (R$)"}</Label>
          <Input type="number" step="0.01" value={v.fixed_value ?? ""}
            onChange={e => patch("fixed_value", e.target.value ? Number(e.target.value) : null)}
            placeholder="0,00" />
        </div>
      )}
    </div>
  );
}

function StepTools({ v, toggleTool }: { v: ProjectWizardValue; toggleTool: (t: string) => void }) {
  return (
    <Section title="Ferramentas que serão utilizadas neste projeto">
      <p className="text-xs text-muted-foreground -mt-1">Selecione quantas quiser — usado para relatórios e onboarding do time.</p>
      <div className="flex flex-wrap gap-2">
        {TOOLS.map(t => {
          const on = v.tools.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleTool(t)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
              )}
            >{t}</button>
          );
        })}
      </div>
    </Section>
  );
}

function StepBudgets({ v, patch, togglePlatform }: {
  v: ProjectWizardValue;
  patch: <K extends keyof ProjectWizardValue>(k: K, val: ProjectWizardValue[K]) => void;
  togglePlatform: (t: string) => void;
}) {
  const tb = v.traffic_budget ?? { enabled: false, amount: null, platforms: [] };
  const addOther = () => patch("other_budgets", [...v.other_budgets, { label: "", amount: 0 }]);
  const updateOther = (i: number, key: "label" | "amount", val: string | number) => {
    const arr = [...v.other_budgets];
    (arr[i] as any)[key] = val;
    patch("other_budgets", arr);
  };
  const removeOther = (i: number) => patch("other_budgets", v.other_budgets.filter((_, x) => x !== i));

  return (
    <div className="space-y-6">
      <Section title="Verba de tráfego pago">
        <div className="rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-medium text-sm">Este projeto terá investimento em mídia paga?</div>
              <p className="text-xs text-muted-foreground">Ative para definir orçamento e plataformas.</p>
            </div>
            <Switch checked={tb.enabled}
              onCheckedChange={c => patch("traffic_budget", { ...tb, enabled: c })} />
          </div>

          {tb.enabled && (
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5 max-w-xs">
                <Label>Verba mensal estimada (R$)</Label>
                <Input type="number" step="0.01" value={tb.amount ?? ""}
                  onChange={e => patch("traffic_budget", { ...tb, amount: e.target.value ? Number(e.target.value) : null })}
                  placeholder="0,00" />
              </div>
              <div className="space-y-2">
                <Label>Plataformas</Label>
                <div className="flex flex-wrap gap-2">
                  {TRAFFIC_PLATFORMS.map(p => {
                    const on = tb.platforms.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePlatform(p)}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-medium border",
                          on ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
                        )}
                      >{p}</button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section title="Outras verbas (produção, freelas, licenças, viagens…)">
        <div className="space-y-2">
          {v.other_budgets.map((ob, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input placeholder="Ex.: Produção fotográfica"
                value={ob.label} onChange={e => updateOther(i, "label", e.target.value)} />
              <Input type="number" step="0.01" placeholder="Valor" className="w-32"
                value={ob.amount || ""} onChange={e => updateOther(i, "amount", Number(e.target.value))} />
              <Button type="button" variant="ghost" className="rounded-full" onClick={() => removeOther(i)}>×</Button>
            </div>
          ))}
          <Button type="button" variant="outline" className="rounded-full gap-1" onClick={addOther}>
            + Adicionar verba
          </Button>
        </div>
      </Section>
    </div>
  );
}

function StepStrategy({ v, patch }: {
  v: ProjectWizardValue;
  patch: <K extends keyof ProjectWizardValue>(k: K, val: ProjectWizardValue[K]) => void;
}) {
  const toggle = (key: keyof ProjectWizardValue["scope_flags"]) =>
    patch("scope_flags", { ...v.scope_flags, [key]: !v.scope_flags[key] });

  return (
    <Section title="Artefatos de planejamento estratégico">
      <p className="text-xs text-muted-foreground -mt-1">Ative o que este projeto vai produzir. Cada item vira uma aba na página do projeto.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {STRATEGY_ITEMS.map(item => {
          const on = v.scope_flags[item.key];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => toggle(item.key)}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all",
                on ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
              )}
            >
              <div className={cn(
                "mt-0.5 h-5 w-5 rounded-md border grid place-items-center shrink-0",
                on ? "bg-primary border-primary text-primary-foreground" : "border-border",
              )}>{on && <Check className="h-3 w-3" />}</div>
              <div className="min-w-0">
                <div className="font-medium text-sm">{item.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-border p-4 bg-muted/30 mt-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Resumo do projeto</div>
        <div className="text-sm font-semibold">{v.name || "Sem título"}</div>
        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1">
          <Badge variant="outline" className="rounded-full">{PROJECT_TYPES.find(t => t.value === v.project_type)?.label}</Badge>
          <Badge variant="outline" className="rounded-full">{BILLING_OPTIONS.find(b => b.value === v.billing_model)?.label}</Badge>
          <Badge variant="outline" className="rounded-full">{URGENCY.find(u => u.value === v.urgency)?.label}</Badge>
          {v.tools.length > 0 && <Badge variant="outline" className="rounded-full">{v.tools.length} ferramentas</Badge>}
          {v.traffic_budget?.enabled && <Badge variant="outline" className="rounded-full">Tráfego pago</Badge>}
          {Object.values(v.scope_flags).some(Boolean) && (
            <Badge variant="outline" className="rounded-full">
              {Object.values(v.scope_flags).filter(Boolean).length} artefatos estratégicos
            </Badge>
          )}
        </div>
      </div>
    </Section>
  );
}
