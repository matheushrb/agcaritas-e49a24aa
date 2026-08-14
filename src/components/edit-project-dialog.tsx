import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  X, Plus, Users as UsersIcon, Briefcase, DollarSign, Layers, FileText,
  Calendar, Flag, Building2, Settings2, Target, Megaphone, StickyNote, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ProjectStatus = "planning" | "active" | "review" | "done" | "paused";

export type EditableProject = {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  client_id: string | null;
  start_date: string | null;
  end_date: string | null;
  project_type: string | null;
  billing_model: string | null;
  urgency: string | null;
  fixed_value: number | null;
  monthly_value: number | null;
  hourly_rate: number | null;
  printing_budget: number | null;
  notes: string | null;
  has_content_calendar: boolean;
  has_content_grid: boolean;
  has_timeline: boolean;
  traffic_budget: { enabled?: boolean; amount?: number | null; platforms?: string[] } | null;
  scope_flags: Record<string, boolean> | null;
  contact_name?: string | null;
  contact_role?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  final_client?: string | null;
  doc_id?: string | null;
  social_platforms?: unknown;
};

type Client = { id: string; name: string; trade_name: string | null };
type Profile = { id: string; full_name: string | null; avatar_url: string | null };
type Member = { id: string; user_id: string; role: string | null };

