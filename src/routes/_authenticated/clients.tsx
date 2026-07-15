import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EntityDialog, DialogField, DialogCancelButton } from "@/components/entity-dialog";
import { Search, Plus, Users, Mail, Phone, MapPin, Building2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  maskTaxId, maskPhone, maskCEP, onlyDigits,
  fetchCNPJ, fetchCEP, money, avatarColor, initials,
} from "@/lib/br-utils";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clientes · Caritas Agência" }] }),
  component: ClientsPage,
});

type Client = {
  id: string; name: string; company: string | null; email: string | null; phone: string | null;
  segment: string | null; notes: string | null; website: string | null;
  address_zip: string | null; address_street: string | null; address_city: string | null; address_state: string | null;
  tax_id: string | null; legal_name: string | null; type: string | null; status: string | null;
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  active:   { label: "Ativo",    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  inactive: { label: "Inativo",  color: "bg-muted text-muted-foreground" },
  prospect: { label: "Prospecto", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
};

function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openNew, setOpenNew] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const filtered = useMemo(() => clients.filter(c => {
    const s = search.toLowerCase();
    const matchS = !s || c.name.toLowerCase().includes(s) || (c.company ?? "").toLowerCase().includes(s);
    const matchStatus = statusFilter === "all" || (c.status ?? "active") === statusFilter;
    return matchS && matchStatus;
  }), [clients, search, statusFilter]);

  const selected = clients.find(c => c.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastro, contatos, financeiro e histórico de cada conta.</p>
        </div>
        <Button className="rounded-full gap-1.5" onClick={() => setOpenNew(true)}>
          <Plus className="h-4 w-4" /> Novo cliente
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou empresa" className="pl-9 rounded-full" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] rounded-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {Object.keys(STATUS_META).map(k => <SelectItem key={k} value={k}>{STATUS_META[k].label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="rounded-3xl p-12 text-center">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <div className="font-medium">Nenhum cliente encontrado</div>
          <p className="text-sm text-muted-foreground mt-1">Cadastre seu primeiro cliente para começar.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => {
            const status = c.status ?? "active";
            return (
              <button key={c.id} onClick={() => setSelectedId(c.id)} className="text-left">
                <Card className="rounded-2xl p-5 hover:shadow-md transition-shadow h-full">
                  <div className="flex items-start gap-3">
                    <div className={cn("h-11 w-11 rounded-xl grid place-items-center text-white font-semibold shrink-0", avatarColor(c.name))}>
                      {initials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.segment || c.company || "—"}</div>
                    </div>
                    <Badge className={cn("rounded-full shrink-0", STATUS_META[status]?.color)}>{STATUS_META[status]?.label ?? status}</Badge>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {c.email && <div className="flex items-center gap-1.5 truncate"><Mail className="h-3 w-3 shrink-0" />{c.email}</div>}
                    {c.phone && <div className="flex items-center gap-1.5"><Phone className="h-3 w-3 shrink-0" />{c.phone}</div>}
                    {(c.address_city || c.address_state) && (
                      <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 shrink-0" />{[c.address_city, c.address_state].filter(Boolean).join(" / ")}</div>
                    )}
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <NewClientDialog open={openNew} onOpenChange={setOpenNew} onCreated={(id) => { qc.invalidateQueries({ queryKey: ["clients"] }); setSelectedId(id); }} />
      <ClientDetailSheet client={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

// ============ New Client Dialog ============
function NewClientDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({
    name: "", type: "pj", tax_id: "", legal_name: "", segment: "",
    email: "", phone: "", status: "active",
    address_street: "", address_city: "", address_state: "", address_zip: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) setForm({ name: "", type: "pj", tax_id: "", legal_name: "", segment: "", email: "", phone: "", status: "active", address_street: "", address_city: "", address_state: "", address_zip: "" });
  }, [open]);

  const onBlurTaxId = async () => {
    if (form.type !== "pj") return;
    if (onlyDigits(form.tax_id).length !== 14) return;
    const info = await fetchCNPJ(form.tax_id);
    if (info) {
      setForm(f => ({
        ...f,
        legal_name: info.legal_name ?? f.legal_name,
        name: f.name || info.trade_name || info.legal_name || f.name,
        address_street: info.address_street ?? f.address_street,
        address_city: info.address_city ?? f.address_city,
        address_state: info.address_state ?? f.address_state,
        address_zip: info.address_zip ?? f.address_zip,
        email: f.email || info.email || "",
        phone: f.phone || info.phone || "",
      }));
      toast.success("Dados preenchidos via CNPJ");
    }
  };

  const submit = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", userRes.user!.id).maybeSingle();
      if (!p?.organization_id) throw new Error("Sem organização");
      const { data, error } = await supabase.from("clients").insert({
        ...form, organization_id: p.organization_id,
      }).select("id").single();
      if (error) throw error;
      toast.success("Cliente criado");
      onOpenChange(false);
      onCreated(data.id);
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityDialog
      open={open} onOpenChange={onOpenChange}
      icon={Users} tone="blue"
      eyebrow="Novo registro" title="Novo cliente" subtitle="Preencha os dados básicos; o CNPJ preenche endereço e razão social."
      size="lg"
      main={
        <>
          <DialogField label="Nome / Nome fantasia *">
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Acme Ltda" />
          </DialogField>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="Tipo">
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                  <SelectItem value="pf">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>
            </DialogField>
            <DialogField label={form.type === "pj" ? "CNPJ" : "CPF"} hint={form.type === "pj" ? "Digite completo para autopreencher" : undefined}>
              <Input
                value={form.tax_id}
                onChange={e => setForm(f => ({ ...f, tax_id: maskTaxId(e.target.value) }))}
                onBlur={onBlurTaxId}
                placeholder={form.type === "pj" ? "00.000.000/0000-00" : "000.000.000-00"}
              />
            </DialogField>
          </div>
          <DialogField label="Razão social">
            <Input value={form.legal_name} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} />
          </DialogField>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="E-mail">
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </DialogField>
            <DialogField label="Telefone">
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: maskPhone(e.target.value) }))} />
            </DialogField>
          </div>
          <DialogField label="Segmento">
            <Input value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))} placeholder="Ex: E-commerce, Educação..." />
          </DialogField>
        </>
      }
      sidebar={
        <>
          <DialogField label="Status">
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(STATUS_META).map(k => <SelectItem key={k} value={k}>{STATUS_META[k].label}</SelectItem>)}
              </SelectContent>
            </Select>
          </DialogField>
          <DialogField label="Cidade / UF">
            <div className="grid grid-cols-[1fr_60px] gap-2">
              <Input value={form.address_city} onChange={e => setForm(f => ({ ...f, address_city: e.target.value }))} />
              <Input value={form.address_state} onChange={e => setForm(f => ({ ...f, address_state: e.target.value.toUpperCase().slice(0, 2) }))} />
            </div>
          </DialogField>
        </>
      }
      footer={
        <>
          <DialogCancelButton onClick={() => onOpenChange(false)} />
          <Button className="rounded-full" disabled={saving} onClick={submit}>{saving ? "Salvando..." : "Criar cliente"}</Button>
        </>
      }
    />
  );
}

