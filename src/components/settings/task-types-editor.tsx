import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, GripVertical, Layers, Palette, Copy, Pencil, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { IconPicker, TaskTypeIcon } from "./icon-picker";
import { PriceCalculatorButton } from "./price-calculator";

export type StatusGroup = "todo" | "in_progress" | "review" | "done";

export type TaskType = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  default_billing_model: string | null;
  default_price: number | null;
  active: boolean;
};

export type TaskTypeStage = {
  id: string;
  task_type_id: string;
  name: string;
  order: number;
  color: string;
  status_group: StatusGroup;
  weight: number;
};

const STATUS_GROUP_META: Record<StatusGroup, { label: string; dot: string }> = {
  todo:        { label: "A fazer",      dot: "bg-slate-400" },
  in_progress: { label: "Em andamento", dot: "bg-blue-500" },
  review:      { label: "Revisão",      dot: "bg-amber-500" },
  done:        { label: "Concluído",    dot: "bg-emerald-500" },
};

const COLOR_PRESETS = [
  "#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#F59E0B",
  "#10B981", "#14B8A6", "#0EA5E9", "#64748B", "#111827",
];

async function getOrgId() {
  const { data } = await supabase.from("profiles").select("organization_id").maybeSingle();
  if (!data?.organization_id) throw new Error("Sem organização");
  return data.organization_id as string;
}

