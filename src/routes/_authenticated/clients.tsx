import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EntityDialog, DialogField, DialogCancelButton } from "@/components/entity-dialog";
import { Search, Plus, Users as UsersIcon, Building2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  "Imobiliário","Entretenimento","Outro",
];

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
    mutationFn: async (input: { name: string; email: string; phone: string; segment: string; status: string; notes: string }) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await supabase.from("clients").insert({
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        segment: input.segment || null,
        status: input.status,
        notes: input.notes || null,
        organization_id: profile.organization_id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients-list"] }); toast.success("Cliente criado"); setNewOpen(false); },
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
            {filtered.map(c => (
              <Link key={c.id} to="/clients/$clientId" params={{ clientId: c.id }} className="block">
                <Card className="rounded-2xl p-5 hover:shadow-md transition-shadow h-full flex flex-col gap-3">
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
                    {c.document && <div className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{c.document}</div>}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <NewClientDialog open={newOpen} onOpenChange={setNewOpen}
        onCreate={v => create.mutate(v)} pending={create.isPending} />
    </>
  );
}

function NewClientDialog({
  open, onOpenChange, onCreate, pending,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onCreate: (v: { name: string; email: string; phone: string; segment: string; status: string; notes: string }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [segment, setSegment] = useState("");
  const [status, setStatus] = useState("prospect");
  const [notes, setNotes] = useState("");

  const reset = () => { setName(""); setEmail(""); setPhone(""); setSegment(""); setStatus("prospect"); setNotes(""); };
  const handleOpen = (v: boolean) => { onOpenChange(v); if (!v) reset(); };

  return (
    <EntityDialog
      open={open} onOpenChange={handleOpen}
      icon={UsersIcon} tone="emerald" eyebrow="Clientes"
      title="Novo cliente"
      subtitle="Cadastro rápido — dados fiscais e endereço podem ser completados depois."
      size="lg"
      main={
        <>
          <DialogField label="Razão social / Nome">
            <Input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Ex.: Bella Estética Ltda." />
          </DialogField>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="E-mail"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contato@empresa.com" /></DialogField>
            <DialogField label="Telefone"><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" /></DialogField>
          </div>
          <DialogField label="Observações" hint="Notas internas, contexto, canais preferenciais.">
            <Textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)} />
          </DialogField>
        </>
      }
      sidebar={
        <>
          <DialogField label="Segmento">
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </DialogField>
          <DialogField label="Status inicial">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </DialogField>
        </>
      }
      footer={
        <>
          <DialogCancelButton onClick={() => handleOpen(false)} />
          <Button className="rounded-full" disabled={!name.trim() || pending}
            onClick={() => onCreate({ name: name.trim(), email, phone, segment, status, notes })}>
            Criar cliente
          </Button>
        </>
      }
    />
  );
}
