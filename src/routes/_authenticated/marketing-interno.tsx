import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EntityDialog, DialogField, DialogCancelButton } from "@/components/entity-dialog";
import { Megaphone, Lightbulb, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { money } from "@/lib/br-utils";

export const Route = createFileRoute("/_authenticated/marketing-interno")({
  head: () => ({ meta: [{ title: "Marketing Interno · Caritas Agência" }] }),
  component: MarketingInternoPage,
});

const CAMP_STATUS: Record<string, { label: string; color: string }> = {
  planning: { label: "Planejamento", color: "bg-muted text-muted-foreground" },
  active:   { label: "Ativa",   color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  paused:   { label: "Pausada", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  ended:    { label: "Encerrada", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
};

const IDEA_STATUS: Record<string, { label: string; color: string }> = {
  idea:      { label: "Ideia",      color: "bg-muted text-muted-foreground" },
  review:    { label: "Em análise", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  approved:  { label: "Aprovada",   color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  discarded: { label: "Descartada", color: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

function MarketingInternoPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Marketing Interno</h1>
        <p className="text-sm text-muted-foreground mt-1">Campanhas próprias da agência e banco de ideias.</p>
      </div>

      <Tabs defaultValue="campaigns">
        <TabsList className="rounded-full bg-muted/60 h-auto">
          <TabsTrigger value="campaigns" className="rounded-full gap-1.5"><Megaphone className="h-4 w-4" /> Campanhas</TabsTrigger>
          <TabsTrigger value="ideas" className="rounded-full gap-1.5"><Lightbulb className="h-4 w-4" /> Banco de ideias</TabsTrigger>
        </TabsList>
        <TabsContent value="campaigns" className="mt-4"><CampaignsTab /></TabsContent>
        <TabsContent value="ideas" className="mt-4"><IdeasTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function CampaignsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: rows = [] } = useQuery({
    queryKey: ["internal_campaigns"],
    queryFn: async () => (await supabase.from("internal_campaigns" as any).select("*").order("created_at", { ascending: false })).data as any[] ?? [],
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="rounded-full gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova campanha</Button>
      </div>
      {rows.length === 0 ? (
        <Card className="rounded-3xl p-12 text-center">
          <Megaphone className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <div className="font-medium">Nenhuma campanha interna</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((c: any) => (
            <Card key={c.id} className="rounded-2xl p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.channel}</div>
                </div>
                <Badge className={cn("rounded-full", CAMP_STATUS[c.status]?.color)}>{CAMP_STATUS[c.status]?.label ?? c.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{c.objective}</p>
              <div className="mt-3 text-xs text-muted-foreground flex items-center justify-between">
                <span>{c.start_date ?? "—"} → {c.end_date ?? "—"}</span>
                {c.budget > 0 && <span className="font-medium text-foreground">{money(c.budget)}</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
      <CampaignDialog open={open} onOpenChange={setOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["internal_campaigns"] })} />
    </div>
  );
}

function CampaignDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({ status: "planning", budget: 0 });
  useEffect(() => { if (!open) setForm({ status: "planning", budget: 0 }); }, [open]);
  const submit = async () => {
    if (!form.name || !form.channel) { toast.error("Nome e canal obrigatórios"); return; }
    const { data: userRes } = await supabase.auth.getUser();
    const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", userRes.user!.id).maybeSingle();
    const { error } = await supabase.from("internal_campaigns" as any).insert({ ...form, organization_id: p!.organization_id, budget: Number(form.budget) || 0 });
    if (error) toast.error(error.message);
    else { toast.success("Campanha criada"); onSaved(); onOpenChange(false); }
  };
  return (
    <EntityDialog open={open} onOpenChange={onOpenChange} icon={Megaphone} tone="pink"
      eyebrow="Novo registro" title="Nova campanha interna"
      main={<>
        <DialogField label="Nome *"><Input value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} /></DialogField>
        <DialogField label="Objetivo"><Textarea rows={2} value={form.objective ?? ""} onChange={e => setForm({ ...form, objective: e.target.value })} /></DialogField>
        <div className="grid grid-cols-2 gap-3">
          <DialogField label="Canal *"><Input value={form.channel ?? ""} onChange={e => setForm({ ...form, channel: e.target.value })} placeholder="Instagram, Google, E-mail..." /></DialogField>
          <DialogField label="Orçamento (R$)"><Input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} /></DialogField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <DialogField label="Início"><Input type="date" value={form.start_date ?? ""} onChange={e => setForm({ ...form, start_date: e.target.value })} /></DialogField>
          <DialogField label="Fim"><Input type="date" value={form.end_date ?? ""} onChange={e => setForm({ ...form, end_date: e.target.value })} /></DialogField>
        </div>
        <DialogField label="Resultado esperado"><Input value={form.expected_result ?? ""} onChange={e => setForm({ ...form, expected_result: e.target.value })} /></DialogField>
      </>}
      sidebar={<DialogField label="Status">
        <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.keys(CAMP_STATUS).map(k => <SelectItem key={k} value={k}>{CAMP_STATUS[k].label}</SelectItem>)}</SelectContent>
        </Select>
      </DialogField>}
      footer={<>
        <DialogCancelButton onClick={() => onOpenChange(false)} />
        <Button className="rounded-full" onClick={submit}>Criar campanha</Button>
      </>}
    />
  );
}

function IdeasTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");
  const [open, setOpen] = useState(false);
  const { data: rows = [] } = useQuery({
    queryKey: ["idea_bank"],
    queryFn: async () => (await supabase.from("idea_bank" as any).select("*").order("created_at", { ascending: false })).data as any[] ?? [],
  });
  const filtered = rows.filter((r: any) => (!search || r.title.toLowerCase().includes(search.toLowerCase())) && (statusF === "all" || r.status === statusF));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ideia" className="pl-9 rounded-full" />
          </div>
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="w-[160px] rounded-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {Object.keys(IDEA_STATUS).map(k => <SelectItem key={k} value={k}>{IDEA_STATUS[k].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button className="rounded-full gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova ideia</Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="rounded-3xl p-12 text-center">
          <Lightbulb className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <div className="font-medium">Nenhuma ideia no banco</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((i: any) => (
            <Card key={i.id} className="rounded-2xl p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">{i.title}</div>
                <Badge className={cn("rounded-full", IDEA_STATUS[i.status]?.color)}>{IDEA_STATUS[i.status]?.label}</Badge>
              </div>
              {i.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-3">{i.description}</p>}
              {i.platform && <div className="mt-3 text-xs text-muted-foreground">Plataforma: {i.platform}</div>}
            </Card>
          ))}
        </div>
      )}

      <IdeaDialog open={open} onOpenChange={setOpen} onSaved={() => qc.invalidateQueries({ queryKey: ["idea_bank"] })} />
    </div>
  );
}

function IdeaDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({ status: "idea" });
  useEffect(() => { if (!open) setForm({ status: "idea" }); }, [open]);
  const submit = async () => {
    if (!form.title) { toast.error("Título obrigatório"); return; }
    const { data: userRes } = await supabase.auth.getUser();
    const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", userRes.user!.id).maybeSingle();
    const { error } = await supabase.from("idea_bank" as any).insert({ ...form, organization_id: p!.organization_id });
    if (error) toast.error(error.message);
    else { toast.success("Ideia salva"); onSaved(); onOpenChange(false); }
  };
  return (
    <EntityDialog open={open} onOpenChange={onOpenChange} icon={Lightbulb} tone="amber"
      eyebrow="Novo registro" title="Nova ideia"
      main={<>
        <DialogField label="Título *"><Input value={form.title ?? ""} onChange={e => setForm({ ...form, title: e.target.value })} /></DialogField>
        <DialogField label="Descrição"><Textarea rows={4} value={form.description ?? ""} onChange={e => setForm({ ...form, description: e.target.value })} /></DialogField>
        <DialogField label="Plataforma"><Input value={form.platform ?? ""} onChange={e => setForm({ ...form, platform: e.target.value })} /></DialogField>
      </>}
      sidebar={<DialogField label="Status">
        <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{Object.keys(IDEA_STATUS).map(k => <SelectItem key={k} value={k}>{IDEA_STATUS[k].label}</SelectItem>)}</SelectContent>
        </Select>
      </DialogField>}
      footer={<>
        <DialogCancelButton onClick={() => onOpenChange(false)} />
        <Button className="rounded-full" onClick={submit}>Salvar ideia</Button>
      </>}
    />
  );
}