// ============ Client Detail Sheet ============
function ClientDetailSheet({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async (patch: Partial<Client>) => {
      const { error } = await supabase.from("clients").update(patch).eq("id", client!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const [local, setLocal] = useState<Client | null>(client);
  useEffect(() => setLocal(client), [client?.id]);

  const commit = (patch: Partial<Client>) => {
    setLocal(l => l ? { ...l, ...patch } : l);
    save.mutate(patch);
  };

  const onCEPBlur = async (cep: string) => {
    const info = await fetchCEP(cep);
    if (info) commit({ address_street: info.address_street, address_city: info.address_city, address_state: info.address_state });
  };

  if (!local) return null;

  return (
    <Sheet open={!!client} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className={cn("h-12 w-12 rounded-2xl grid place-items-center text-white font-semibold", avatarColor(local.name))}>
              {initials(local.name)}
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate">{local.name}</SheetTitle>
              <div className="text-xs text-muted-foreground truncate">{local.segment || local.legal_name || "—"}</div>
            </div>
            <Badge className={cn("rounded-full", STATUS_META[local.status ?? "active"]?.color)}>
              {STATUS_META[local.status ?? "active"]?.label}
            </Badge>
          </div>
        </SheetHeader>

        <Tabs defaultValue="overview" className="mt-5">
          <TabsList className="rounded-full bg-muted/60 h-auto flex-wrap">
            <TabsTrigger value="overview" className="rounded-full">Visão Geral</TabsTrigger>
            <TabsTrigger value="contacts" className="rounded-full">Contatos</TabsTrigger>
            <TabsTrigger value="projects" className="rounded-full">Projetos</TabsTrigger>
            <TabsTrigger value="proposals" className="rounded-full">Propostas</TabsTrigger>
            <TabsTrigger value="finance" className="rounded-full">Financeiro</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-3">
            <FieldRow label="Nome fantasia" value={local.name} onSave={(v) => commit({ name: v })} />
            <FieldRow label="Razão social" value={local.legal_name ?? ""} onSave={(v) => commit({ legal_name: v })} />
            <FieldRow label="CNPJ/CPF" value={local.tax_id ?? ""} mask={maskTaxId} onSave={(v) => commit({ tax_id: v })} />
            <FieldRow label="Segmento" value={local.segment ?? ""} onSave={(v) => commit({ segment: v })} />
            <FieldRow label="Site" value={local.website ?? ""} onSave={(v) => commit({ website: v })} />
            <FieldRow label="E-mail" value={local.email ?? ""} onSave={(v) => commit({ email: v })} />
            <FieldRow label="Telefone" value={local.phone ?? ""} mask={maskPhone} onSave={(v) => commit({ phone: v })} />
            <FieldRow label="CEP" value={local.address_zip ?? ""} mask={maskCEP} onSave={(v) => { commit({ address_zip: v }); onCEPBlur(v); }} />
            <FieldRow label="Rua / Bairro" value={local.address_street ?? ""} onSave={(v) => commit({ address_street: v })} />
            <div className="grid grid-cols-[1fr_80px] gap-2">
              <FieldRow label="Cidade" value={local.address_city ?? ""} onSave={(v) => commit({ address_city: v })} />
              <FieldRow label="UF" value={local.address_state ?? ""} onSave={(v) => commit({ address_state: v.toUpperCase().slice(0,2) })} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Observações</label>
              <Textarea
                defaultValue={local.notes ?? ""}
                onBlur={(e) => e.target.value !== (local.notes ?? "") && commit({ notes: e.target.value })}
                className="rounded-xl mt-1" rows={4}
              />
            </div>
            <div className="pt-2">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={local.status ?? "active"} onValueChange={(v) => commit({ status: v })}>
                <SelectTrigger className="rounded-full mt-1 w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(STATUS_META).map(k => <SelectItem key={k} value={k}>{STATUS_META[k].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="contacts" className="mt-4">
            <ContactsTab clientId={local.id} />
          </TabsContent>

          <TabsContent value="projects" className="mt-4">
            <ClientProjectsTab clientId={local.id} />
          </TabsContent>

          <TabsContent value="proposals" className="mt-4">
            <ClientProposalsTab clientId={local.id} />
          </TabsContent>

          <TabsContent value="finance" className="mt-4">
            <ClientFinanceTab clientId={local.id} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function FieldRow({ label, value, mask, onSave }: { label: string; value: string; mask?: (v: string) => string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Input
        value={v}
        onChange={(e) => setV(mask ? mask(e.target.value) : e.target.value)}
        onBlur={() => v !== value && onSave(v)}
        className="rounded-xl mt-1"
      />
    </div>
  );
}

type Contact = { id: string; name: string; role: string | null; email: string | null; phone: string | null; whatsapp: string | null };

function ContactsTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["client-contacts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_contacts" as any).select("id,name,role,email,phone,whatsapp").eq("client_id", clientId).order("created_at");
      if (error) return [];
      return (data as any) ?? [];
    },
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", email: "", phone: "", whatsapp: "" });

  const add = async () => {
    if (!form.name.trim()) return;
    const { data: userRes } = await supabase.auth.getUser();
    const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", userRes.user!.id).maybeSingle();
    if (!p?.organization_id) return;
    const { error } = await supabase.from("client_contacts" as any).insert({
      client_id: clientId, organization_id: p.organization_id, ...form,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Contato adicionado");
    setForm({ name: "", role: "", email: "", phone: "", whatsapp: "" });
    setShowForm(false);
    qc.invalidateQueries({ queryKey: ["client-contacts", clientId] });
  };
  const remove = async (id: string) => {
    await supabase.from("client_contacts" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["client-contacts", clientId] });
  };

  return (
    <div className="space-y-3">
      {contacts.map(c => (
        <Card key={c.id} className="rounded-2xl p-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-medium">{c.name}</div>
            {c.role && <div className="text-xs text-muted-foreground">{c.role}</div>}
            <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-3">
              {c.email && <span><Mail className="inline h-3 w-3 mr-1" />{c.email}</span>}
              {c.phone && <span><Phone className="inline h-3 w-3 mr-1" />{c.phone}</span>}
              {c.whatsapp && <span>WA: {c.whatsapp}</span>}
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </Card>
      ))}
      {showForm ? (
        <Card className="rounded-2xl p-4 space-y-2">
          <Input placeholder="Nome *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input placeholder="Cargo" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
          <Input placeholder="E-mail" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <Input placeholder="Telefone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: maskPhone(e.target.value) }))} />
          <Input placeholder="WhatsApp" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: maskPhone(e.target.value) }))} />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" className="rounded-full" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button className="rounded-full" onClick={add}>Adicionar</Button>
          </div>
        </Card>
      ) : (
        <Button variant="outline" className="rounded-full w-full gap-1.5" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Adicionar contato
        </Button>
      )}
    </div>
  );
}

