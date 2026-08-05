import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { getOrgId } from "@/lib/briefing";

export interface PipelineStage {
  id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  color: string;
  default_probability: number;
  is_won: boolean;
  is_lost: boolean;
}

export const stagesKey = ["pipeline_stages"] as const;

export async function fetchStages(): Promise<PipelineStage[]> {
  const { data, error } = await supabase.from("pipeline_stages").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []) as PipelineStage[];
}

export function PipelineStagesEditor() {
  const qc = useQueryClient();
  const { data: stages = [] } = useQuery({ queryKey: stagesKey, queryFn: fetchStages });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<PipelineStage> }) => {
      const { error } = await supabase.from("pipeline_stages").update(values as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: stagesKey }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar etapa"),
  });

  const create = useMutation({
    mutationFn: async () => {
      const organization_id = await getOrgId();
      const { error } = await supabase.from("pipeline_stages").insert({
        organization_id,
        name: "Nova etapa",
        sort_order: stages.length,
        color: "#64748B",
        default_probability: 0,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Etapa criada"); qc.invalidateQueries({ queryKey: stagesKey }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar etapa"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pipeline_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Etapa removida"); qc.invalidateQueries({ queryKey: stagesKey }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  const move = (index: number, dir: -1 | 1) => {
    const target = stages[index + dir];
    const current = stages[index];
    if (!target || !current) return;
    patch.mutate({ id: current.id, values: { sort_order: target.sort_order } });
    patch.mutate({ id: target.id, values: { sort_order: current.sort_order } });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Funil CRM</h2>
          <p className="text-sm text-muted-foreground">
            Etapas do pipeline com cor, ordem, probabilidade padrão e marcação de ganho/perdido.
          </p>
        </div>
        <Button className="rounded-full gap-2" onClick={() => create.mutate()}>
          <Plus className="h-4 w-4" /> Nova etapa
        </Button>
      </div>

      <div className="space-y-2">
        {stages.map((s, i) => (
          <Card key={s.id} className="p-3">
            <div className="grid grid-cols-12 items-end gap-3">
              <div className="col-span-12 sm:col-span-4">
                <Label className="text-[11px] text-muted-foreground">Nome</Label>
                <Input
                  className="mt-1 h-9"
                  defaultValue={s.name}
                  onBlur={e => e.target.value !== s.name && patch.mutate({ id: s.id, values: { name: e.target.value } })}
                />
              </div>
              <div className="col-span-4 sm:col-span-2">
                <Label className="text-[11px] text-muted-foreground">Cor</Label>
                <Input
                  type="color"
                  className="mt-1 h-9 p-1"
                  defaultValue={s.color}
                  onBlur={e => e.target.value !== s.color && patch.mutate({ id: s.id, values: { color: e.target.value } })}
                />
              </div>
              <div className="col-span-8 sm:col-span-2">
                <Label className="text-[11px] text-muted-foreground">Probabilidade (%)</Label>
                <Input
                  type="number" min={0} max={100}
                  className="mt-1 h-9"
                  defaultValue={s.default_probability}
                  onBlur={e => patch.mutate({ id: s.id, values: { default_probability: Number(e.target.value) || 0 } })}
                />
              </div>
              <div className="col-span-6 sm:col-span-1 flex flex-col gap-1">
                <Label className="text-[11px] text-muted-foreground">Ganho</Label>
                <Switch checked={s.is_won} onCheckedChange={v => patch.mutate({ id: s.id, values: { is_won: v, is_lost: v ? false : s.is_lost } })} />
              </div>
              <div className="col-span-6 sm:col-span-1 flex flex-col gap-1">
                <Label className="text-[11px] text-muted-foreground">Perdido</Label>
                <Switch checked={s.is_lost} onCheckedChange={v => patch.mutate({ id: s.id, values: { is_lost: v, is_won: v ? false : s.is_won } })} />
              </div>
              <div className="col-span-12 sm:col-span-2 flex justify-end gap-1">
                <Button size="icon" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" disabled={i === stages.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(s.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
