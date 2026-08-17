import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityDialog, DialogField, DialogCancelButton } from "@/components/entity-dialog";
import { Truck, Plus, Mail, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Fornecedores · Caritas" }] }),
  component: SuppliersPage,
});

type Supplier = {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  category: string | null;
  status: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  notes: string | null;
};

const CATEGORIES = ["Freelancer", "Software / SaaS", "Gráfica", "Fotografia", "Produção", "Consultoria", "Outro"];
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active:   { label: "Ativo",    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  inactive: { label: "Inativo",  color: "bg-muted text-muted-foreground" },
  blocked:  { label: "Bloqueado", color: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

function SuppliersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers")
        .select("id,name,legal_name,tax_id,category,status,email,phone,whatsapp,notes").order("name");
      if (error) throw error;
      return (data ?? []) as Supplier[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Partial<Supplier>) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await supabase.from("suppliers").insert({
        organization_id: profile.organization_id,
        name: input.name!,
        legal_name: input.legal_name ?? null,
        tax_id: input.tax_id ?? null,
        category: input.category ?? null,
        status: input.status ?? "active",
        email: input.email ?? null,
        phone: input.phone ?? null,
        whatsapp: input.whatsapp ?? null,
        notes: input.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Fornecedor cadastrado"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["suppliers"] }),
  });

  return (
    <div className="space-y-6">
      <header className="cv-page-head flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">Freelancers, gráficas, softwares — parceiros que a agência contrata.</p>
        </div>
        <Button className="rounded-full gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Novo fornecedor</Button>
      </header>

      {suppliers.length === 0 ? (
        <Card className="rounded-3xl p-12 text-center border-dashed">
          <Truck className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium">Nenhum fornecedor cadastrado</div>
          <p className="text-sm text-muted-foreground mt-1">Registre parceiros para consolidar custos e prazos.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers.map(s => (
            <Card key={s.id} className="rounded-2xl p-5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.name}</div>
                  {s.category && <div className="text-xs text-muted-foreground truncate">{s.category}</div>}
                </div>
                <div className="flex items-center gap-1">
                  <Badge className={cn("rounded-full", STATUS_MAP[s.status]?.color ?? "bg-muted")}>{STATUS_MAP[s.status]?.label ?? s.status}</Badge>
                  <button onClick={() => { if (confirm("Excluir fornecedor?")) remove.mutate(s.id); }}
                    className="text-muted-foreground hover:text-destructive ml-1"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
                {s.email && <div className="inline-flex items-center gap-1.5 truncate"><Mail className="h-3 w-3" />{s.email}</div>}
                {s.phone && <div className="inline-flex items-center gap-1.5"><Phone className="h-3 w-3" />{s.phone}</div>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewSupplierDialog open={open} onOpenChange={setOpen} onCreate={v => create.mutate(v)} pending={create.isPending} />
    </div>
  );
}

function NewSupplierDialog({
  open, onOpenChange, onCreate, pending,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreate: (v: Partial<Supplier>) => void; pending: boolean }) {
  const [f, setF] = useState<Partial<Supplier>>({ status: "active" });

  return (
    <EntityDialog
      open={open} onOpenChange={onOpenChange}
      icon={Truck} tone="amber" eyebrow="Fornecedores" title="Novo fornecedor"
      subtitle="Cadastre um parceiro que a agência contrata (freela, software, gráfica…)."
      main={
        <>
          <DialogField label="Nome fantasia / apelido"><Input autoFocus value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} /></DialogField>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="Razão social"><Input value={f.legal_name ?? ""} onChange={e => setF({ ...f, legal_name: e.target.value })} /></DialogField>
            <DialogField label="CNPJ / CPF"><Input value={f.tax_id ?? ""} onChange={e => setF({ ...f, tax_id: e.target.value })} /></DialogField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="E-mail"><Input type="email" value={f.email ?? ""} onChange={e => setF({ ...f, email: e.target.value })} /></DialogField>
            <DialogField label="Telefone"><Input value={f.phone ?? ""} onChange={e => setF({ ...f, phone: e.target.value })} /></DialogField>
          </div>
          <DialogField label="Observações"><Textarea rows={3} value={f.notes ?? ""} onChange={e => setF({ ...f, notes: e.target.value })} /></DialogField>
        </>
      }
      sidebar={
        <>
          <DialogField label="Categoria">
            <Select value={f.category ?? ""} onValueChange={v => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </DialogField>
          <DialogField label="Status">
            <Select value={f.status} onValueChange={v => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </DialogField>
        </>
      }
      footer={<>
        <DialogCancelButton onClick={() => onOpenChange(false)} />
        <Button className="rounded-full" disabled={!f.name || pending} onClick={() => onCreate(f)}>Cadastrar</Button>
      </>}
    />
  );
}
