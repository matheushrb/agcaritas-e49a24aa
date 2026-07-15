import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { EntityDialog, DialogField, DialogCancelButton } from "@/components/entity-dialog";
import { Target, Plus, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { money } from "@/lib/br-utils";

export const Route = createFileRoute("/_authenticated/goals")({
  head: () => ({ meta: [{ title: "Metas · Caritas Agência" }] }),
  component: GoalsPage,
});

type Goal = {
  id: string; title: string; category: string;
  target_value: number; current_value: number;
  unit: string; period: string;
  start_date: string | null; end_date: string | null;
  auto_calculate: boolean;
};

const CATEGORIES = [
  { key: "all", label: "Todas", color: "" },
  { key: "financial", label: "Financeiro", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { key: "clients",   label: "Clientes",   color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  { key: "production",label: "Produção",   color: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  { key: "marketing", label: "Marketing",  color: "bg-pink-500/15 text-pink-600 dark:text-pink-400" },
];

function GoalsPage() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState("monthly");
  const [cat, setCat] = useState("all");
  const [open, setOpen] = useState(false);

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data } = await supabase.from("goals" as any).select("*").order("created_at", { ascending: false });
      return (data as any) ?? [];
    },
  });

  const filtered = useMemo(() => goals.filter(g => (cat === "all" || g.category === cat) && g.period === period), [goals, cat, period]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Metas</h1>
          <p className="text-sm text-muted-foreground mt-1">Objetivos mensuráveis por período e categoria.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px] rounded-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Este mês</SelectItem>
              <SelectItem value="quarterly">Este trimestre</SelectItem>
              <SelectItem value="yearly">Este ano</SelectItem>
            </SelectContent>
          </Select>
          <Button className="rounded-full gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova meta</Button>
        </div>
      </div>

      <Tabs value={cat} onValueChange={setCat}>
        <TabsList className="rounded-full bg-muted/60 h-auto flex-wrap">
          {CATEGORIES.map(c => <TabsTrigger key={c.key} value={c.key} className="rounded-full">{c.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <Card className="rounded-3xl p-12 text-center">
          <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <div className="font-medium">Nenhuma meta neste período</div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(g => <GoalCard key={g.id} goal={g} onUpdate={() => qc.invalidateQueries({ queryKey: ["goals"] })} />)}
        </div>
      )}

      <NewGoalDialog open={open} onOpenChange={setOpen} onCreated={() => qc.invalidateQueries({ queryKey: ["goals"] })} />
    </div>
  );
}

function GoalCard({ goal, onUpdate }: { goal: Goal; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(goal.current_value));
  const pct = goal.target_value > 0 ? (goal.current_value / goal.target_value) * 100 : 0;
  const barColor = pct >= 100 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500";
  const catMeta = CATEGORIES.find(c => c.key === goal.category);
  const fmt = (v: number) => goal.unit === "BRL" ? money(v) : `${v}${goal.unit === "%" ? "%" : ""}`;

  const save = async () => {
    const n = Number(val.replace(",", "."));
    if (isNaN(n)) return;
    await supabase.from("goals" as any).update({ current_value: n }).eq("id", goal.id);
    toast.success("Meta atualizada");
    setEditing(false);
    onUpdate();
  };

  return (
    <Card className="rounded-2xl p-5">
      <Badge className={cn("rounded-full", catMeta?.color)}>{catMeta?.label ?? goal.category}</Badge>
      <div className="mt-2 font-semibold">{goal.title}</div>
      <div className="mt-4 text-4xl font-bold tracking-tight">{pct.toFixed(1).replace(".", ",")}%</div>
      <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full transition-all", barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm">
        {editing ? (
          <>
            <Input value={val} onChange={e => setVal(e.target.value)} className="h-8 rounded-lg" onKeyDown={e => e.key === "Enter" && save()} />
            <span className="text-muted-foreground">/ {fmt(goal.target_value)}</span>
            <Button size="icon" variant="ghost" onClick={save}><Check className="h-3.5 w-3.5" /></Button>
          </>
        ) : (
          <>
            <span className="font-medium">{fmt(goal.current_value)}</span>
            <span className="text-muted-foreground">/ {fmt(goal.target_value)}</span>
            {!goal.auto_calculate && (
              <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></Button>
            )}
          </>
        )}
      </div>
      {goal.auto_calculate && <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">Automático</div>}
    </Card>
  );
}

function NewGoalDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [form, setForm] = useState<any>({ title: "", category: "financial", target_value: 0, unit: "BRL", period: "monthly", auto_calculate: false });
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!open) setForm({ title: "", category: "financial", target_value: 0, unit: "BRL", period: "monthly", auto_calculate: false }); }, [open]);

  const submit = async () => {
    if (!form.title) { toast.error("Título obrigatório"); return; }
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const { data: p } = await supabase.from("profiles").select("organization_id").eq("id", userRes.user!.id).maybeSingle();
      if (!p?.organization_id) throw new Error("Sem org");
      const { error } = await supabase.from("goals" as any).insert({ ...form, organization_id: p.organization_id, target_value: Number(form.target_value) });
      if (error) throw error;
      toast.success("Meta criada");
      onCreated();
      onOpenChange(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <EntityDialog
      open={open} onOpenChange={onOpenChange} icon={Target} tone="emerald"
      eyebrow="Novo registro" title="Nova meta"
      main={
        <>
          <DialogField label="Título *"><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></DialogField>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="Categoria">
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.filter(c => c.key !== "all").map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </DialogField>
            <DialogField label="Unidade">
              <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">R$</SelectItem>
                  <SelectItem value="qty">Quantidade</SelectItem>
                  <SelectItem value="%">Percentual</SelectItem>
                </SelectContent>
              </Select>
            </DialogField>
          </div>
          <DialogField label="Valor meta *">
            <Input type="number" value={form.target_value} onChange={e => setForm({ ...form, target_value: e.target.value })} />
          </DialogField>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="Início"><Input type="date" value={form.start_date ?? ""} onChange={e => setForm({ ...form, start_date: e.target.value })} /></DialogField>
            <DialogField label="Fim"><Input type="date" value={form.end_date ?? ""} onChange={e => setForm({ ...form, end_date: e.target.value })} /></DialogField>
          </div>
        </>
      }
      sidebar={
        <>
          <DialogField label="Período">
            <Select value={form.period} onValueChange={v => setForm({ ...form, period: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="quarterly">Trimestral</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          </DialogField>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <div className="text-sm font-medium">Auto-calcular</div>
              <div className="text-xs text-muted-foreground">Soma cobranças pagas</div>
            </div>
            <Switch checked={form.auto_calculate} onCheckedChange={v => setForm({ ...form, auto_calculate: v })} />
          </div>
        </>
      }
      footer={
        <>
          <DialogCancelButton onClick={() => onOpenChange(false)} />
          <Button className="rounded-full" disabled={saving} onClick={submit}>{saving ? "Salvando..." : "Criar meta"}</Button>
        </>
      }
    />
  );
}
