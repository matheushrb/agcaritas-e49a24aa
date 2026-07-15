import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityDialog, DialogField, DialogCancelButton } from "@/components/entity-dialog";
import { Search, Plus, Truck, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { maskTaxId, maskPhone, onlyDigits, fetchCNPJ } from "@/lib/br-utils";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Fornecedores · Caritas Agência" }] }),
  component: SuppliersPage,
});

type Supplier = {
  id: string; name: string; category: string | null; tax_id: string | null;
  legal_name: string | null; email: string | null; phone: string | null;
  whatsapp: string | null; notes: string | null; status: string;
};

const CATEGORIES = ["Designer Freelancer", "Gráfica", "Fotógrafo", "Videomaker", "Desenvolvedor", "Outro"];

function SuppliersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const { data: rows = [] } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers" as any).select("*").order("created_at", { ascending: false });
      return (data as any) ?? [];
    },
  });

  const filtered = useMemo(() => rows.filter(r => {
    const s = search.toLowerCase();
    return (!s || r.name.toLowerCase().includes(s)) && (cat === "all" || r.category === cat);
  }), [rows, search, cat]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Fornecedores</h1>
          <p className="text-sm text-muted-foreground mt-1">Parceiros externos, freelancers e prestadores.</p>
        </div>
        <Button className="rounded-full gap-1.5" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo fornecedor
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome" className="pl-9 rounded-full" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[200px] rounded-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <div className="font-medium">Nenhum fornecedor cadastrado</div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">Categoria</th>
                <th className="text-left px-4 py-3">E-mail</th>
                <th className="text-left px-4 py-3">Telefone</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.category ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge className={cn("rounded-full", r.status === "active" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                      {r.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Edit className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={async () => {
                      await supabase.from("suppliers" as any).delete().eq("id", r.id);
                      qc.invalidateQueries({ queryKey: ["suppliers"] });
                    }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <SupplierDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={() => qc.invalidateQueries({ queryKey: ["suppliers"] })} />
    </div>
  );
}

function SupplierDialog({ open, onOpenChange, editing, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Supplier | null; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Supplier>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(editing ?? { status: "active", category: "Outro" });
  }, [open, editing]);

  const onBlurCNPJ = async () => {
    if (!form.tax_id || onlyDigits(form.tax_id).length !== 14) return;
    const info = await fetchCNPJ(form.tax_id);
    if (info) {
      setForm(f => ({
        ...f,
        legal_name: info.legal_name ?? f.legal_name,
        name: f.name || info.trade_name || info.legal_name || "",
        email: f.email || info.email || "",
        phone: f.phone || info.phone || "",
      }));
    }
  };

  const submit = async () => {
    if (!form.name?.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", userRes.user!.id).maybeSingle();
      if (!p?.organization_id) throw new Error("Sem org");
      if (editing) {
        const { error } = await supabase.from("suppliers" as any).update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers" as any).insert({ ...form, organization_id: p.organization_id });
        if (error) throw error;
      }
      toast.success("Salvo");
      onSaved();
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <EntityDialog
      open={open} onOpenChange={onOpenChange}
      icon={Truck} tone="amber"
      eyebrow={editing ? "Editar" : "Novo registro"} title={editing ? "Editar fornecedor" : "Novo fornecedor"}
      main={
        <>
          <DialogField label="Nome *">
            <Input value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </DialogField>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="Categoria *">
              <Select value={form.category ?? "Outro"} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </DialogField>
            <DialogField label="CNPJ/CPF">
              <Input value={form.tax_id ?? ""} onChange={e => setForm(f => ({ ...f, tax_id: maskTaxId(e.target.value) }))} onBlur={onBlurCNPJ} />
            </DialogField>
          </div>
          <DialogField label="Razão social">
            <Input value={form.legal_name ?? ""} onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))} />
          </DialogField>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="E-mail"><Input value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></DialogField>
            <DialogField label="Telefone"><Input value={form.phone ?? ""} onChange={e => setForm(f => ({ ...f, phone: maskPhone(e.target.value) }))} /></DialogField>
          </div>
          <DialogField label="WhatsApp"><Input value={form.whatsapp ?? ""} onChange={e => setForm(f => ({ ...f, whatsapp: maskPhone(e.target.value) }))} /></DialogField>
          <DialogField label="Observações"><Textarea rows={3} value={form.notes ?? ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></DialogField>
        </>
      }
      sidebar={
        <DialogField label="Status">
          <Select value={form.status ?? "active"} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </DialogField>
      }
      footer={
        <>
          <DialogCancelButton onClick={() => onOpenChange(false)} />
          <Button className="rounded-full" disabled={saving} onClick={submit}>{saving ? "Salvando..." : "Salvar"}</Button>
        </>
      }
    />
  );
}
