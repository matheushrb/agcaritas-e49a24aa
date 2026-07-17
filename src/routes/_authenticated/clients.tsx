import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EntityDialog, DialogField, DialogCancelButton } from "@/components/entity-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Search, Plus, Users as UsersIcon, Building2, Mail, Phone, Loader2, Sparkles,
  Pencil, Archive, Trash2, ArchiveRestore,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { lookupCNPJ, lookupCEP, maskCNPJ, maskCPF, maskCEP, maskPhone, onlyDigits } from "@/lib/br-lookup";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clientes · Caritas" }] }),
  component: ClientsPage,
});

const STATUS: Record<string, { label: string; color: string }> = {
  prospect: { label: "Prospect", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  active:   { label: "Ativo",    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  inactive: { label: "Inativo",  color: "bg-muted text-muted-foreground" },
  churned:  { label: "Churned",  color: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

const SEGMENTS = [
  "Tecnologia","Saúde","Educação","Varejo","Alimentação","Construção",
  "Financeiro","Jurídico","Marketing","Moda","Beleza","Automotivo",
  "Imobiliário","Entretenimento","Indústria","Serviços","Outro",
];

const SIZES = ["MEI","ME","EPP","Médio","Grande"];
const PAYMENT_TERMS = ["À vista","7 dias","15 dias","30 dias","30/60","30/60/90","Mensal recorrente"];
const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

type Client = {
  id: string;
  name: string;
  status: string | null;
  segment: string | null;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
};

function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [segment, setSegment] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,status,segment,email,phone,tax_id")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const { data: editingClient } = useQuery({
    queryKey: ["client-edit", editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", editingId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    let arr = clients;
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter(c => c.name.toLowerCase().includes(s) || (c.email ?? "").toLowerCase().includes(s));
    }
    if (status !== "all") arr = arr.filter(c => (c.status ?? "prospect") === status);
    if (segment !== "all") arr = arr.filter(c => c.segment === segment);
    return arr;
  }, [clients, search, status, segment]);

  const create = useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await supabase.from("clients").insert({ ...(input as { name: string }), organization_id: profile.organization_id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients-list"] }); toast.success("Cliente criado"); setNewOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      if (!editingId) throw new Error("Sem cliente");
      const { error } = await supabase.from("clients").update(input as never).eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients-list"] });
      qc.invalidateQueries({ queryKey: ["client-edit", editingId] });
      toast.success("Cliente atualizado");
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase.from("clients").update({ status: archived ? "inactive" : "active" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ["clients-list"] }); toast.success(v.archived ? "Cliente arquivado" : "Cliente reativado"); setRevealedId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients-list"] }); toast.success("Cliente excluído"); setRevealedId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Clientes</h1>
            <p className="text-sm text-muted-foreground">Base de clientes ativos, prospects e histórico — vinculados a projetos, propostas e financeiro.</p>
          </div>
          <Button className="rounded-full gap-1.5" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        </header>

        <Card className="p-3 rounded-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-full" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[150px] rounded-full"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger className="w-[170px] rounded-full"><SelectValue placeholder="Segmento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos segmentos</SelectItem>
                {SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <Card className="rounded-3xl p-12 text-center border-dashed">
            <UsersIcon className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <div className="font-medium">Nenhum cliente encontrado</div>
            <p className="text-sm text-muted-foreground mt-1">Cadastre seu primeiro cliente para vincular projetos e propostas.</p>
            <Button className="rounded-full mt-4" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" />Novo cliente</Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(c => {
              const revealed = revealedId === c.id;
              const isArchived = (c.status ?? "") === "inactive";
              return (
                <div
                  key={c.id}
                  className={cn(
                    "relative rounded-2xl border border-border bg-card overflow-hidden transition-shadow",
                    revealed ? "shadow-md" : "hover:shadow-md",
                  )}
                >
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => setRevealedId(revealed ? null : c.id)}
                      className={cn(
                        "text-left transition-[flex-basis] duration-300 ease-out min-w-0",
                        revealed ? "basis-[calc(100%-160px)]" : "basis-full",
                      )}
                    >
                      <div className="p-5 h-full flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-base font-semibold truncate">{c.name}</div>
                            {c.segment && <div className="text-xs text-muted-foreground truncate">{c.segment}</div>}
                          </div>
                          <Badge className={cn("rounded-full shrink-0", STATUS[c.status ?? "prospect"]?.color ?? "bg-muted")}>
                            {STATUS[c.status ?? "prospect"]?.label ?? "—"}
                          </Badge>
                        </div>
                        <div className="mt-auto space-y-1 text-xs text-muted-foreground pt-2 border-t border-border">
                          {c.email && <div className="inline-flex items-center gap-1.5 truncate"><Mail className="h-3.5 w-3.5" />{c.email}</div>}
                          {c.phone && <div className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{c.phone}</div>}
                          {c.tax_id && <div className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{c.tax_id}</div>}
                        </div>
                      </div>
                    </button>

                    <div
                      className={cn(
                        "flex flex-col items-center justify-center gap-2 border-l border-border bg-muted/30 transition-all duration-300 ease-out overflow-hidden",
                        revealed ? "w-[160px] opacity-100 px-3" : "w-0 opacity-0 px-0 pointer-events-none",
                      )}
                      aria-hidden={!revealed}
                    >
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-full shadow-sm"
                        title={isArchived ? "Reativar" : "Arquivar"}
                        onClick={(e) => { e.stopPropagation(); archive.mutate({ id: c.id, archived: !isArchived }); }}
                      >
                        {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-full shadow-sm"
                        title="Editar"
                        onClick={(e) => { e.stopPropagation(); setEditingId(c.id); setRevealedId(null); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 rounded-full shadow-sm text-destructive hover:text-destructive"
                        title="Excluir"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Excluir cliente "${c.name}"? Esta ação não pode ser desfeita.`)) remove.mutate(c.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NewClientDialog open={newOpen} onOpenChange={setNewOpen}
        onSubmit={v => create.mutate(v)} pending={create.isPending} />

      <NewClientDialog
        open={!!editingId && !!editingClient}
        onOpenChange={(v) => { if (!v) setEditingId(null); }}
        onSubmit={v => update.mutate(v)}
        pending={update.isPending}
        mode="edit"
        initial={editingClient ? {
          person_type: (editingClient.person_type as "PJ"|"PF") ?? "PJ",
          tax_id: editingClient.tax_id ?? "",
          name: editingClient.name ?? "",
          legal_name: editingClient.legal_name ?? "",
          trade_name: editingClient.trade_name ?? "",
          state_registration: editingClient.state_registration ?? "",
          municipal_registration: editingClient.municipal_registration ?? "",
          cnae: editingClient.cnae ?? "",
          legal_nature: editingClient.legal_nature ?? "",
          opening_date: editingClient.opening_date ?? "",
          size: editingClient.size ?? "",
          segment: editingClient.segment ?? "",
          status: editingClient.status ?? "prospect",
          website: editingClient.website ?? "",
          instagram: editingClient.instagram ?? "",
          linkedin: editingClient.linkedin ?? "",
          email: editingClient.email ?? "",
          phone: editingClient.phone ?? "",
          contact_name: editingClient.contact_name ?? "",
          contact_role: editingClient.contact_role ?? "",
          contact_email: editingClient.contact_email ?? "",
          contact_phone: editingClient.contact_phone ?? "",
          billing_email: editingClient.billing_email ?? "",
          payment_terms: editingClient.payment_terms ?? "",
          address_zip: editingClient.address_zip ?? "",
          address_street: editingClient.address_street ?? "",
          address_number: editingClient.address_number ?? "",
          address_complement: editingClient.address_complement ?? "",
          address_neighborhood: editingClient.address_neighborhood ?? "",
          address_city: editingClient.address_city ?? "",
          address_state: editingClient.address_state ?? "",
          address_country: editingClient.address_country ?? "Brasil",
          notes: editingClient.notes ?? "",
        } : undefined}
      />

    </>
  );
}

type FormState = {
  person_type: "PJ" | "PF";
  tax_id: string;
  name: string;
  legal_name: string;
  trade_name: string;
  state_registration: string;
  municipal_registration: string;
  cnae: string;
  legal_nature: string;
  opening_date: string;
  size: string;
  segment: string;
  status: string;
  website: string;
  instagram: string;
  linkedin: string;
  email: string;
  phone: string;
  contact_name: string;
  contact_role: string;
  contact_email: string;
  contact_phone: string;
  billing_email: string;
  payment_terms: string;
  address_zip: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  address_neighborhood: string;
  address_city: string;
  address_state: string;
  address_country: string;
  notes: string;
};

const initialForm: FormState = {
  person_type: "PJ",
  tax_id: "", name: "", legal_name: "", trade_name: "",
  state_registration: "", municipal_registration: "", cnae: "", legal_nature: "",
  opening_date: "", size: "", segment: "", status: "prospect",
  website: "", instagram: "", linkedin: "",
  email: "", phone: "",
  contact_name: "", contact_role: "", contact_email: "", contact_phone: "",
  billing_email: "", payment_terms: "",
  address_zip: "", address_street: "", address_number: "", address_complement: "",
  address_neighborhood: "", address_city: "", address_state: "", address_country: "Brasil",
  notes: "",
};

export function NewClientDialog({
  open, onOpenChange, onSubmit, pending, initial, mode = "create",
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onSubmit: (v: Record<string, unknown>) => void;
  pending: boolean;
  initial?: Partial<FormState>;
  mode?: "create" | "edit";
}) {
  const [form, setForm] = useState<FormState>({ ...initialForm, ...(initial ?? {}) });
  const [tab, setTab] = useState("identificacao");
  const [lookingUpCnpj, setLookingUpCnpj] = useState(false);
  const [lookingUpCep, setLookingUpCep] = useState(false);

  // Recarrega form quando abre em modo edit com dados diferentes
  useEffect(() => {
    if (open) setForm({ ...initialForm, ...(initial ?? {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }));
  const reset = () => { setForm({ ...initialForm, ...(initial ?? {}) }); setTab("identificacao"); };
  const handleOpen = (v: boolean) => { onOpenChange(v); if (!v) reset(); };


  // Auto CNPJ lookup quando completa 14 dígitos
  useEffect(() => {
    if (form.person_type !== "PJ") return;
    const d = onlyDigits(form.tax_id);
    if (d.length !== 14) return;
    let cancelled = false;
    setLookingUpCnpj(true);
    lookupCNPJ(d)
      .then(r => {
        if (cancelled) return;
        setForm(f => ({
          ...f,
          legal_name: r.legal_name || f.legal_name,
          name: f.name || r.trade_name || r.legal_name,
          trade_name: r.trade_name || f.trade_name,
          opening_date: r.opening_date || f.opening_date,
          legal_nature: r.legal_nature || f.legal_nature,
          cnae: r.cnae || f.cnae,
          size: r.size || f.size,
          email: f.email || r.email || "",
          phone: f.phone || (r.phone ? maskPhone(r.phone) : ""),
          address_zip: r.address.zip || f.address_zip,
          address_street: r.address.street || f.address_street,
          address_number: r.address.number || f.address_number,
          address_complement: r.address.complement || f.address_complement,
          address_neighborhood: r.address.neighborhood || f.address_neighborhood,
          address_city: r.address.city || f.address_city,
          address_state: r.address.state || f.address_state,
        }));
        toast.success("Dados do CNPJ carregados");
      })
      .catch((e: Error) => { if (!cancelled) toast.error(e.message); })
      .finally(() => { if (!cancelled) setLookingUpCnpj(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tax_id, form.person_type]);

  // Auto CEP lookup
  useEffect(() => {
    const d = onlyDigits(form.address_zip);
    if (d.length !== 8) return;
    let cancelled = false;
    setLookingUpCep(true);
    lookupCEP(d)
      .then(r => {
        if (cancelled) return;
        setForm(f => ({
          ...f,
          address_street: f.address_street || r.street || "",
          address_neighborhood: f.address_neighborhood || r.neighborhood || "",
          address_city: f.address_city || r.city || "",
          address_state: f.address_state || r.state || "",
        }));
      })
      .catch(() => { /* silencioso — usuário pode preencher manual */ })
      .finally(() => { if (!cancelled) setLookingUpCep(false); });
    return () => { cancelled = true; };
  }, [form.address_zip]);

  const canSave = form.name.trim().length > 0;

  const handleSubmit = () => {
    const payload = {
      person_type: form.person_type,
      name: form.name.trim(),
      legal_name: form.legal_name || null,
      trade_name: form.trade_name || null,
      tax_id: form.tax_id || null,
      state_registration: form.state_registration || null,
      municipal_registration: form.municipal_registration || null,
      cnae: form.cnae || null,
      legal_nature: form.legal_nature || null,
      opening_date: form.opening_date || null,
      size: form.size || null,
      segment: form.segment || null,
      status: form.status,
      website: form.website || null,
      instagram: form.instagram || null,
      linkedin: form.linkedin || null,
      email: form.email || null,
      phone: form.phone || null,
      contact_name: form.contact_name || null,
      contact_role: form.contact_role || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      billing_email: form.billing_email || null,
      payment_terms: form.payment_terms || null,
      address_zip: form.address_zip || null,
      address_street: form.address_street || null,
      address_number: form.address_number || null,
      address_complement: form.address_complement || null,
      address_neighborhood: form.address_neighborhood || null,
      address_city: form.address_city || null,
      address_state: form.address_state || null,
      address_country: form.address_country || null,
      notes: form.notes || null,
    };
    onSubmit(payload);
  };

  return (
    <EntityDialog
      open={open} onOpenChange={handleOpen}
      icon={UsersIcon} tone="emerald" eyebrow="Clientes"
      title={mode === "edit" ? "Editar cliente" : "Novo cliente"}
      subtitle="Cadastro fiscal, comercial e operacional — CNPJ preenche o restante automaticamente."

      size="lg"
      main={
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="rounded-full bg-muted p-1">
            <TabsTrigger value="identificacao" className="rounded-full">Identificação</TabsTrigger>
            <TabsTrigger value="contato" className="rounded-full">Contato</TabsTrigger>
            <TabsTrigger value="endereco" className="rounded-full">Endereço</TabsTrigger>
            <TabsTrigger value="financeiro" className="rounded-full">Financeiro</TabsTrigger>
            <TabsTrigger value="observacoes" className="rounded-full">Notas</TabsTrigger>
          </TabsList>

          <TabsContent value="identificacao" className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <DialogField label="Tipo">
                <Select value={form.person_type} onValueChange={(v: "PJ"|"PF") => set("person_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                    <SelectItem value="PF">Pessoa Física</SelectItem>
                  </SelectContent>
                </Select>
              </DialogField>
              <DialogField label={form.person_type === "PJ" ? "CNPJ" : "CPF"} hint={form.person_type === "PJ" ? "Preenche os campos automaticamente" : undefined}>
                <div className="relative">
                  <Input
                    value={form.tax_id}
                    onChange={e => set("tax_id", form.person_type === "PJ" ? maskCNPJ(e.target.value) : maskCPF(e.target.value))}
                    placeholder={form.person_type === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
                  />
                  {lookingUpCnpj && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> buscando
                    </div>
                  )}
                  {!lookingUpCnpj && form.person_type === "PJ" && onlyDigits(form.tax_id).length !== 14 && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" /> auto
                    </div>
                  )}
                </div>
              </DialogField>
              <DialogField label="Status">
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </DialogField>
            </div>

            {form.person_type === "PJ" ? (
              <>
                <DialogField label="Razão social">
                  <Input value={form.legal_name} onChange={e => set("legal_name", e.target.value)} placeholder="Ex.: Bella Estética Ltda." />
                </DialogField>
                <div className="grid grid-cols-2 gap-3">
                  <DialogField label="Nome fantasia / Apelido interno">
                    <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Como o cliente é conhecido" />
                  </DialogField>
                  <DialogField label="Nome fantasia (oficial)">
                    <Input value={form.trade_name} onChange={e => set("trade_name", e.target.value)} />
                  </DialogField>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <DialogField label="Inscrição estadual">
                    <Input value={form.state_registration} onChange={e => set("state_registration", e.target.value)} placeholder="Isento se não houver" />
                  </DialogField>
                  <DialogField label="Inscrição municipal">
                    <Input value={form.municipal_registration} onChange={e => set("municipal_registration", e.target.value)} />
                  </DialogField>
                  <DialogField label="Porte">
                    <Select value={form.size} onValueChange={v => set("size", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </DialogField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DialogField label="CNAE / Atividade principal">
                    <Input value={form.cnae} onChange={e => set("cnae", e.target.value)} />
                  </DialogField>
                  <DialogField label="Natureza jurídica">
                    <Input value={form.legal_nature} onChange={e => set("legal_nature", e.target.value)} />
                  </DialogField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DialogField label="Data de abertura">
                    <Input type="date" value={form.opening_date} onChange={e => set("opening_date", e.target.value)} />
                  </DialogField>
                  <DialogField label="Segmento">
                    <Select value={form.segment} onValueChange={v => set("segment", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                      <SelectContent>
                        {SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </DialogField>
                </div>
              </>
            ) : (
              <>
                <DialogField label="Nome completo">
                  <Input value={form.name} onChange={e => set("name", e.target.value)} />
                </DialogField>
                <DialogField label="Segmento / Ocupação">
                  <Select value={form.segment} onValueChange={v => set("segment", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </DialogField>
              </>
            )}
          </TabsContent>

          <TabsContent value="contato" className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <DialogField label="E-mail principal"><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="contato@empresa.com" /></DialogField>
              <DialogField label="Telefone principal"><Input value={form.phone} onChange={e => set("phone", maskPhone(e.target.value))} placeholder="(11) 99999-9999" /></DialogField>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <DialogField label="Website"><Input value={form.website} onChange={e => set("website", e.target.value)} placeholder="https://" /></DialogField>
              <DialogField label="Instagram"><Input value={form.instagram} onChange={e => set("instagram", e.target.value)} placeholder="@usuario" /></DialogField>
              <DialogField label="LinkedIn"><Input value={form.linkedin} onChange={e => set("linkedin", e.target.value)} /></DialogField>
            </div>
            <div className="pt-3 mt-3 border-t border-border">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Pessoa de contato</div>
              <div className="grid grid-cols-2 gap-3">
                <DialogField label="Nome"><Input value={form.contact_name} onChange={e => set("contact_name", e.target.value)} /></DialogField>
                <DialogField label="Cargo"><Input value={form.contact_role} onChange={e => set("contact_role", e.target.value)} placeholder="Sócio, Marketing, Diretor..." /></DialogField>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <DialogField label="E-mail"><Input type="email" value={form.contact_email} onChange={e => set("contact_email", e.target.value)} /></DialogField>
                <DialogField label="Telefone / WhatsApp"><Input value={form.contact_phone} onChange={e => set("contact_phone", maskPhone(e.target.value))} /></DialogField>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="endereco" className="mt-4 space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <DialogField label="CEP">
                <div className="relative">
                  <Input value={form.address_zip} onChange={e => set("address_zip", maskCEP(e.target.value))} placeholder="00000-000" />
                  {lookingUpCep && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </DialogField>
              <div className="col-span-3">
                <DialogField label="Logradouro">
                  <Input value={form.address_street} onChange={e => set("address_street", e.target.value)} />
                </DialogField>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <DialogField label="Número"><Input value={form.address_number} onChange={e => set("address_number", e.target.value)} /></DialogField>
              <div className="col-span-2">
                <DialogField label="Complemento"><Input value={form.address_complement} onChange={e => set("address_complement", e.target.value)} placeholder="Sala, andar..." /></DialogField>
              </div>
              <DialogField label="Bairro"><Input value={form.address_neighborhood} onChange={e => set("address_neighborhood", e.target.value)} /></DialogField>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <DialogField label="Cidade"><Input value={form.address_city} onChange={e => set("address_city", e.target.value)} /></DialogField>
              </div>
              <DialogField label="UF">
                <Select value={form.address_state} onValueChange={v => set("address_state", v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </DialogField>
              <DialogField label="País"><Input value={form.address_country} onChange={e => set("address_country", e.target.value)} /></DialogField>
            </div>
          </TabsContent>

          <TabsContent value="financeiro" className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <DialogField label="E-mail de faturamento" hint="Onde enviamos as faturas e NF.">
                <Input type="email" value={form.billing_email} onChange={e => set("billing_email", e.target.value)} />
              </DialogField>
              <DialogField label="Condição de pagamento">
                <Select value={form.payment_terms} onValueChange={v => set("payment_terms", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </DialogField>
            </div>
          </TabsContent>

          <TabsContent value="observacoes" className="mt-4">
            <DialogField label="Notas internas" hint="Contexto, canais preferenciais, histórico, alertas.">
              <Textarea rows={8} value={form.notes} onChange={e => set("notes", e.target.value)} />
            </DialogField>
          </TabsContent>
        </Tabs>
      }
      footer={
        <>
          <DialogCancelButton onClick={() => handleOpen(false)} />
          <Button className="rounded-full" disabled={!canSave || pending} onClick={handleSubmit}>
            {pending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Salvando</> : (mode === "edit" ? "Salvar alterações" : "Criar cliente")}
          </Button>
        </>
      }
    />
  );
}