export function TaskTypesEditor() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: types = [] } = useQuery<TaskType[]>({
    queryKey: ["task-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_types")
        .select("id,name,description,color,icon,default_billing_model,default_price,active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as TaskType[];
    },
  });

  const { data: stagesByType = {} } = useQuery<Record<string, TaskTypeStage[]>>({
    queryKey: ["task-type-stages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_type_stages")
        .select("id,task_type_id,name,\"order\",color,status_group,weight")
        .order("order");
      if (error) throw error;
      const map: Record<string, TaskTypeStage[]> = {};
      for (const s of (data ?? []) as TaskTypeStage[]) {
        (map[s.task_type_id] ||= []).push(s);
      }
      return map;
    },
  });

  const createType = useMutation({
    mutationFn: async (input: { name: string; description: string; color: string; icon: string | null }) => {
      const organization_id = await getOrgId();
      const { data, error } = await supabase.from("task_types").insert({
        organization_id,
        name: input.name,
        description: input.description || null,
        color: input.color,
        icon: input.icon,
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: id => {
      qc.invalidateQueries({ queryKey: ["task-types"] });
      setSelectedId(id);
      setCreating(false);
      toast.success("Tipo criado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-types"] });
      qc.invalidateQueries({ queryKey: ["task-type-stages"] });
      setSelectedId(null);
      toast.success("Tipo excluído");
    },
  });

  const duplicateType = useMutation({
    mutationFn: async (id: string) => {
      const t = types.find(x => x.id === id);
      if (!t) return;
      const organization_id = await getOrgId();
      const { data: newT, error } = await supabase.from("task_types").insert({
        organization_id,
        name: `${t.name} (cópia)`,
        description: t.description,
        color: t.color,
        icon: t.icon,
        default_billing_model: t.default_billing_model,
        default_price: t.default_price,
      }).select("id").single();
      if (error) throw error;
      const stages = stagesByType[id] ?? [];
      if (stages.length) {
        const payload = stages.map(s => ({
          task_type_id: newT.id,
          organization_id,
          name: s.name,
          order: s.order,
          color: s.color,
          status_group: s.status_group,
          weight: s.weight,
        }));
        await supabase.from("task_type_stages").insert(payload);
      }
      return newT.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task-types"] });
      qc.invalidateQueries({ queryKey: ["task-type-stages"] });
      toast.success("Tipo duplicado");
    },
  });

  const selected = types.find(t => t.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
      {/* Lista */}
      <Card className="rounded-2xl p-3 space-y-1 h-fit">
        <div className="flex items-center justify-between px-2 py-1">
          <div className="text-sm font-medium">Tipos de Tarefa</div>
          <Button size="sm" variant="ghost" className="rounded-full h-7 gap-1" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo
          </Button>
        </div>
        {types.length === 0 && (
          <div className="text-xs text-muted-foreground px-3 py-6 text-center">
            Nenhum tipo criado. Crie tipos como "Post estático", "Reels", "Vídeo institucional" — cada um com seu próprio fluxo de etapas.
          </div>
        )}
        <ul className="space-y-0.5">
          {types.map(t => {
            const stageCount = stagesByType[t.id]?.length ?? 0;
            const active = selectedId === t.id;
            return (
              <li key={t.id}>
                <button
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    "w-full text-left rounded-xl px-3 py-2 flex items-center gap-2 hover:bg-muted transition-colors",
                    active && "bg-muted",
                  )}
                >
                  <span
                    className="h-6 w-6 rounded-md shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: `${t.color}22`, color: t.color }}
                  >
                    {t.icon ? <TaskTypeIcon name={t.icon} className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: t.color }} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground">{stageCount} etapa{stageCount === 1 ? "" : "s"}</div>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Editor */}
      <div>
        {selected ? (
          <TypeEditorPanel
            type={selected}
            stages={stagesByType[selected.id] ?? []}
            onDelete={() => deleteType.mutate(selected.id)}
            onDuplicate={() => duplicateType.mutate(selected.id)}
          />
        ) : (
          <Card className="rounded-2xl p-10 text-center border-dashed">
            <Layers className="h-8 w-8 mx-auto text-muted-foreground" />
            <div className="mt-3 font-medium">Selecione um tipo</div>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Cada tipo define suas próprias etapas, cores e o status macro (A fazer / Em andamento / Revisão / Concluído) a que cada etapa pertence.
            </p>
          </Card>
        )}
      </div>

      {creating && (
        <NewTypeDialog
          onCancel={() => setCreating(false)}
          onCreate={input => createType.mutate(input)}
          pending={createType.isPending}
        />
      )}
    </div>
  );
}

function NewTypeDialog({ onCancel, onCreate, pending }:{
  onCancel: () => void;
  onCreate: (v: { name: string; description: string; color: string; icon: string | null }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [icon, setIcon] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={v => !v && onCancel()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogTitle>Novo tipo de tarefa</DialogTitle>
        <div className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Produção audiovisual — Teaser 3min" />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Opcional" />
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
            <div className="space-y-1.5">
              <Label>Ícone</Label>
              <IconPicker value={icon} onChange={setIcon} color={color} />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex gap-1.5 flex-wrap">
                {COLOR_PRESETS.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    className={cn("h-7 w-7 rounded-lg border-2 transition-all", color === c ? "border-foreground scale-110" : "border-transparent")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" className="rounded-full" onClick={onCancel}>Cancelar</Button>
          <Button className="rounded-full" disabled={!name.trim() || pending}
            onClick={() => onCreate({ name: name.trim(), description, color, icon })}>
            Criar tipo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TypeEditorPanel({ type, stages, onDelete, onDuplicate }:{
  type: TaskType;
  stages: TaskTypeStage[];
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(type.name);
  const [description, setDescription] = useState(type.description ?? "");
  const [color, setColor] = useState(type.color);
  const [icon, setIcon] = useState<string | null>(type.icon ?? null);
  const [billingModel, setBillingModel] = useState(type.default_billing_model ?? "");
  const [defaultPrice, setDefaultPrice] = useState(type.default_price?.toString() ?? "");

  // Sync when switching type
  useMemo(() => {
    setName(type.name);
    setDescription(type.description ?? "");
    setColor(type.color);
    setIcon(type.icon ?? null);
    setBillingModel(type.default_billing_model ?? "");
    setDefaultPrice(type.default_price?.toString() ?? "");
  }, [type.id]);

  const updateType = useMutation({
    mutationFn: async (patch: Partial<TaskType>) => {
      const { error } = await supabase.from("task_types").update(patch).eq("id", type.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-types"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const addStage = useMutation({
    mutationFn: async () => {
      const organization_id = await getOrgId();
      const nextOrder = (stages[stages.length - 1]?.order ?? -1) + 1;
      const { error } = await supabase.from("task_type_stages").insert({
        task_type_id: type.id,
        organization_id,
        name: "Nova etapa",
        order: nextOrder,
        color: "#94A3B8",
        status_group: "in_progress",
        weight: 1,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-type-stages"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<TaskTypeStage> }) => {
      const { error } = await supabase.from("task_type_stages").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-type-stages"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_type_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-type-stages"] }),
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const idx = stages.findIndex(s => s.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= stages.length) return;
      const a = stages[idx], b = stages[target];
      await supabase.from("task_type_stages").update({ order: b.order }).eq("id", a.id);
      await supabase.from("task_type_stages").update({ order: a.order }).eq("id", b.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-type-stages"] }),
  });

  return (
    <Card className="rounded-2xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button className="h-10 w-10 rounded-xl shrink-0" style={{ backgroundColor: color }} title="Cor do tipo" />
        <div className="flex-1 min-w-0 space-y-2">
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => name.trim() && name !== type.name && updateType.mutate({ name: name.trim() })}
            className="text-lg font-semibold border-none shadow-none px-0 h-auto focus-visible:ring-0"
          />
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={() => updateType.mutate({ description: description || null })}
            rows={2}
            placeholder="Descrição do tipo (opcional)"
            className="text-sm rounded-lg"
          />
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="rounded-full gap-1" onClick={onDuplicate}>
            <Copy className="h-3.5 w-3.5" /> Duplicar
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full text-destructive hover:bg-destructive/10 gap-1" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
        </div>
      </div>

      {/* Cor + defaults */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">Cor</Label>
          <div className="flex gap-1.5 flex-wrap">
            {COLOR_PRESETS.map(c => (
              <button key={c}
                onClick={() => { setColor(c); updateType.mutate({ color: c }); }}
                className={cn("h-7 w-7 rounded-lg border-2 transition-all", color === c ? "border-foreground scale-110" : "border-transparent")}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Modelo de faturamento padrão</Label>
          <Select value={billingModel || "none"} onValueChange={v => {
            const nv = v === "none" ? "" : v;
            setBillingModel(nv);
            updateType.mutate({ default_billing_model: nv || null });
          }}>
            <SelectTrigger className="h-9 rounded-lg w-44"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              <SelectItem value="per_task">Por tarefa</SelectItem>
              <SelectItem value="hourly">Por hora</SelectItem>
              <SelectItem value="one_time">Fixo</SelectItem>
              <SelectItem value="package">Pacote</SelectItem>
              <SelectItem value="monthly">Recorrente</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Preço padrão (R$)</Label>
          <Input
            type="number" min={0} step={0.01}
            value={defaultPrice}
            onChange={e => setDefaultPrice(e.target.value)}
            onBlur={() => updateType.mutate({ default_price: defaultPrice ? Number(defaultPrice) : null })}
            className="h-9 rounded-lg w-32"
            placeholder="0,00"
          />
        </div>
      </div>

      {/* Stages */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Etapas do fluxo</div>
            <p className="text-[11px] text-muted-foreground">Ordem, cor e o status macro a que cada etapa pertence.</p>
          </div>
          <Button size="sm" variant="outline" className="rounded-full gap-1" onClick={() => addStage.mutate()}>
            <Plus className="h-3.5 w-3.5" /> Adicionar etapa
          </Button>
        </div>

        {stages.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma etapa. Adicione a primeira — por exemplo: Briefing → Roteiro → Captação → Edição → Aprovação → Entrega.
          </div>
        ) : (
          <ul className="rounded-xl border border-border divide-y divide-border overflow-hidden">
            {stages.map((s, i) => (
              <StageRow
                key={s.id}
                stage={s}
                canUp={i > 0}
                canDown={i < stages.length - 1}
                onMove={dir => moveStage.mutate({ id: s.id, dir })}
                onPatch={patch => updateStage.mutate({ id: s.id, patch })}
                onDelete={() => deleteStage.mutate(s.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function StageRow({ stage, canUp, canDown, onMove, onPatch, onDelete }:{
  stage: TaskTypeStage;
  canUp: boolean; canDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onPatch: (patch: Partial<TaskTypeStage>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(stage.name);
  const [weight, setWeight] = useState(stage.weight.toString());
  useMemo(() => { setName(stage.name); setWeight(stage.weight.toString()); }, [stage.id, stage.name, stage.weight]);

  return (
    <li className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30">
      <div className="flex flex-col">
        <button className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={!canUp} onClick={() => onMove(-1)} title="Mover para cima">
          <GripVertical className="h-3 w-3 rotate-90" />
        </button>
        <button className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={!canDown} onClick={() => onMove(1)} title="Mover para baixo">
          <GripVertical className="h-3 w-3 -rotate-90" />
        </button>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button className="h-6 w-6 rounded-md shrink-0" style={{ backgroundColor: stage.color }} title="Cor" />
        </PopoverTrigger>
        <PopoverContent className="p-2 w-auto rounded-xl">
          <div className="flex gap-1.5 flex-wrap max-w-[180px]">
            {COLOR_PRESETS.map(c => (
              <button key={c} onClick={() => onPatch({ color: c })}
                className={cn("h-6 w-6 rounded-md border-2", stage.color === c ? "border-foreground" : "border-transparent")}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={() => name.trim() && name !== stage.name && onPatch({ name: name.trim() })}
        className="h-8 flex-1 rounded-lg border-none shadow-none focus-visible:ring-1"
      />

      <Select value={stage.status_group} onValueChange={v => onPatch({ status_group: v as StatusGroup })}>
        <SelectTrigger className="h-8 rounded-lg w-40 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(STATUS_GROUP_META) as StatusGroup[]).map(k => (
            <SelectItem key={k} value={k}>
              <span className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", STATUS_GROUP_META[k].dot)} />
                {STATUS_GROUP_META[k].label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>peso</span>
        <Input
          type="number" min={0.1} step={0.1}
          value={weight}
          onChange={e => setWeight(e.target.value)}
          onBlur={() => onPatch({ weight: Number(weight) || 1 })}
          className="h-8 w-16 rounded-lg text-xs"
        />
      </div>

      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive" onClick={onDelete} title="Excluir">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}
