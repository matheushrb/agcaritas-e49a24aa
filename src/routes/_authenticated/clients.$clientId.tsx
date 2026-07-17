import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityDialog, DialogField, DialogCancelButton } from "@/components/entity-dialog";
import {
  ChevronLeft, Mail, Phone, Building2, Globe, MapPin, Users, Briefcase, FileText,
  Plus, Save, Trash2, User as UserIcon, Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { NewClientDialog } from "./clients";


export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  head: () => ({ meta: [{ title: "Cliente · Caritas" }] }),
  component: ClientDetailPage,
});

type Client = {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  segment: string | null;
  status: string | null;
  company: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  notes: string | null;
};

type Contact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
};

const STATUS: Record<string, { label: string; color: string }> = {
  prospect: { label: "Prospect", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  active:   { label: "Ativo",    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  inactive: { label: "Inativo",  color: "bg-muted text-muted-foreground" },
  churned:  { label: "Churned",  color: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

const SEGMENTS = [
  "Tecnologia","Saúde","Educação","Varejo","Alimentação","Construção",
  "Financeiro","Jurídico","Marketing","Moda","Beleza","Automotivo",
  "Imobiliário","Entretenimento","Outro",
];

function ClientDetailPage() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: client, isLoading } = useQuery<Client | null>({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["client-contacts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_contacts")
        .select("id,name,role,email,phone,whatsapp")
        .eq("client_id", clientId).order("name");
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["client-projects", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects")
        .select("id,name,status,start_date,end_date,fixed_value,billing_model")
        .eq("client_id", clientId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: proposals = [] } = useQuery({
    queryKey: ["client-proposals", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("proposals")
        .select("id,number,status,total_value,billing_model,valid_until,created_at")
        .eq("client_id", clientId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const removeClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").delete().eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients-list"] });
      toast.success("Cliente excluído");
      navigate({ to: "/clients" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (!client) return (
    <Card className="rounded-3xl p-12 text-center border-dashed">
      <div className="font-medium">Cliente não encontrado</div>
      <Link to="/clients" className="text-sm text-primary underline mt-2 inline-block">Voltar para lista</Link>
    </Card>
  );

  const initials = client.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <Link to="/clients" className="grid h-9 w-9 place-items-center rounded-full border border-border hover:bg-muted">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary font-display text-lg font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl font-bold tracking-tight truncate">{client.name}</h1>
              <Badge className={cn("rounded-full", STATUS[client.status ?? "prospect"]?.color ?? "bg-muted")}>
                {STATUS[client.status ?? "prospect"]?.label ?? "—"}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap mt-1">
              {client.segment && <span>{client.segment}</span>}
              {client.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{client.email}</span>}
              {client.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-full gap-1.5"
            onClick={() => { if (confirm("Excluir este cliente?")) removeClient.mutate(); }}>
            <Trash2 className="h-4 w-4" /> Excluir
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Projetos" value={projects.length.toString()} icon={Briefcase} />
        <Kpi label="Propostas" value={proposals.length.toString()} icon={FileText} />
        <Kpi label="Contatos" value={contacts.length.toString()} icon={Users} />
        <Kpi
          label="Ticket total propostas"
          value={`R$ ${proposals.reduce((s, p: any) => s + Number(p.total_value ?? 0), 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
        />
      </div>

      <Tabs defaultValue="data" className="space-y-4">
        <TabsList className="rounded-full bg-card border border-border p-1">
          <TabsTrigger value="data" className="rounded-full">Dados</TabsTrigger>
          <TabsTrigger value="contacts" className="rounded-full">Contatos</TabsTrigger>
          <TabsTrigger value="projects" className="rounded-full">Projetos</TabsTrigger>
          <TabsTrigger value="proposals" className="rounded-full">Propostas</TabsTrigger>
        </TabsList>

        <TabsContent value="data"><DataTab client={client} /></TabsContent>
        <TabsContent value="contacts"><ContactsTab clientId={clientId} contacts={contacts} /></TabsContent>
        <TabsContent value="projects"><ProjectsTab projects={projects as any[]} /></TabsContent>
        <TabsContent value="proposals"><ProposalsTab proposals={proposals as any[]} /></TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <Card className="rounded-2xl p-4 flex items-center gap-3">
      {Icon && <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>}
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold tracking-tight">{value}</div>
      </div>
    </Card>
  );
}

/* ============================================================
 * Aba Dados — edição inline
 * ============================================================ */
function DataTab({ client }: { client: Client }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Client>(client);
  useEffect(() => setForm(client), [client]);

  const dirty = JSON.stringify(form) !== JSON.stringify(client);

  const save = useMutation({
    mutationFn: async () => {
      const { id, ...rest } = form;
      const { error } = await supabase.from("clients").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      qc.invalidateQueries({ queryKey: ["clients-list"] });
      toast.success("Dados salvos");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patch = <K extends keyof Client>(k: K, v: Client[K]) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="rounded-2xl p-5 lg:col-span-2 space-y-4">
        <SectionTitle>Identificação</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Nome fantasia">
            <Input value={form.name} onChange={e => patch("name", e.target.value)} />
          </Field>
          <Field label="Razão social">
            <Input value={form.legal_name ?? ""} onChange={e => patch("legal_name", e.target.value)} />
          </Field>
          <Field label="CNPJ / CPF">
            <Input value={form.tax_id ?? ""} onChange={e => patch("tax_id", e.target.value)} placeholder="00.000.000/0000-00" />
          </Field>
          <Field label="Segmento">
            <Select value={form.segment ?? ""} onValueChange={v => patch("segment", v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <SectionTitle>Contato principal</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="E-mail"><Input type="email" value={form.email ?? ""} onChange={e => patch("email", e.target.value)} /></Field>
          <Field label="Telefone"><Input value={form.phone ?? ""} onChange={e => patch("phone", e.target.value)} /></Field>
          <Field label="Website"><Input value={form.website ?? ""} onChange={e => patch("website", e.target.value)} placeholder="https://" /></Field>
        </div>

        <SectionTitle>Endereço</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <Field label="CEP" className="md:col-span-2"><Input value={form.address_zip ?? ""} onChange={e => patch("address_zip", e.target.value)} /></Field>
          <Field label="Rua / Nº" className="md:col-span-4"><Input value={form.address_street ?? ""} onChange={e => patch("address_street", e.target.value)} /></Field>
          <Field label="Cidade" className="md:col-span-4"><Input value={form.address_city ?? ""} onChange={e => patch("address_city", e.target.value)} /></Field>
          <Field label="UF" className="md:col-span-2"><Input value={form.address_state ?? ""} onChange={e => patch("address_state", e.target.value)} maxLength={2} /></Field>
        </div>

        <SectionTitle>Observações</SectionTitle>
        <Textarea rows={4} value={form.notes ?? ""} onChange={e => patch("notes", e.target.value)} />

        <div className="flex justify-end pt-2 border-t border-border">
          <Button className="rounded-full gap-1.5" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            <Save className="h-4 w-4" /> {save.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </Card>

      <Card className="rounded-2xl p-5 space-y-4 h-fit">
        <SectionTitle>Status & Segmentação</SectionTitle>
        <Field label="Status">
          <Select value={form.status ?? "prospect"} onValueChange={v => patch("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Tipo de empresa">
          <Input value={form.company ?? ""} onChange={e => patch("company", e.target.value)} placeholder="Ex.: Ltda., MEI, S.A." />
        </Field>
      </Card>
    </div>
  );
}

/* ============================================================
 * Aba Contatos
 * ============================================================ */
function ContactsTab({ clientId, contacts }: { clientId: string; contacts: Contact[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const create = useMutation({
    mutationFn: async (input: Omit<Contact, "id">) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await supabase.from("client_contacts").insert({
        client_id: clientId,
        organization_id: profile.organization_id,
        name: input.name,
        role: input.role || null,
        email: input.email || null,
        phone: input.phone || null,
        whatsapp: input.whatsapp || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-contacts", clientId] });
      toast.success("Contato adicionado");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-contacts", clientId] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Stakeholders, decisores e responsáveis por área.</p>
        <Button className="rounded-full gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo contato</Button>
      </div>

      {contacts.length === 0 ? (
        <Card className="rounded-2xl p-8 text-center border-dashed">
          <Users className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <div className="text-sm">Nenhum contato cadastrado.</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {contacts.map(c => (
            <Card key={c.id} className="rounded-2xl p-4 flex items-start gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                <UserIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{c.name}</div>
                {c.role && <div className="text-xs text-muted-foreground truncate">{c.role}</div>}
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {c.email && <div className="truncate inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</div>}
                  {c.phone && <div className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</div>}
                </div>
              </div>
              <button
                onClick={() => { if (confirm("Excluir contato?")) remove.mutate(c.id); }}
                className="text-muted-foreground hover:text-destructive"
                title="Excluir"
              ><Trash2 className="h-4 w-4" /></button>
            </Card>
          ))}
        </div>
      )}

      <NewContactDialog open={open} onOpenChange={setOpen}
        onCreate={v => create.mutate(v)} pending={create.isPending} />
    </div>
  );
}

function NewContactDialog({
  open, onOpenChange, onCreate, pending,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onCreate: (v: Omit<Contact, "id">) => void; pending: boolean;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  useEffect(() => { if (!open) { setName(""); setRole(""); setEmail(""); setPhone(""); setWhatsapp(""); } }, [open]);

  return (
    <EntityDialog
      open={open} onOpenChange={onOpenChange}
      icon={UserIcon} tone="blue" eyebrow="Contatos" title="Novo contato"
      subtitle="Adicione um stakeholder ou decisor deste cliente."
      main={
        <>
          <DialogField label="Nome">
            <Input value={name} onChange={e => setName(e.target.value)} autoFocus />
          </DialogField>
          <DialogField label="Cargo / Papel">
            <Input value={role} onChange={e => setRole(e.target.value)} placeholder="Ex.: CEO, Head de Marketing" />
          </DialogField>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="E-mail"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></DialogField>
            <DialogField label="Telefone"><Input value={phone} onChange={e => setPhone(e.target.value)} /></DialogField>
          </div>
          <DialogField label="WhatsApp">
            <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
          </DialogField>
        </>
      }
      footer={
        <>
          <DialogCancelButton onClick={() => onOpenChange(false)} />
          <Button className="rounded-full" disabled={!name.trim() || pending}
            onClick={() => onCreate({ name: name.trim(), role, email, phone, whatsapp })}>
            Adicionar contato
          </Button>
        </>
      }
    />
  );
}

/* ============================================================
 * Aba Projetos
 * ============================================================ */
function ProjectsTab({ projects }: { projects: any[] }) {
  if (projects.length === 0) return (
    <Card className="rounded-2xl p-8 text-center border-dashed">
      <Briefcase className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
      <div className="text-sm">Nenhum projeto vinculado a este cliente.</div>
      <Link to="/projects" className="text-sm text-primary underline mt-2 inline-block">Ir para projetos</Link>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {projects.map(p => (
        <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }}>
          <Card className="rounded-2xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 capitalize">{p.billing_model ?? "—"}</div>
              </div>
              <Badge variant="outline" className="rounded-full">{p.status}</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span>{p.start_date ? new Date(p.start_date).toLocaleDateString("pt-BR") : "—"}</span>
              {p.fixed_value ? <span className="font-medium text-foreground">R$ {Number(p.fixed_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span> : null}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

/* ============================================================
 * Aba Propostas
 * ============================================================ */
function ProposalsTab({ proposals }: { proposals: any[] }) {
  if (proposals.length === 0) return (
    <Card className="rounded-2xl p-8 text-center border-dashed">
      <FileText className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
      <div className="text-sm">Nenhuma proposta vinculada.</div>
      <Link to="/proposals" className="text-sm text-primary underline mt-2 inline-block">Ir para propostas</Link>
    </Card>
  );

  const statusColor: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    sent: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    rejected: "bg-red-500/15 text-red-600 dark:text-red-400",
    negotiating: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  };

  return (
    <Card className="rounded-2xl overflow-hidden">
      <ul className="divide-y divide-border">
        {proposals.map(p => (
          <li key={p.id} className="px-4 py-3 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">#{p.number}</div>
              <div className="text-xs text-muted-foreground capitalize">{p.billing_model}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-semibold">R$ {Number(p.total_value ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
              <Badge className={cn("rounded-full mt-1", statusColor[p.status] ?? "bg-muted")}>{p.status}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ============================================================
 * Utils
 * ============================================================ */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground pt-2">{children}</div>;
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
