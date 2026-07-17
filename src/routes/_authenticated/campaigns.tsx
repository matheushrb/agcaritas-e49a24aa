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
import { Megaphone, Plus, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/campaigns")({
  head: () => ({ meta: [{ title: "Campanhas Internas · Caritas" }] }),
  component: CampaignsPage,
});

type Campaign = {
  id: string;
  name: string;
  objective: string | null;
  channel: string | null;
  status: string;
  budget: number | null;
  start_date: string | null;
  end_date: string | null;
  expected_result: string | null;
  notes: string | null;
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft:     { label: "Rascunho",   color: "bg-muted text-muted-foreground" },
  active:    { label: "Ativa",      color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  paused:    { label: "Pausada",    color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  completed: { label: "Concluída",  color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
};
const CHANNELS = ["Meta", "Google", "TikTok", "LinkedIn", "E-mail", "Orgânico", "Multi-canal"];

function CampaignsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("internal_campaigns")
        .select("id,name,objective,channel,status,budget,start_date,end_date,expected_result,notes")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Campaign[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Partial<Campaign>) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await supabase.from("internal_campaigns").insert({
        organization_id: profile.organization_id,
        name: input.name!,
        objective: input.objective ?? null,
        channel: input.channel ?? null,
        status: input.status ?? "draft",
        budget: input.budget ?? null,
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
        expected_result: input.expected_result ?? null,
        notes: input.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); toast.success("Campanha criada"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("internal_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Campanhas Internas</h1>
          <p className="text-sm text-muted-foreground">Campanhas da própria agência (marca, captação, awareness).</p>
        </div>
        <Button className="rounded-full gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova campanha</Button>
      </header>

      {campaigns.length === 0 ? (
        <Card className="rounded-3xl p-12 text-center border-dashed">
          <Megaphone className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium">Nenhuma campanha ativa</div>
          <p className="text-sm text-muted-foreground mt-1">Crie campanhas internas para promover a agência.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {campaigns.map(c => (
            <Card key={c.id} className="rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  {c.channel && <div className="text-xs text-muted-foreground truncate">{c.channel}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge className={cn("rounded-full", STATUS_MAP[c.status]?.color ?? "bg-muted")}>{STATUS_MAP[c.status]?.label ?? c.status}</Badge>
                  <button onClick={() => { if (confirm("Excluir campanha?")) remove.mutate(c.id); }} className="text-muted-foreground hover:text-destructive ml-1"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {c.objective && <p className="text-sm text-muted-foreground line-clamp-2">{c.objective}</p>}
              <div className="pt-2 border-t border-border grid grid-cols-2 gap-2 text-xs">
                {c.budget != null && <div><div className="text-muted-foreground">Verba</div><div className="font-semibold">R$ {Number(c.budget).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div></div>}
                {(c.start_date || c.end_date) && (
                  <div>
                    <div className="text-muted-foreground inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Período</div>
                    <div>{c.start_date ? new Date(c.start_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"} → {c.end_date ? new Date(c.end_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}</div>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewCampaignDialog open={open} onOpenChange={setOpen} onCreate={v => create.mutate(v)} pending={create.isPending} />
    </div>
  );
}

function NewCampaignDialog({
  open, onOpenChange, onCreate, pending,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreate: (v: Partial<Campaign>) => void; pending: boolean }) {
  const [f, setF] = useState<Partial<Campaign>>({ status: "draft" });

  return (
    <EntityDialog
      open={open} onOpenChange={onOpenChange}
      icon={Megaphone} tone="pink" eyebrow="Campanhas" title="Nova campanha interna"
      subtitle="Ações de marketing próprias da agência."
      size="lg"
      main={
        <>
          <DialogField label="Nome da campanha"><Input autoFocus value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Ex.: Captação Q1/2026" /></DialogField>
          <DialogField label="Objetivo"><Textarea rows={3} value={f.objective ?? ""} onChange={e => setF({ ...f, objective: e.target.value })} placeholder="Qual resultado esta campanha busca?" /></DialogField>
          <DialogField label="Resultado esperado"><Input value={f.expected_result ?? ""} onChange={e => setF({ ...f, expected_result: e.target.value })} placeholder="Ex.: 30 leads qualificados" /></DialogField>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="Início"><Input type="date" value={f.start_date ?? ""} onChange={e => setF({ ...f, start_date: e.target.value })} /></DialogField>
            <DialogField label="Fim"><Input type="date" value={f.end_date ?? ""} onChange={e => setF({ ...f, end_date: e.target.value })} /></DialogField>
          </div>
        </>
      }
      sidebar={
        <>
          <DialogField label="Canal">
            <Select value={f.channel ?? ""} onValueChange={v => setF({ ...f, channel: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </DialogField>
          <DialogField label="Verba (R$)">
            <Input type="number" step="0.01" value={f.budget ?? ""} onChange={e => setF({ ...f, budget: e.target.value ? Number(e.target.value) : null })} />
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
        <Button className="rounded-full" disabled={!f.name || pending} onClick={() => onCreate(f)}>Criar campanha</Button>
      </>}
    />
  );
}
