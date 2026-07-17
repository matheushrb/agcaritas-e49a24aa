import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityDialog, DialogField, DialogCancelButton } from "@/components/entity-dialog";
import { Lightbulb, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ideas")({
  head: () => ({ meta: [{ title: "Banco de Ideias · Caritas" }] }),
  component: IdeasPage,
});

type Idea = { id: string; title: string; description: string | null; platform: string | null; status: string };

const STATUSES = ["backlog", "approved", "producing", "published", "archived"];
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  backlog:   { label: "Backlog",     color: "bg-muted text-muted-foreground" },
  approved:  { label: "Aprovada",    color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  producing: { label: "Em produção", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  published: { label: "Publicada",   color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  archived:  { label: "Arquivada",   color: "bg-red-500/15 text-red-600 dark:text-red-400" },
};
const PLATFORMS = ["Instagram", "TikTok", "YouTube", "LinkedIn", "Blog", "E-mail", "X (Twitter)", "Outro"];

function IdeasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: ideas = [] } = useQuery<Idea[]>({
    queryKey: ["ideas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("idea_bank")
        .select("id,title,description,platform,status").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Idea[];
    },
  });

  const byStatus = useMemo(() => {
    const m: Record<string, Idea[]> = {};
    for (const s of STATUSES) m[s] = [];
    for (const i of ideas) (m[i.status] ??= []).push(i);
    return m;
  }, [ideas]);

  const create = useMutation({
    mutationFn: async (input: Partial<Idea>) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await supabase.from("idea_bank").insert({
        organization_id: profile.organization_id,
        title: input.title!,
        description: input.description ?? null,
        platform: input.platform ?? null,
        status: input.status ?? "backlog",
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ideas"] }); toast.success("Ideia adicionada"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("idea_bank").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ideas"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("idea_bank").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ideas"] }),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Banco de Ideias</h1>
          <p className="text-sm text-muted-foreground">Captura contínua de ideias de conteúdo, formatos e campanhas.</p>
        </div>
        <Button className="rounded-full gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova ideia</Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {STATUSES.map(s => {
          const list = byStatus[s] ?? [];
          const meta = STATUS_LABEL[s];
          return (
            <Card key={s} className="rounded-2xl p-3 bg-muted/30 min-h-[280px]">
              <div className="flex items-center justify-between px-1 mb-2">
                <Badge className={cn("rounded-full", meta.color)}>{meta.label}</Badge>
                <span className="text-xs text-muted-foreground">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.map(i => (
                  <div key={i.id} className="rounded-xl bg-card border border-border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm line-clamp-2">{i.title}</div>
                      <button onClick={() => remove.mutate(i.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {i.description && <div className="text-xs text-muted-foreground line-clamp-2">{i.description}</div>}
                    <div className="flex items-center justify-between gap-2">
                      {i.platform && <span className="text-[10px] text-muted-foreground">{i.platform}</span>}
                      <Select value={i.status} onValueChange={v => move.mutate({ id: i.id, status: v })}>
                        <SelectTrigger className="h-6 text-[10px] ml-auto w-[100px] rounded-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map(x => <SelectItem key={x} value={x}>{STATUS_LABEL[x].label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                {list.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Vazio</p>}
              </div>
            </Card>
          );
        })}
      </div>

      <NewIdeaDialog open={open} onOpenChange={setOpen} onCreate={v => create.mutate(v)} pending={create.isPending} />
    </div>
  );
}

function NewIdeaDialog({
  open, onOpenChange, onCreate, pending,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreate: (v: Partial<Idea>) => void; pending: boolean }) {
  const [f, setF] = useState<Partial<Idea>>({ status: "backlog" });

  return (
    <EntityDialog
      open={open} onOpenChange={onOpenChange}
      icon={Lightbulb} tone="amber" eyebrow="Ideias" title="Nova ideia"
      subtitle="Capture pautas, formatos ou insights que ainda não viraram tarefa."
      main={
        <>
          <DialogField label="Título"><Input autoFocus value={f.title ?? ""} onChange={e => setF({ ...f, title: e.target.value })} /></DialogField>
          <DialogField label="Descrição"><Textarea rows={4} value={f.description ?? ""} onChange={e => setF({ ...f, description: e.target.value })} /></DialogField>
        </>
      }
      sidebar={
        <>
          <DialogField label="Plataforma">
            <Select value={f.platform ?? ""} onValueChange={v => setF({ ...f, platform: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>{PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </DialogField>
          <DialogField label="Status">
            <Select value={f.status} onValueChange={v => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s].label}</SelectItem>)}</SelectContent>
            </Select>
          </DialogField>
        </>
      }
      footer={<>
        <DialogCancelButton onClick={() => onOpenChange(false)} />
        <Button className="rounded-full" disabled={!f.title || pending} onClick={() => onCreate(f)}>Adicionar ideia</Button>
      </>}
    />
  );
}
