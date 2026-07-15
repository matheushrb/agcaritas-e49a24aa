import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone, Plus, Search, Calendar } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/marketing-plans")({
  component: MarketingPlansPage,
});

type PlanStatus = "draft" | "in_review" | "approved" | "archived";
type Plan = {
  id: string;
  name: string;
  segment: string | null;
  status: PlanStatus;
  client_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};
type Client = { id: string; name: string };

const STATUS_META: Record<PlanStatus, { label: string; color: string }> = {
  draft:     { label: "Rascunho",   color: "bg-muted text-muted-foreground" },
  in_review: { label: "Em revisão", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  approved:  { label: "Aprovado",   color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  archived:  { label: "Arquivado",  color: "bg-slate-500/15 text-slate-600 dark:text-slate-400" },
};

function MarketingPlansPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [newOpen, setNewOpen] = useState(false);

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ["marketing-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_plans")
        .select("id,name,segment,status,client_id,start_date,end_date,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
  });
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id,name").order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const filtered = useMemo(() =>
    plans.filter(p =>
      (!search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.segment ?? "").toLowerCase().includes(search.toLowerCase())) &&
      (statusFilter === "all" || p.status === statusFilter)
    ), [plans, search, statusFilter]);

  const create = useMutation({
    mutationFn: async (input: Partial<Plan>) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await supabase.from("marketing_plans").insert({
        organization_id: profile.organization_id,
        name: input.name!,
        segment: input.segment,
        client_id: input.client_id,
        start_date: input.start_date,
        end_date: input.end_date,
        status: input.status ?? "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["marketing-plans"] }); toast.success("Plano criado"); setNewOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PlanStatus }) => {
      const { error } = await supabase.from("marketing_plans").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing-plans"] }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Megaphone className="size-6" />Marketing</h1>
          <p className="text-sm text-muted-foreground">Planos de marketing e campanhas. Ao aprovar, um projeto é criado automaticamente.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="size-4 mr-1" />Novo plano</Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar planos…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(STATUS_META) as PlanStatus[]).map(s => (
              <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p => (
          <Card key={p.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium truncate">{p.name}</h3>
                <p className="text-xs text-muted-foreground truncate">{clients.find(c => c.id === p.client_id)?.name ?? "Sem cliente"}</p>
              </div>
              <Badge className={STATUS_META[p.status]?.color}>{STATUS_META[p.status]?.label}</Badge>
            </div>
            {p.segment && <p className="text-xs text-muted-foreground">Segmento: {p.segment}</p>}
            {(p.start_date || p.end_date) && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="size-3" />{p.start_date ?? "—"} → {p.end_date ?? "—"}
              </div>
            )}
            <Select value={p.status} onValueChange={(v) => setStatus.mutate({ id: p.id, status: v as PlanStatus })}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_META) as PlanStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full">Nenhum plano encontrado.</p>}
      </div>

      <NewPlanDialog open={newOpen} onOpenChange={setNewOpen} clients={clients} onCreate={(v) => create.mutate(v)} />
    </div>
  );
}

function NewPlanDialog({ open, onOpenChange, clients, onCreate }: {
  open: boolean; onOpenChange: (v: boolean) => void; clients: Client[]; onCreate: (v: Partial<Plan>) => void;
}) {
  const [f, setF] = useState<Partial<Plan>>({ status: "draft" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo plano de marketing</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Nome do plano" value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} />
          <Input placeholder="Segmento (ex.: e-commerce, saúde…)" value={f.segment ?? ""} onChange={e => setF({ ...f, segment: e.target.value })} />
          <Select value={f.client_id ?? undefined} onValueChange={(v) => setF({ ...f, client_id: v })}>
            <SelectTrigger><SelectValue placeholder="Cliente (opcional)" /></SelectTrigger>
            <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" value={f.start_date ?? ""} onChange={e => setF({ ...f, start_date: e.target.value })} />
            <Input type="date" value={f.end_date ?? ""} onChange={e => setF({ ...f, end_date: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onCreate(f)} disabled={!f.name}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
