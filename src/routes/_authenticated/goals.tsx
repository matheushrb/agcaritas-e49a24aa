import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityDialog, DialogField, DialogCancelButton } from "@/components/entity-dialog";
import { Target, Plus, TrendingUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Metas · Caritas" }] }),
  component: GoalsPage,
});

type Goal = {
  id: string;
  title: string;
  category: string;
  current_value: number;
  target_value: number;
  unit: string | null;
  period: string | null;
  start_date: string | null;
  end_date: string | null;
};

const CATEGORIES: Record<string, { label: string; color: string }> = {
  revenue:     { label: "Receita",      color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  new_clients: { label: "Novos Clientes", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  proposals:   { label: "Propostas",    color: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  delivery:    { label: "Entregas",     color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  quality:     { label: "Qualidade",    color: "bg-pink-500/15 text-pink-600 dark:text-pink-400" },
  other:       { label: "Outro",        color: "bg-muted text-muted-foreground" },
};

function GoalsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals")
        .select("id,title,category,current_value,target_value,unit,period,start_date,end_date")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Goal[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: Partial<Goal>) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await supabase.from("goals").insert({
        organization_id: profile.organization_id,
        title: input.title!,
        category: input.category ?? "other",
        target_value: input.target_value ?? 0,
        current_value: input.current_value ?? 0,
        unit: input.unit ?? null,
        period: input.period ?? "monthly",
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["goals"] }); toast.success("Meta criada"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Metas</h1>
          <p className="text-sm text-muted-foreground">Objetivos da agência e do time — receita, entregas e qualidade.</p>
        </div>
        <Button className="rounded-full gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova meta</Button>
      </header>

      {goals.length === 0 ? (
        <Card className="rounded-3xl p-12 text-center border-dashed">
          <Target className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <div className="font-medium">Nenhuma meta cadastrada</div>
          <p className="text-sm text-muted-foreground mt-1">Defina metas mensuráveis para acompanhar em tempo real.</p>
          <Button className="rounded-full mt-4" onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova meta</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {goals.map(g => {
            const pct = g.target_value > 0 ? Math.min(100, Math.round((g.current_value / g.target_value) * 100)) : 0;
            const cat = CATEGORIES[g.category] ?? CATEGORIES.other;
            return (
              <Card key={g.id} className="rounded-2xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{g.title}</div>
                    <Badge className={cn("rounded-full mt-1", cat.color)}>{cat.label}</Badge>
                  </div>
                  <button onClick={() => { if (confirm("Excluir meta?")) remove.mutate(g.id); }}
                    className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>

                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <div className="text-2xl font-semibold tracking-tight">
                      {g.unit === "R$" ? "R$ " : ""}{g.current_value.toLocaleString("pt-BR")}{g.unit && g.unit !== "R$" ? ` ${g.unit}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      de {g.unit === "R$" ? "R$ " : ""}{g.target_value.toLocaleString("pt-BR")}{g.unit && g.unit !== "R$" ? ` ${g.unit}` : ""}
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" />{pct}%</span>
                    <span>{g.period ?? "—"}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <NewGoalDialog open={open} onOpenChange={setOpen} onCreate={v => create.mutate(v)} pending={create.isPending} />
    </div>
  );
}

function NewGoalDialog({
  open, onOpenChange, onCreate, pending,
}: { open: boolean; onOpenChange: (v: boolean) => void; onCreate: (v: Partial<Goal>) => void; pending: boolean }) {
  const [f, setF] = useState<Partial<Goal>>({ category: "revenue", period: "monthly", target_value: 0, current_value: 0, unit: "R$" });

  return (
    <EntityDialog
      open={open} onOpenChange={onOpenChange}
      icon={Target} tone="purple" eyebrow="Metas" title="Nova meta"
      subtitle="Defina o objetivo, o alvo e como será medido."
      main={
        <>
          <DialogField label="Título da meta">
            <Input autoFocus value={f.title ?? ""} onChange={e => setF({ ...f, title: e.target.value })}
              placeholder="Ex.: MRR de R$ 50.000" />
          </DialogField>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="Valor atual">
              <Input type="number" step="0.01" value={f.current_value ?? ""}
                onChange={e => setF({ ...f, current_value: Number(e.target.value) })} />
            </DialogField>
            <DialogField label="Alvo">
              <Input type="number" step="0.01" value={f.target_value ?? ""}
                onChange={e => setF({ ...f, target_value: Number(e.target.value) })} />
            </DialogField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="Início"><Input type="date" value={f.start_date ?? ""} onChange={e => setF({ ...f, start_date: e.target.value })} /></DialogField>
            <DialogField label="Fim"><Input type="date" value={f.end_date ?? ""} onChange={e => setF({ ...f, end_date: e.target.value })} /></DialogField>
          </div>
        </>
      }
      sidebar={
        <>
          <DialogField label="Categoria">
            <Select value={f.category} onValueChange={v => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </DialogField>
          <DialogField label="Unidade">
            <Select value={f.unit ?? "R$"} onValueChange={v => setF({ ...f, unit: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="R$">R$</SelectItem>
                <SelectItem value="un">Unidades</SelectItem>
                <SelectItem value="%">Percentual</SelectItem>
                <SelectItem value="h">Horas</SelectItem>
              </SelectContent>
            </Select>
          </DialogField>
          <DialogField label="Período">
            <Select value={f.period ?? "monthly"} onValueChange={v => setF({ ...f, period: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="quarterly">Trimestral</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          </DialogField>
        </>
      }
      footer={
        <>
          <DialogCancelButton onClick={() => onOpenChange(false)} />
          <Button className="rounded-full" disabled={!f.title || pending} onClick={() => onCreate(f)}>Criar meta</Button>
        </>
      }
    />
  );
}
