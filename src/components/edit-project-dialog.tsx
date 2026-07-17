import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { X, Plus, Users as UsersIcon } from "lucide-react";
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
};

type Client = { id: string; name: string; trade_name: string | null };
type Profile = { id: string; full_name: string | null; avatar_url: string | null };
type Member = { id: string; user_id: string; role: string | null };

const STRATEGY_KEYS: { key: string; label: string }[] = [
  { key: "swot", label: "SWOT" },
  { key: "personas", label: "Personas" },
  { key: "competitors", label: "Concorrentes" },
  { key: "roadmap", label: "Roadmap" },
  { key: "kpis", label: "KPIs" },
  { key: "action_plan", label: "Plano de ação" },
];

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

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,avatar_url");
      return (data ?? []) as Profile[];
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
  const traffic = form.traffic_budget ?? { enabled: false, amount: null, platforms: [] };

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
    });
  };

  const availableProfiles = profiles.filter(p => !members.some(m => m.user_id === p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[880px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar projeto</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="rounded-full bg-muted/60 w-fit">
            <TabsTrigger value="general" className="rounded-full">Geral</TabsTrigger>
            <TabsTrigger value="billing" className="rounded-full">Faturamento</TabsTrigger>
            <TabsTrigger value="scope" className="rounded-full">Escopo</TabsTrigger>
            <TabsTrigger value="team" className="rounded-full">Equipe</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto pt-4 pr-1 space-y-4">
            <TabsContent value="general" className="space-y-4 m-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={e => set("name", e.target.value)} />
                </div>
                <div>
                  <Label>Cliente</Label>
                  <Select value={form.client_id ?? "none"} onValueChange={v => set("client_id", v === "none" ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem cliente</SelectItem>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.trade_name || c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => set("status", v as ProjectStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">Planejamento</SelectItem>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="review">Revisão</SelectItem>
                      <SelectItem value="done">Concluído</SelectItem>
                      <SelectItem value="paused">Pausado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Início</Label>
                  <Input type="date" value={form.start_date ?? ""} onChange={e => set("start_date", e.target.value || null)} />
                </div>
                <div>
                  <Label>Prazo final</Label>
                  <Input type="date" value={form.end_date ?? ""} onChange={e => set("end_date", e.target.value || null)} />
                </div>
                <div>
                  <Label>Urgência</Label>
                  <Select value={form.urgency ?? "normal"} onValueChange={v => set("urgency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="critical">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de projeto</Label>
                  <Input value={form.project_type ?? ""} onChange={e => set("project_type", e.target.value || null)} placeholder="Ex.: Social media" />
                </div>
                <div className="md:col-span-2">
                  <Label>Descrição / Briefing</Label>
                  <Textarea rows={4} value={form.description ?? ""} onChange={e => set("description", e.target.value || null)} />
                </div>
                <div className="md:col-span-2">
                  <Label>Notas internas</Label>
                  <Textarea rows={3} value={form.notes ?? ""} onChange={e => set("notes", e.target.value || null)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="billing" className="space-y-4 m-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Modelo de faturamento</Label>
                  <Select value={form.billing_model ?? "monthly"} onValueChange={v => set("billing_model", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal (fee)</SelectItem>
                      <SelectItem value="fixed">Valor fechado</SelectItem>
                      <SelectItem value="hourly">Por hora</SelectItem>
                      <SelectItem value="per_task">Por tarefa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor fechado (R$)</Label>
                  <Input type="number" step="0.01" value={form.fixed_value ?? ""} onChange={e => set("fixed_value", e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div>
                  <Label>Fee mensal (R$)</Label>
                  <Input type="number" step="0.01" value={form.monthly_value ?? ""} onChange={e => set("monthly_value", e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div>
                  <Label>Valor/hora (R$)</Label>
                  <Input type="number" step="0.01" value={form.hourly_rate ?? ""} onChange={e => set("hourly_rate", e.target.value ? Number(e.target.value) : null)} />
                </div>
                <div>
                  <Label>Verba de impressão (R$)</Label>
                  <Input type="number" step="0.01" value={form.printing_budget ?? ""} onChange={e => set("printing_budget", e.target.value ? Number(e.target.value) : null)} />
                </div>
              </div>

              <div className="rounded-2xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Verba de tráfego</div>
                    <p className="text-xs text-muted-foreground">Ativa a aba de Tráfego e Campanhas.</p>
                  </div>
                  <Switch
                    checked={!!traffic.enabled}
                    onCheckedChange={v => set("traffic_budget", { ...traffic, enabled: v })}
                  />
                </div>
                {traffic.enabled && (
                  <div>
                    <Label>Valor mensal (R$)</Label>
                    <Input
                      type="number" step="0.01"
                      value={traffic.amount ?? ""}
                      onChange={e => set("traffic_budget", { ...traffic, amount: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="scope" className="space-y-4 m-0">
              <div className="rounded-2xl border p-4 space-y-3">
                <div className="text-sm font-medium">Módulos ativos no projeto</div>
                <ToggleRow label="Calendário de conteúdo" checked={form.has_content_calendar} onChange={v => set("has_content_calendar", v)} />
                <ToggleRow label="Grid de conteúdo" checked={form.has_content_grid} onChange={v => set("has_content_grid", v)} />
                <ToggleRow label="Timeline" checked={form.has_timeline} onChange={v => set("has_timeline", v)} />
              </div>

              <div className="rounded-2xl border p-4 space-y-3">
                <div className="text-sm font-medium">Estratégia</div>
                {STRATEGY_KEYS.map(({ key, label }) => (
                  <ToggleRow
                    key={key}
                    label={label}
                    checked={!!scope[key]}
                    onChange={v => set("scope_flags", { ...scope, [key]: v })}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="team" className="space-y-4 m-0">
              <div className="rounded-2xl border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <UsersIcon className="h-4 w-4 text-primary" />
                  <div className="text-sm font-medium">Equipe do projeto</div>
                </div>

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
                  <Input placeholder="Função (opcional)" value={newMemberRole} onChange={e => setNewMemberRole(e.target.value)} />
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

                <ul className="divide-y divide-border rounded-xl border overflow-hidden">
                  {members.length === 0 && (
                    <li className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum membro vinculado ainda.</li>
                  )}
                  {members.map(m => {
                    const p = profileById[m.user_id];
                    const name = p?.full_name || "Sem nome";
                    return (
                      <li key={m.id} className="px-3 py-2 flex items-center gap-3">
                        <span className="h-7 w-7 rounded-full bg-primary/15 text-primary text-xs font-semibold inline-flex items-center justify-center">
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
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="pt-2">
          <Button variant="outline" className="rounded-full" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="rounded-full" onClick={onSubmit} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={cn("flex items-center justify-between py-1")}>
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
