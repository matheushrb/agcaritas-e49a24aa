import { useEffect, useMemo, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, GripVertical, Layers, Palette, Copy, Pencil, ChevronRight, ChevronDown, ListChecks, Info, Radio, SlidersHorizontal, FileText, Package } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { IconPicker, TaskTypeIcon } from "./icon-picker";
import { useAgencyPricing, computeAgencyRate } from "./agency-pricing";
import { fetchBriefingTemplates } from "@/lib/briefing";

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
  has_broadcast: boolean;
  has_live: boolean;
  has_tech_sheet: boolean;
  briefing_template_id: string | null;
};

export type TaskTypeStage = {
  id: string;
  task_type_id: string;
  name: string;
  order: number;
  color: string;
  status_group: StatusGroup;
  weight: number;
  auto_checklist: string[];
  auto_deliverables: AutoDeliverable[];
  auto_live: AutoLive[];
};

/** Entregável criado automaticamente ao atingir a etapa. */
export type AutoDeliverable = { label: string; platform: string; type: string; value: number | null };
/** Transmissão ao vivo / estreia criada automaticamente ao atingir a etapa. */
export type AutoLive = { title: string; kind: "live" | "premiere"; platform: string };

export const AUTO_DELIVERABLE_TYPES = [
  { value: "video", label: "Vídeo" },
  { value: "graphic", label: "Gráfico / Arte" },
  { value: "audio", label: "Áudio" },
  { value: "broadcast", label: "Transmissão online" },
  { value: "other", label: "Outro" },
];

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
        .select("id,name,description,color,icon,default_billing_model,default_price,active,has_broadcast,has_live,has_tech_sheet,briefing_template_id")
        .order("name");
      if (error) throw error;
      return (data ?? []) as TaskType[];
    },
  });

  const { data: stagesByType = {} } = useQuery<Record<string, TaskTypeStage[]>>({
    queryKey: ["task-type-stages"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("task_type_stages")
        .select("id,task_type_id,name,\"order\",color,status_group,weight,auto_checklist,auto_deliverables,auto_live")
        .order("order");
      if (error) throw error;
      const map: Record<string, TaskTypeStage[]> = {};
      for (const s of (data ?? []) as any[]) {
        const norm: TaskTypeStage = {
          ...s,
          auto_checklist: Array.isArray(s.auto_checklist) ? s.auto_checklist : [],
          auto_deliverables: Array.isArray(s.auto_deliverables) ? s.auto_deliverables : [],
          auto_live: Array.isArray(s.auto_live) ? s.auto_live : [],
        };
        (map[s.task_type_id] ||= []).push(norm);
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
          auto_checklist: s.auto_checklist ?? [],
          auto_deliverables: s.auto_deliverables ?? [],
          auto_live: s.auto_live ?? [],
        }));
        await (supabase as any).from("task_type_stages").insert(payload);
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
  const { data: briefingTemplates = [] } = useQuery({
    queryKey: ["briefing_templates"],
    queryFn: fetchBriefingTemplates,
  });

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
        <div
          className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center"
          style={{ backgroundColor: `${color}22`, color }}
          title="Prévia"
        >
          <TaskTypeIcon name={icon} className="h-5 w-5" />
        </div>
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

      {/* Cor + ícone + defaults */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Ícone</Label>
          <IconPicker
            value={icon}
            color={color}
            onChange={v => { setIcon(v); updateType.mutate({ icon: v }); }}
          />
        </div>
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
          <div className="flex items-center gap-2">
            <Input
              type="number" min={0} step={0.01}
              value={defaultPrice}
              onChange={e => setDefaultPrice(e.target.value)}
              onBlur={() => updateType.mutate({ default_price: defaultPrice ? Number(defaultPrice) : null })}
              className="h-9 rounded-lg w-32"
              placeholder="0,00"
            />
            <AgencySuggestion
              onApply={price => {
                setDefaultPrice(price.toString());
                updateType.mutate({ default_price: price });
              }}
            />
          </div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground -mt-2">
        Valor sugerido — pode ser sobrescrito manualmente em cada tarefa.
      </p>

      {/* Transmissão / Estreia (campos + aba na janela da tarefa) */}
      <div className="rounded-xl border p-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
            <Radio className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium">Ao Vivo / Estreia</div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Ativa a aba <b>Ao Vivo / Estreia</b> na janela da tarefa, com <b>data de gravação</b>, <b>data de estreia/transmissão</b> e formato (ao vivo, estreia gravada, gravado).
            </p>
          </div>
        </div>
        <Switch
          checked={type.has_broadcast || type.has_live}
          onCheckedChange={v => updateType.mutate({ has_broadcast: v, has_live: v })}
        />
      </div>


      {/* Ficha técnica */}
      <div className="rounded-xl border p-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium">Aba "Ficha técnica"</div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Exibe na janela da tarefa os campos técnicos (proporção, definição, luz, câmera, edição, arte).
            </p>
          </div>
        </div>
        <Switch
          checked={type.has_tech_sheet}
          onCheckedChange={v => updateType.mutate({ has_tech_sheet: v })}
        />
      </div>



      {/* Modelo de briefing */}
      <div className="rounded-xl border p-3 space-y-2">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="h-8 w-8 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium">Modelo de briefing padrão</div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Sugerido automaticamente na aba Briefing das tarefas deste tipo.
            </p>
          </div>
        </div>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={type.briefing_template_id ?? ""}
          onChange={e => updateType.mutate({ briefing_template_id: e.target.value || null })}
        >
          <option value="">Nenhum</option>
          {briefingTemplates
            .filter(t => t.template_type === "briefing")
            .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Stages */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Etapas do fluxo</div>
            <p className="text-[11px] text-muted-foreground">
              Cada etapa tem uma cor, um status macro e um <b>peso</b> — quanto vale essa etapa no cálculo automático do progresso da tarefa (ex.: Edição peso 3, Aprovação peso 1). O total é somado; ao concluir uma etapa, sua parte entra no progresso.
            </p>
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
  const [panel, setPanel] = useState<null | "checklist" | "deliverables" | "live">(null);
  const [newItem, setNewItem] = useState("");
  // Rascunhos locais — digitação não dispara gravação no banco a cada tecla.
  const [checklist, setChecklist] = useState<string[]>(stage.auto_checklist ?? []);
  const [deliverables, setDeliverables] = useState<AutoDeliverable[]>(stage.auto_deliverables ?? []);
  const [lives, setLives] = useState<AutoLive[]>(stage.auto_live ?? []);
  const expanded = panel !== null;
  useEffect(() => { setName(stage.name); setWeight(stage.weight.toString()); }, [stage.id, stage.name, stage.weight]);
  useEffect(() => { setChecklist(stage.auto_checklist ?? []); }, [stage.id, stage.auto_checklist]);
  useEffect(() => { setDeliverables(stage.auto_deliverables ?? []); }, [stage.id, stage.auto_deliverables]);
  useEffect(() => { setLives(stage.auto_live ?? []); }, [stage.id, stage.auto_live]);

  function commitChecklist(next: string[]) { setChecklist(next); onPatch({ auto_checklist: next }); }
  function commitDeliverables(next: AutoDeliverable[]) { setDeliverables(next); onPatch({ auto_deliverables: next }); }
  function commitLives(next: AutoLive[]) { setLives(next); onPatch({ auto_live: next }); }

  function addItem() {
    const v = newItem.trim();
    if (!v) return;
    commitChecklist([...checklist, v]);
    setNewItem("");
  }
  function removeItem(idx: number) {
    commitChecklist(checklist.filter((_, i) => i !== idx));
  }
  function updateItem(idx: number, value: string) {
    const next = [...checklist];
    next[idx] = value;
    if (next[idx] !== (stage.auto_checklist ?? [])[idx]) commitChecklist(next);
  }
  // edição local (sem gravar)
  function draftDeliverable(idx: number, patch: Partial<AutoDeliverable>) {
    setDeliverables(cur => cur.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }
  function draftLive(idx: number, patch: Partial<AutoLive>) {
    setLives(cur => cur.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }


  const toggle = (p: "checklist" | "deliverables" | "live") => setPanel(cur => (cur === p ? null : p));

  const tabBtn = (p: "checklist" | "deliverables" | "live", icon: React.ReactNode, count: number, title: string) => (
    <Button
      size="icon" variant="ghost"
      className={cn(
        "h-8 w-8 rounded-full transition-colors",
        count > 0 && "text-primary",
        panel === p && "bg-primary/10 text-primary ring-1 ring-primary/25",
      )}
      onClick={() => toggle(p)}
      title={title}
    >
      <span className="relative inline-flex items-center">
        {icon}
        {count > 0 && (
          <span className="absolute -top-1.5 -right-2 text-[9px] font-semibold bg-primary text-primary-foreground rounded-full min-w-[14px] h-[14px] px-1 flex items-center justify-center">
            {count}
          </span>
        )}
      </span>
    </Button>
  );

  return (
    <li className={cn("relative transition-colors", expanded ? "bg-primary/[0.045]" : "hover:bg-muted/20")}>
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: expanded ? stage.color : "transparent" }}
      />
      <div className="flex items-center gap-2 px-3 py-2">
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
            <button className="h-6 w-6 rounded-full shrink-0 ring-2 ring-background shadow-sm" style={{ backgroundColor: stage.color }} title="Cor" />
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
          className="h-8 flex-1 rounded-lg border-none bg-transparent shadow-none font-medium focus-visible:ring-1"
        />

        <Select value={stage.status_group} onValueChange={v => onPatch({ status_group: v as StatusGroup })}>
          <SelectTrigger className="h-8 rounded-lg w-40 text-xs bg-background">
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

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                <span>peso</span>
                <Info className="h-3 w-3" />
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-xs">
              Quanto essa etapa vale no <b>progresso automático</b> da tarefa. Ex.: com etapas de peso 1, 3 e 1 (total 5), concluir a etapa do meio adiciona 60% ao progresso.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Input
          type="number" min={0.1} step={0.1}
          value={weight}
          onChange={e => setWeight(e.target.value)}
          onBlur={() => onPatch({ weight: Number(weight) || 1 })}
          className="h-8 w-16 rounded-lg text-xs bg-background"
        />

        {tabBtn("checklist", <ListChecks className="h-4 w-4" />, checklist.length, "Checklist automático")}
        {tabBtn("deliverables", <Package className="h-4 w-4" />, deliverables.length, "Entregáveis automáticos")}
        {tabBtn("live", <Radio className="h-4 w-4" />, lives.length, "Transmissões ao vivo automáticas")}

        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive" onClick={onDelete} title="Excluir">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pl-14">
          <div className="rounded-xl border border-border bg-card p-3 space-y-2 shadow-sm">
            {panel === "checklist" && (
              <>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <ListChecks className="h-3 w-3" />
                  Ao atingir esta etapa, estes itens são criados como subtarefas automaticamente.
                </div>
                {checklist.length > 0 && (
                  <ul className="space-y-1">
                    {checklist.map((item, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                        <Input
                          value={item}
                          onChange={e => {
                            const v = e.target.value;
                            setChecklist(cur => cur.map((x, i) => (i === idx ? v : x)));
                          }}
                          onBlur={e => updateItem(idx, e.target.value)}
                          className="h-7 text-xs rounded-lg"
                        />

                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    value={newItem}
                    onChange={e => setNewItem(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
                    placeholder="Novo item da checklist…"
                    className="h-7 text-xs rounded-lg"
                  />
                  <Button size="sm" variant="outline" className="h-7 rounded-full gap-1" onClick={addItem}>
                    <Plus className="h-3 w-3" /> Adicionar
                  </Button>
                </div>
              </>
            )}

            {panel === "deliverables" && (
              <>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  Ao atingir esta etapa, estes entregáveis são criados na tarefa (com valor sugerido, se informado).
                </div>
                <ul className="space-y-1.5">
                  {deliverables.map((d, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Input
                        value={d.label}
                        onChange={e => draftDeliverable(idx, { label: e.target.value })}
                        onBlur={() => commitDeliverables(deliverables)}
                        placeholder="Nome do entregável"
                        className="h-7 text-xs rounded-lg flex-1"
                      />
                      <select
                        className="h-7 rounded-lg border border-input bg-background px-2 text-xs w-36"
                        value={d.type}
                        onChange={e => commitDeliverables(deliverables.map((x, i) => (i === idx ? { ...x, type: e.target.value } : x)))}
                      >
                        {AUTO_DELIVERABLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                      <Input
                        value={d.platform}
                        onChange={e => draftDeliverable(idx, { platform: e.target.value })}
                        onBlur={() => commitDeliverables(deliverables)}
                        placeholder="Plataforma"
                        className="h-7 text-xs rounded-lg w-32"
                      />
                      <Input
                        type="number" min={0} step={0.01}
                        value={d.value ?? ""}
                        onChange={e => draftDeliverable(idx, { value: e.target.value ? Number(e.target.value) : null })}
                        onBlur={() => commitDeliverables(deliverables)}
                        placeholder="R$"
                        className="h-7 text-xs rounded-lg w-24"
                      />

                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onPatch({ auto_deliverables: deliverables.filter((_, i) => i !== idx) })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="outline" className="h-7 rounded-full gap-1"
                  onClick={() => onPatch({ auto_deliverables: [...deliverables, { label: "", type: "video", platform: "", value: null }] })}>
                  <Plus className="h-3 w-3" /> Adicionar entregável
                </Button>
              </>
            )}

            {panel === "live" && (
              <>
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Radio className="h-3 w-3" />
                  Ao atingir esta etapa, estas transmissões são criadas na aba <b>Ao Vivo / Estreia</b> da tarefa.
                </div>
                <ul className="space-y-1.5">
                  {lives.map((l, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Input
                        value={l.title}
                        onChange={e => draftLive(idx, { title: e.target.value })}
                        onBlur={() => commitLives(lives)}
                        placeholder="Título da transmissão"
                        className="h-7 text-xs rounded-lg flex-1"
                      />
                      <select
                        className="h-7 rounded-lg border border-input bg-background px-2 text-xs w-36"
                        value={l.kind}
                        onChange={e => commitLives(lives.map((x, i) => (i === idx ? { ...x, kind: e.target.value as AutoLive["kind"] } : x)))}
                      >
                        <option value="live">Ao vivo</option>
                        <option value="premiere">Estreia</option>
                      </select>
                      <Input
                        value={l.platform}
                        onChange={e => draftLive(idx, { platform: e.target.value })}
                        onBlur={() => commitLives(lives)}
                        placeholder="Plataforma"
                        className="h-7 text-xs rounded-lg w-32"
                      />

                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onPatch({ auto_live: lives.filter((_, i) => i !== idx) })}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="outline" className="h-7 rounded-full gap-1"
                  onClick={() => onPatch({ auto_live: [...lives, { title: "", kind: "live", platform: "" }] })}>
                  <Plus className="h-3 w-3" /> Adicionar transmissão
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}


function AgencySuggestion({ onApply }: { onApply: (price: number) => void }) {
  const { data: pricing } = useAgencyPricing();
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState<string>("1");
  const totals = pricing ? computeAgencyRate(pricing) : null;
  const rate = totals?.suggested ?? 0;
  const configured =
    !!pricing &&
    (pricing.fixed_costs.length > 0 || pricing.variable_costs.length > 0) &&
    (pricing.billable_hours_month || 0) > 0;
  const suggested = Math.max(0, (Number(hours) || 0) * rate);
  const BRL = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="rounded-full gap-1 h-9">
          Preço sugerido
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-xl p-3 space-y-3">
        <div>
          <div className="text-xs font-semibold">Sugestão pela agência</div>
          <p className="text-[11px] text-muted-foreground">
            Usa os custos, horas faturáveis e margem definidos na aba <b>Precificação</b>.
          </p>
        </div>

        {!configured ? (
          <div className="rounded-lg border border-dashed p-3 text-[11px] text-muted-foreground space-y-1">
            <div className="font-medium text-foreground">Precificação ainda não configurada</div>
            <p>Cadastre custos fixos, variáveis, horas faturáveis por mês e margem de lucro para o sistema calcular a hora da agência.</p>
            <p>Vá em <b>Configurações → Precificação</b> e volte aqui.</p>
          </div>
        ) : (
          <div className="rounded-lg bg-muted/40 px-3 py-2 space-y-1 text-[11px]">
            <Row label="Custos fixos / mês" value={BRL(totals!.fixed)} />
            <Row label="Custos variáveis / mês" value={BRL(totals!.variable)} />
            <Row label="Horas faturáveis / mês" value={`${totals!.hours}h`} />
            <Row label="Custo por hora" value={BRL(totals!.costPerHour)} />
            <Row label={`Margem (${pricing!.profit_margin_pct}%) + impostos (${pricing!.tax_pct}%)`} value="" />
            <div className="h-px bg-border my-1" />
            <Row label="Hora da agência" value={BRL(rate)} strong />
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Horas estimadas por tarefa</Label>
          <Input
            type="number" min={0} step={0.5}
            value={hours}
            onChange={e => setHours(e.target.value)}
            className="h-9 rounded-lg"
          />
        </div>
        <div className="rounded-lg bg-primary/10 px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-primary">Preço sugerido</span>
          <span className="text-sm font-semibold tabular-nums">{BRL(suggested)}</span>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            size="sm"
            className="rounded-full"
            disabled={!configured || !rate || !suggested}
            onClick={() => { onApply(Number(suggested.toFixed(2))); setOpen(false); }}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</span>
    </div>
  );
}
