import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2, Wrench, Share2, Workflow, TrendingUp, UserCog, Plug, Zap, DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { TaskTypesEditor } from "@/components/settings/task-types-editor";
import { AutomationsTab } from "@/components/settings/automations-tab";
import { AgencyPricingTab } from "@/components/settings/agency-pricing";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações · Caritas" }] }),
  component: SettingsPage,
});

const TABS = [
  { value: "agency",       label: "Dados da Agência", icon: Building2 },
  { value: "pricing",      label: "Precificação",     icon: DollarSign },
  { value: "services",     label: "Serviços",         icon: Wrench },
  { value: "platforms",    label: "Plataformas",      icon: Share2 },
  { value: "task-flows",   label: "Tipos de Tarefa",  icon: Workflow },
  { value: "automations",  label: "Automações",       icon: Zap },
  { value: "crm-funnel",   label: "Funil CRM",        icon: TrendingUp },
  { value: "users",        label: "Usuários",         icon: UserCog },
  { value: "integrations", label: "Integrações",      icon: Plug },
] as const;

function SettingsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Configurações globais da agência — dados cadastrais, serviços, plataformas, tipos de tarefa, funil, usuários e integrações.</p>
      </header>

      <Tabs defaultValue="agency">
        <div className="overflow-x-auto">
          <TabsList className="rounded-full bg-muted/60 h-auto flex-wrap">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.value} value={t.value} className="rounded-full gap-1.5">
                  <Icon className="h-4 w-4" />{t.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="agency" className="mt-4"><AgencyTab /></TabsContent>
        <TabsContent value="pricing" className="mt-4"><AgencyPricingTab /></TabsContent>
        <TabsContent value="services" className="mt-4"><ComingSoonCard title="Serviços" hint="Catálogo de serviços (nome, valor base, descrição). Usado nas linhas de proposta." /></TabsContent>
        <TabsContent value="platforms" className="mt-4"><ComingSoonCard title="Plataformas" hint="Instagram, TikTok, YouTube etc. — regras de prazo de entrega por tipo e cor por plataforma." /></TabsContent>
        <TabsContent value="task-flows" className="mt-4"><TaskTypesEditor /></TabsContent>
        <TabsContent value="automations" className="mt-4"><AutomationsTab /></TabsContent>
        <TabsContent value="crm-funnel" className="mt-4"><ComingSoonCard title="Funil CRM" hint="Etapas do pipeline com probabilidade padrão, ordem e flags ganho/perdido." /></TabsContent>
        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
        <TabsContent value="integrations" className="mt-4"><ComingSoonCard title="Integrações" hint="Buffer (token + profile IDs), Google Calendar (OAuth) — configuração centralizada." /></TabsContent>
      </Tabs>
    </div>
  );
}

function AgencyTab() {
  const qc = useQueryClient();
  const { data: org } = useQuery({
    queryKey: ["organization"],
    queryFn: async () => {
      const { data: p } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!p?.organization_id) return null;
      const { data } = await supabase.from("organizations").select("*").eq("id", p.organization_id).maybeSingle();
      return data;
    },
  });
  const [name, setName] = useState("");
  useEffect(() => { if (org?.name) setName(org.name); }, [org?.name]);

  const save = useMutation({
    mutationFn: async () => {
      if (!org?.id) throw new Error("Organização não encontrada");
      const { error } = await supabase.from("organizations").update({ name }).eq("id", org.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Dados atualizados"); qc.invalidateQueries({ queryKey: ["organization"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="rounded-2xl p-6 max-w-2xl space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-medium">Identificação</div>
        <p className="text-xs text-muted-foreground">Razão social e dados básicos da agência. CNPJ, endereço e dados bancários chegam nas próximas etapas.</p>
      </div>
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="org-name">Razão social</Label>
          <Input id="org-name" value={name} onChange={e => setName(e.target.value)} placeholder="Agência Caritas" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>CNPJ</Label><Input placeholder="00.000.000/0001-00" disabled /></div>
          <div className="space-y-1.5"><Label>Telefone</Label><Input placeholder="(11) 99999-9999" disabled /></div>
        </div>
        <div className="space-y-1.5"><Label>Endereço</Label><Textarea placeholder="Preenchimento por CEP em breve" rows={2} disabled /></div>
      </div>
      <div className="flex justify-end">
        <Button className="rounded-full" disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>Salvar</Button>
      </div>
    </Card>
  );
}

function UsersTab() {
  const { data: users = [] } = useQuery({
    queryKey: ["settings-users"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      return data ?? [];
    },
  });
  return (
    <Card className="rounded-2xl p-6 space-y-3">
      <div className="text-sm font-medium">Usuários com acesso</div>
      <ul className="divide-y divide-border">
        {users.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nenhum usuário cadastrado ainda.</li>}
        {users.map(u => (
          <li key={u.id} className="py-3 flex items-center justify-between">
            <div className="text-sm">{u.full_name ?? "Sem nome"}</div>
            <span className="text-xs text-muted-foreground">Membro</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Convites, papéis (admin / gerente / membro) e revogação de acesso serão adicionados na próxima etapa.</p>
    </Card>
  );
}

function ComingSoonCard({ title, hint }: { title: string; hint: string }) {
  return (
    <Card className="rounded-2xl p-8 text-center border-dashed">
      <div className="font-medium">{title}</div>
      <p className="text-sm text-muted-foreground mt-1 max-w-xl mx-auto">{hint}</p>
      <p className="text-[11px] text-muted-foreground mt-3">Estrutura pronta — editores dedicados serão implementados na próxima etapa.</p>
    </Card>
  );
}