function ClientProjectsTab({ clientId }: { clientId: string }) {
  const navigate = useNavigate();
  const { data: projects = [] } = useQuery({
    queryKey: ["client-projects", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id,name,status").eq("client_id", clientId);
      return data ?? [];
    },
  });
  if (projects.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">Nenhum projeto vinculado.</p>;
  return (
    <div className="space-y-2">
      {projects.map((p: any) => (
        <Card key={p.id} className="rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:shadow-md" onClick={() => navigate({ to: "/projects/$projectId", params: { projectId: p.id } })}>
          <Building2 className="h-4 w-4 text-primary" />
          <div className="flex-1 font-medium">{p.name}</div>
          <Badge variant="outline" className="rounded-full">{p.status}</Badge>
        </Card>
      ))}
    </div>
  );
}

function ClientProposalsTab({ clientId }: { clientId: string }) {
  const { data: proposals = [] } = useQuery({
    queryKey: ["client-proposals", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("proposals").select("id,title,status,total_value").eq("client_id", clientId);
      return data ?? [];
    },
  });
  if (proposals.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">Nenhuma proposta vinculada.</p>;
  return (
    <div className="space-y-2">
      {proposals.map((p: any) => (
        <Card key={p.id} className="rounded-2xl p-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="font-medium">{p.title}</div>
            <div className="text-xs text-muted-foreground">{money(p.total_value)}</div>
          </div>
          <Badge variant="outline" className="rounded-full">{p.status}</Badge>
        </Card>
      ))}
    </div>
  );
}

function ClientFinanceTab({ clientId }: { clientId: string }) {
  const { data: charges = [] } = useQuery({
    queryKey: ["client-charges", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("charges").select("id,description,amount,status,due_date,paid_at").eq("client_id", clientId);
      return data ?? [];
    },
  });
  const total = charges.reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);
  const paid = charges.filter((c: any) => c.status === "paid").reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);
  const pending = total - paid;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Card className="rounded-2xl p-3"><div className="text-xs text-muted-foreground">Total</div><div className="font-semibold">{money(total)}</div></Card>
        <Card className="rounded-2xl p-3"><div className="text-xs text-muted-foreground">Recebido</div><div className="font-semibold text-emerald-600">{money(paid)}</div></Card>
        <Card className="rounded-2xl p-3"><div className="text-xs text-muted-foreground">Pendente</div><div className="font-semibold text-amber-600">{money(pending)}</div></Card>
      </div>
      {charges.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma cobrança vinculada.</p>
      ) : (
        <div className="space-y-2">
          {charges.map((c: any) => (
            <Card key={c.id} className="rounded-2xl p-3 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{c.description}</div>
                <div className="text-xs text-muted-foreground">{c.due_date}</div>
              </div>
              <div className="font-semibold">{money(c.amount)}</div>
              <Badge variant="outline" className="rounded-full">{c.status}</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
