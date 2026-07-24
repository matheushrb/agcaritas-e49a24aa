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
  Building2, Wrench, Share2, Workflow, TrendingUp, UserCog, Plug, Zap, DollarSign, FolderKanban,
} from "lucide-react";
import { toast } from "sonner";
import { TaskTypesEditor } from "@/components/settings/task-types-editor";
import { AutomationsTab } from "@/components/settings/automations-tab";
import { AgencyPricingTab } from "@/components/settings/agency-pricing";
import { CatalogEditor } from "@/components/settings/catalog-editor";
import { ProjectTypesEditor } from "@/components/settings/project-types-editor";
import { NewsEditor } from "@/components/settings/news-editor";


export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Configurações · Caritas" }] }),
  component: SettingsPage,
});

const TABS = [
  { value: "agency",       label: "Dados da Agência",  icon: Building2 },
  { value: "pricing",      label: "Precificação",      icon: DollarSign },
  { value: "project-types",label: "Tipos de Projeto",  icon: FolderKanban },
  { value: "services",     label: "Serviços",          icon: Wrench },
  { value: "platforms",    label: "Plataformas",       icon: Share2 },
  { value: "task-flows",   label: "Tipos de Tarefa",   icon: Workflow },
  { value: "automations",  label: "Automações",        icon: Zap },
  { value: "crm-funnel",   label: "Funil CRM",         icon: TrendingUp },
  { value: "news",         label: "Painel de Notícias",icon: Newspaper },
  { value: "users",        label: "Usuários",          icon: UserCog },
  { value: "integrations", label: "Integrações",       icon: Plug },
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
        <TabsContent value="project-types" className="mt-4">
          <ProjectTypesEditor />
        </TabsContent>

        <TabsContent value="services" className="mt-4"><ComingSoonCard title="Serviços" hint="Catálogo de serviços (nome, valor base, descrição). Usado nas linhas de proposta." /></TabsContent>
        <TabsContent value="platforms" className="mt-4">
          <CatalogEditor table="platforms" showCategory title="Plataformas"
            hint="Redes sociais, canais e plataformas de mídia usadas nos projetos e entregáveis." />
        </TabsContent>
        <TabsContent value="task-flows" className="mt-4"><TaskTypesEditor /></TabsContent>
        <TabsContent value="automations" className="mt-4"><AutomationsTab /></TabsContent>
        <TabsContent value="crm-funnel" className="mt-4"><ComingSoonCard title="Funil CRM" hint="Etapas do pipeline com probabilidade padrão, ordem e flags ganho/perdido." /></TabsContent>
        <TabsContent value="news" className="mt-4"><NewsEditor /></TabsContent>
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
  const [form, setForm] = useState({
    name: "", legal_name: "", tax_id: "", email: "", phone: "", address: "", website: "", bank_info: "",
  });
  useEffect(() => {
    if (!org) return;
    setForm({
      name: org.name ?? "",
      legal_name: (org as any).legal_name ?? "",
      tax_id: (org as any).tax_id ?? "",
      email: (org as any).email ?? "",
      phone: (org as any).phone ?? "",
      address: (org as any).address ?? "",
      website: (org as any).website ?? "",
      bank_info: (org as any).bank_info ?? "",
    });
  }, [org]);

  const save = useMutation({
    mutationFn: async () => {
      if (!org?.id) throw new Error("Organização não encontrada");
      const { error } = await supabase.from("organizations").update(form).eq("id", org.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Dados atualizados"); qc.invalidateQueries({ queryKey: ["organization"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const bind = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value })),
  });

  return (
    <Card className="rounded-2xl p-6 max-w-3xl space-y-5">
      <div className="space-y-1">
        <div className="text-sm font-medium">Identificação da agência emissora</div>
        <p className="text-xs text-muted-foreground">Estes dados aparecem no cabeçalho de faturas, propostas e contratos.</p>
      </div>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Nome fantasia</Label>
            <Input placeholder="Caritas Agência" {...bind("name")} />
          </div>
          <div className="space-y-1.5">
            <Label>Razão social</Label>
            <Input placeholder="Caritas Agência LTDA" {...bind("legal_name")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>CNPJ</Label>
            <Input placeholder="00.000.000/0001-00" {...bind("tax_id")} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input placeholder="(11) 99999-9999" {...bind("phone")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>E-mail financeiro</Label>
            <Input placeholder="financeiro@caritas.ag" {...bind("email")} />
          </div>
          <div className="space-y-1.5">
            <Label>Site</Label>
            <Input placeholder="https://caritas.ag" {...bind("website")} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Endereço</Label>
          <Textarea placeholder="Rua, número, complemento, bairro, cidade/UF, CEP" rows={2} {...bind("address")} />
        </div>
        <div className="space-y-1.5">
          <Label>Dados bancários</Label>
          <Textarea placeholder="Banco · Agência · Conta · PIX · Titular" rows={2} {...bind("bank_info")} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button className="rounded-full" disabled={!form.name.trim() || save.isPending} onClick={() => save.mutate()}>Salvar</Button>
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