const STRATEGY_KEYS: { key: string; label: string }[] = [
  { key: "briefings", label: "Briefings" },
  { key: "positioning", label: "Pesquisa & Posicionamento" },
  { key: "brand_manual", label: "Manual de marca" },
  { key: "swot", label: "SWOT" },
  { key: "personas", label: "Personas" },
  { key: "competitors", label: "Concorrentes" },
  { key: "roadmap", label: "Roadmap" },
  { key: "kpis", label: "KPIs" },
  { key: "action_plan", label: "Plano de ação" },
];

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planejamento",
  active: "Ativo",
  review: "Revisão",
  done: "Concluído",
  paused: "Pausado",
};

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: EditableProject | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<EditableProject | null>(project);

  useEffect(() => {
    setForm(project);
  }, [project, open]);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id,name,trade_name").order("name");
      return (data ?? []) as Client[];
    },
    enabled: open,
  });

  const { data: projectTypes = [] } = useQuery<Array<{ id: string; name: string; slug: string | null }>>({
    queryKey: ["project_types"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("project_types").select("id,name,slug").eq("active", true).order("sort_order");
      return (data ?? []) as Array<{ id: string; name: string; slug: string | null }>;
    },
  });
  const projectTypeLabel = (key: string | null) =>
    projectTypes.find(t => t.id === key || t.slug === key)?.name ?? key ?? null;

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,avatar_url");
      return (data ?? []) as Profile[];
    },
    enabled: open,
  });

  const { data: platformsCatalog = [] } = useQuery<Array<{ id: string; name: string; category: string | null; color: string | null; icon_url: string | null }>>({
    queryKey: ["platforms-catalog"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("platforms").select("id,name,category,color,icon_url").eq("active", true).order("sort_order");
      return (data ?? []) as any;
    },
    enabled: open,
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["project-members", project?.id],
    enabled: open && !!project?.id,
    queryFn: async () => {
      const { data } = await supabase.from("project_members").select("id,user_id,role").eq("project_id", project!.id);
      return (data ?? []) as Member[];
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<EditableProject>) => {
      if (!project) return;
      const { error } = await supabase.from("projects").update(patch as never).eq("id", project.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", project?.id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto atualizado");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMember = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      if (!project) return;
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await supabase.from("project_members").insert({
        project_id: project.id,
        user_id: userId,
        role: role || null,
        organization_id: profile.organization_id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-members", project?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-members", project?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const profileById = useMemo(() => Object.fromEntries(profiles.map(p => [p.id, p])), [profiles]);
  const [newMemberId, setNewMemberId] = useState<string>("");
  const [newMemberRole, setNewMemberRole] = useState<string>("");

  if (!form) return null;

  const set = <K extends keyof EditableProject>(k: K, v: EditableProject[K]) =>
    setForm(prev => (prev ? { ...prev, [k]: v } : prev));

  const scope = form.scope_flags ?? {};
  const selectedPlatforms: string[] = (() => {
    const raw = (form as any).social_platforms;
    if (Array.isArray(raw)) {
      return raw.map((x: any) => (typeof x === "string" ? x : x?.name ?? "")).filter(Boolean);
    }
    const legacy = (scope as any).tools;
    return Array.isArray(legacy) ? legacy : [];
  })();
  const togglePlatform = (name: string) =>
    set("social_platforms" as any, (selectedPlatforms.includes(name)
      ? selectedPlatforms.filter(x => x !== name)
      : [...selectedPlatforms, name]) as any);
  const traffic = form.traffic_budget ?? { enabled: false, amount: null, platforms: [] };
  const clientName = clients.find(c => c.id === form.client_id)?.trade_name
    || clients.find(c => c.id === form.client_id)?.name
    || "Sem cliente";

  const onSubmit = () => {
    save.mutate({
      name: form.name,
      description: form.description,
      status: form.status,
      client_id: form.client_id,
      start_date: form.start_date,
      end_date: form.end_date,
      project_type: form.project_type,
      billing_model: form.billing_model,
      urgency: form.urgency,
      fixed_value: form.fixed_value,
      monthly_value: form.monthly_value,
      hourly_rate: form.hourly_rate,
      printing_budget: form.printing_budget,
      notes: form.notes,
      has_content_calendar: form.has_content_calendar,
      has_content_grid: form.has_content_grid,
      has_timeline: form.has_timeline,
      traffic_budget: form.traffic_budget,
      scope_flags: form.scope_flags,
      contact_name: form.contact_name ?? null,
      contact_role: form.contact_role ?? null,
      contact_email: form.contact_email ?? null,
      contact_phone: form.contact_phone ?? null,
      final_client: form.final_client ?? null,
      doc_id: form.doc_id ?? null,
      social_platforms: selectedPlatforms as unknown as EditableProject["social_platforms"],
    });
  };

  const availableProfiles = profiles.filter(p => !members.some(m => m.user_id === p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[960px] p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col rounded-2xl border-0 shadow-2xl [&>button.absolute]:text-primary-foreground [&>button.absolute]:hover:bg-primary-foreground/20 [&>button.absolute]:opacity-100"
      >
        {/* Header colorido */}
        <div className="relative bg-primary text-primary-foreground px-7 py-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary-foreground/15 inline-flex items-center justify-center shrink-0">
              <Pencil className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.18em] opacity-75 font-medium">Editar projeto</div>
              <h2 className="text-2xl font-semibold leading-tight truncate mt-0.5">{form.name || "Sem título"}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2.5 py-1">
                  <Building2 className="h-3.5 w-3.5" /> {clientName}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2.5 py-1">
                  <Flag className="h-3.5 w-3.5" /> {STATUS_LABEL[form.status]}
                </span>
                {form.project_type && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2.5 py-1">
                    <Briefcase className="h-3.5 w-3.5" /> {projectTypeLabel(form.project_type)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <Tabs
          defaultValue="general"
          className="flex-1 overflow-hidden flex flex-col"
          style={{ background: "var(--bg)" }}
        >
          <div
            className="px-7 pt-4 pb-3"
            style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
          >
            <TabsList className="cv-dtabs">
              <TabsTrigger value="general" className="cv-dtab gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Geral
              </TabsTrigger>
              <TabsTrigger value="billing" className="cv-dtab gap-1.5">
                <DollarSign className="h-3.5 w-3.5" /> Faturamento
              </TabsTrigger>
              <TabsTrigger value="scope" className="cv-dtab gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Escopo
              </TabsTrigger>
              <TabsTrigger value="team" className="cv-dtab gap-1.5">
                <UsersIcon className="h-3.5 w-3.5" /> Equipe
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-7 py-6 space-y-5">
            {/* GERAL */}
            <TabsContent value="general" className="m-0 space-y-5">
              <Section icon={<FileText className="h-4 w-4" />} title="Identificação" description="Dados principais do projeto.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Nome do projeto" required className="md:col-span-2">
                    <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex.: Campanha de lançamento" />
                  </Field>
                  <Field label="Cliente" icon={<Building2 className="h-3.5 w-3.5" />}>
                    <Select value={form.client_id ?? "none"} onValueChange={v => set("client_id", v === "none" ? null : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem cliente</SelectItem>
                        {clients.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.trade_name || c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Tipo de projeto" icon={<Briefcase className="h-3.5 w-3.5" />}>
                    <Select
                      value={projectTypes.find(t => t.id === form.project_type || t.slug === form.project_type)?.id ?? "none"}
                      onValueChange={v => set("project_type", v === "none" ? null : v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem tipo</SelectItem>
                        {projectTypes.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </Section>

              <Section icon={<UsersIcon className="h-4 w-4" />} title="Contato e documentos" description="Aparece no cabeçalho do projeto. Se ficar vazio, usamos os dados do cliente.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Cliente final" icon={<Target className="h-3.5 w-3.5" />}>
                    <Input value={form.final_client ?? ""} onChange={e => set("final_client", e.target.value || null)} placeholder="Ex.: candidato, marca ou empresa atendida" />
                  </Field>
                  <Field label="CNPJ / CPF" icon={<FileText className="h-3.5 w-3.5" />}>
                    <Input value={form.doc_id ?? ""} onChange={e => set("doc_id", e.target.value || null)} placeholder="00.000.000/0000-00" />
                  </Field>
                  <Field label="Nome do contato">
                    <Input value={form.contact_name ?? ""} onChange={e => set("contact_name", e.target.value || null)} placeholder="Quem responde pelo projeto" />
                  </Field>
                  <Field label="Cargo do contato">
                    <Input value={form.contact_role ?? ""} onChange={e => set("contact_role", e.target.value || null)} placeholder="Ex.: Coordenador de campanha" />
                  </Field>
                  <Field label="E-mail">
                    <Input type="email" value={form.contact_email ?? ""} onChange={e => set("contact_email", e.target.value || null)} placeholder="contato@empresa.com" />
                  </Field>
                  <Field label="Telefone">
                    <Input value={form.contact_phone ?? ""} onChange={e => set("contact_phone", e.target.value || null)} placeholder="(00) 00000-0000" />
                  </Field>
                </div>
              </Section>

              <Section icon={<Calendar className="h-4 w-4" />} title="Status e prazos" description="Etapa atual e janela de execução.">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Field label="Status">
                    <Select value={form.status} onValueChange={v => set("status", v as ProjectStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABEL) as ProjectStatus[]).map(s => (
                          <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Urgência" icon={<Flag className="h-3.5 w-3.5" />}>
                    <Select value={form.urgency ?? "normal"} onValueChange={v => set("urgency", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="critical">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Início">
                    <Input type="date" value={form.start_date ?? ""} onChange={e => set("start_date", e.target.value || null)} />
                  </Field>
                  <Field label="Prazo final">
                    <Input type="date" value={form.end_date ?? ""} onChange={e => set("end_date", e.target.value || null)} />
                  </Field>
                </div>
              </Section>

              <Section icon={<StickyNote className="h-4 w-4" />} title="Descrição & notas" description="Briefing público e anotações internas.">
                <div className="grid grid-cols-1 gap-4">
                  <Field label="Descrição / Briefing" hint="Visível para toda a equipe do projeto.">
                    <Textarea rows={4} value={form.description ?? ""} onChange={e => set("description", e.target.value || null)} placeholder="Objetivos, escopo, entregáveis…" />
                  </Field>
                  <Field label="Notas internas" hint="Só quem tem acesso a este projeto vê.">
                    <Textarea rows={3} value={form.notes ?? ""} onChange={e => set("notes", e.target.value || null)} placeholder="Observações, combinados, links…" />
                  </Field>
                </div>
              </Section>
            </TabsContent>

            {/* FATURAMENTO */}
            <TabsContent value="billing" className="m-0 space-y-5">
              <Section icon={<DollarSign className="h-4 w-4" />} title="Modelo comercial" description="Como esse projeto é cobrado.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Modelo de faturamento" className="md:col-span-2">
                    <Select value={form.billing_model ?? "monthly"} onValueChange={v => set("billing_model", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Mensal (fee)</SelectItem>
                        <SelectItem value="fixed">Valor fechado</SelectItem>
                        <SelectItem value="hourly">Por hora</SelectItem>
                        <SelectItem value="per_task">Por tarefa</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Valor fechado" hint="Projeto pontual (one-shot).">
                    <MoneyInput value={form.fixed_value} onChange={v => set("fixed_value", v)} />
                  </Field>
                  <Field label="Fee mensal" hint="Contrato recorrente por mês.">
                    <MoneyInput value={form.monthly_value} onChange={v => set("monthly_value", v)} />
                  </Field>
                  <Field label="Valor por hora">
                    <MoneyInput value={form.hourly_rate} onChange={v => set("hourly_rate", v)} />
                  </Field>
                  <Field label="Verba de impressão" hint="Reembolsável ao cliente.">
                    <MoneyInput value={form.printing_budget} onChange={v => set("printing_budget", v)} />
                  </Field>
                </div>
              </Section>

              <Section
                icon={<Megaphone className="h-4 w-4" />}
                title="Verba de tráfego"
                description="Quando ativa, libera as abas de Tráfego e Campanhas no projeto."
                right={
                  <Switch
                    checked={!!traffic.enabled}
                    onCheckedChange={v => set("traffic_budget", { ...traffic, enabled: v })}
                  />
                }
              >
                {traffic.enabled ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Valor mensal">
                        <MoneyInput
                          value={traffic.amount ?? null}
                          onChange={v => set("traffic_budget", { ...traffic, amount: v })}
                        />
                      </Field>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Ative o interruptor acima para definir a verba mensal.</p>
                )}
              </Section>
            </TabsContent>



            {/* ESCOPO */}
            <TabsContent value="scope" className="m-0 space-y-5">
              <Section icon={<Settings2 className="h-4 w-4" />} title="Módulos ativos" description="Ligue apenas o que esse projeto realmente usa. Cada módulo vira uma aba dentro do projeto.">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <ToggleCard label="Calendário de conteúdo" checked={form.has_content_calendar} onChange={v => set("has_content_calendar", v)} />
                  <ToggleCard label="Grid de conteúdo" checked={form.has_content_grid} onChange={v => set("has_content_grid", v)} />
                  <ToggleCard label="Timeline" checked={form.has_timeline} onChange={v => set("has_timeline", v)} />
                </div>
              </Section>

              <Section icon={<Target className="h-4 w-4" />} title="Estratégia" description="Artefatos estratégicos disponíveis dentro do projeto.">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {STRATEGY_KEYS.map(({ key, label }) => (
                    <ToggleCard
                      key={key}
                      label={label}
                      checked={!!scope[key]}
                      onChange={v => set("scope_flags", { ...scope, [key]: v })}
                    />
                  ))}
                </div>
              </Section>

              <Section icon={<Megaphone className="h-4 w-4" />} title="Plataformas do projeto" description="Só estas plataformas ficam disponíveis nas tarefas deste projeto.">
                {platformsCatalog.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma plataforma cadastrada. Gerencie em Configurações → Plataformas.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {platformsCatalog.map(p => {
                      const on = selectedPlatforms.includes(p.name);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePlatform(p.name)}
                          className={cn(
                            "rounded-full pl-1 pr-3 py-1 text-xs font-medium border transition-colors flex items-center gap-1.5",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
                          )}
                          style={on ? undefined : { color: p.color ?? undefined, borderColor: (p.color ?? "") + "66" }}
                        >
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-background overflow-hidden shrink-0">
                            {p.icon_url ? (
                              <img src={p.icon_url} alt="" className="h-[70%] w-[70%] object-contain" />
                            ) : (
                              <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? "currentColor" }} />
                            )}
                          </span>
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Section>
            </TabsContent>


            {/* EQUIPE */}
            <TabsContent value="team" className="m-0 space-y-5">
              <Section icon={<UsersIcon className="h-4 w-4" />} title="Equipe do projeto" description="Vincule as pessoas responsáveis por este projeto.">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
                  <Select value={newMemberId} onValueChange={setNewMemberId}>
                    <SelectTrigger><SelectValue placeholder="Selecionar pessoa" /></SelectTrigger>
                    <SelectContent>
                      {availableProfiles.length === 0 && <div className="px-2 py-1.5 text-xs text-muted-foreground">Todos já adicionados</div>}
                      {availableProfiles.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Função (ex.: Designer, PM)" value={newMemberRole} onChange={e => setNewMemberRole(e.target.value)} />
                  <Button
                    className="rounded-full gap-1.5"
                    disabled={!newMemberId || addMember.isPending}
                    onClick={() => {
                      addMember.mutate({ userId: newMemberId, role: newMemberRole }, {
                        onSuccess: () => { setNewMemberId(""); setNewMemberRole(""); },
                      });
                    }}
                  >
                    <Plus className="h-4 w-4" /> Adicionar
                  </Button>
                </div>

                <ul className="mt-3 divide-y divide-border rounded-xl border bg-background overflow-hidden">
                  {members.length === 0 && (
                    <li className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum membro vinculado ainda.</li>
                  )}
                  {members.map(m => {
                    const p = profileById[m.user_id];
                    const name = p?.full_name || "Sem nome";
                    return (
                      <li key={m.id} className="px-3 py-2.5 flex items-center gap-3">
                        <span className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-semibold inline-flex items-center justify-center">
                          {name.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{name}</div>
                          {m.role && <div className="text-xs text-muted-foreground truncate">{m.role}</div>}
                        </div>
                        <Badge variant="outline" className="rounded-full">Membro</Badge>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeMember.mutate(m.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </Section>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div
          className="px-7 py-4 flex items-center justify-between"
          style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}
        >
          <p className="text-xs" style={{ color: "var(--muted)" }}>Alterações são aplicadas imediatamente após salvar.</p>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="rounded-full min-w-[160px]" onClick={onSubmit} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- helpers ---------- */

function Section({
  icon, title, description, right, children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
    >
      <header
        className="px-5 py-3.5 flex items-start justify-between gap-3"
        style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="h-8 w-8 rounded-lg inline-flex items-center justify-center shrink-0"
            style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight" style={{ color: "var(--text)" }}>{title}</h3>
            {description && <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{description}</p>}
          </div>
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({
  label, hint, icon, required, className, children,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
        {icon}
        <span>{label}{required && <span className="text-primary ml-0.5">*</span>}</span>
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MoneyInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground pointer-events-none">R$</span>
      <Input
        type="number"
        step="0.01"
        className="pl-9"
        value={value ?? ""}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        placeholder="0,00"
      />
    </div>
  );
}

function ToggleCard({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 cursor-pointer transition"
      style={{
        background: checked ? "var(--primary-soft)" : "var(--surface)",
        border: `1px solid ${checked ? "var(--primary)" : "var(--border)"}`,
      }}
    >
      <span className="text-sm font-medium" style={{ color: "var(--text)" }}>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
