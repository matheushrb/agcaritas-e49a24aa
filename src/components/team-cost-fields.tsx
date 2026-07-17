import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { DialogField } from "@/components/entity-dialog";

export type CostMode = "internal_fixed" | "freelancer_per_task" | "freelancer_per_hour" | "one_off";

export type TeamCostFields = {
  cost_mode: CostMode;
  monthly_salary: number | null;
  monthly_hours: number | null;
  hourly_rate: number | null;
  default_task_rate: number | null;
  task_rate_overrides: Record<string, number>;
  cost_notes: string | null;
};

export const COST_MODE_LABEL: Record<CostMode, string> = {
  internal_fixed: "Interno (salário fixo)",
  freelancer_per_task: "Freela por tarefa",
  freelancer_per_hour: "Freela por hora",
  one_off: "Pagamento avulso",
};

export const COST_MODE_HINT: Record<CostMode, string> = {
  internal_fixed: "Não gera custo variável por task. O sistema calcula quanto do salário foi consumido pelo tempo trabalhado no projeto.",
  freelancer_per_task: "Cada tarefa atribuída gera uma linha de custo. Valor pode variar por tipo de tarefa.",
  freelancer_per_hour: "Custo = horas apontadas × valor/hora.",
  one_off: "Você lança um pagamento manual quando quiser, sem cálculo automático.",
};

export function TeamCostFieldsEditor({ value, onChange }: { value: TeamCostFields; onChange: (v: TeamCostFields) => void }) {
  const { data: taskTypes = [] } = useQuery({
    queryKey: ["task-types-for-rates"],
    queryFn: async () => {
      const { data } = await supabase.from("task_types").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const patch = (p: Partial<TeamCostFields>) => onChange({ ...value, ...p });
  const mode = value.cost_mode;

  const overrideEntries = Object.entries(value.task_rate_overrides || {});

  return (
    <div className="space-y-3">
      <DialogField label="Modo de custo" hint={COST_MODE_HINT[mode]}>
        <Select value={mode} onValueChange={(v) => patch({ cost_mode: v as CostMode })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(COST_MODE_LABEL) as CostMode[]).map(k => (
              <SelectItem key={k} value={k}>{COST_MODE_LABEL[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DialogField>

      {mode === "internal_fixed" && (
        <div className="grid grid-cols-2 gap-3">
          <DialogField label="Salário mensal (R$)">
            <Input type="number" step="0.01" value={value.monthly_salary ?? ""}
              onChange={e => patch({ monthly_salary: e.target.value ? Number(e.target.value) : null })} />
          </DialogField>
          <DialogField label="Horas/mês" hint="Usado para custo/hora referencial.">
            <Input type="number" step="0.5" value={value.monthly_hours ?? ""}
              onChange={e => patch({ monthly_hours: e.target.value ? Number(e.target.value) : null })} />
          </DialogField>
        </div>
      )}

      {mode === "freelancer_per_hour" && (
        <DialogField label="Valor/hora (R$)">
          <Input type="number" step="0.01" value={value.hourly_rate ?? ""}
            onChange={e => patch({ hourly_rate: e.target.value ? Number(e.target.value) : null })} />
        </DialogField>
      )}

      {mode === "freelancer_per_task" && (
        <>
          <DialogField label="Valor padrão por tarefa (R$)">
            <Input type="number" step="0.01" value={value.default_task_rate ?? ""}
              onChange={e => patch({ default_task_rate: e.target.value ? Number(e.target.value) : null })} />
          </DialogField>
          <div>
            <Label className="text-xs">Valores por tipo de tarefa (opcional)</Label>
            <div className="space-y-2 mt-1.5">
              {overrideEntries.map(([ttId, rate]) => {
                const tt = taskTypes.find(t => t.id === ttId);
                return (
                  <div key={ttId} className="flex items-center gap-2">
                    <div className="flex-1 text-sm text-muted-foreground truncate">{tt?.name ?? "—"}</div>
                    <Input className="w-28" type="number" step="0.01" value={rate}
                      onChange={e => patch({ task_rate_overrides: { ...value.task_rate_overrides, [ttId]: Number(e.target.value) } })} />
                    <Button variant="ghost" size="icon" onClick={() => {
                      const next = { ...value.task_rate_overrides }; delete next[ttId];
                      patch({ task_rate_overrides: next });
                    }}><Trash2 className="size-4" /></Button>
                  </div>
                );
              })}
              <Select value="" onValueChange={(id) => {
                if (!id || value.task_rate_overrides[id] != null) return;
                patch({ task_rate_overrides: { ...value.task_rate_overrides, [id]: value.default_task_rate ?? 0 } });
              }}>
                <SelectTrigger className="h-8 text-xs"><Plus className="size-3 mr-1" /> Adicionar tipo com valor diferente</SelectTrigger>
                <SelectContent>
                  {taskTypes.filter(t => value.task_rate_overrides[t.id] == null).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </>
      )}

      {mode === "one_off" && (
        <div className="text-xs text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">
          Sem valores fixos. Ao atribuir esta pessoa a uma tarefa, você define o valor no momento.
        </div>
      )}
    </div>
  );
}

/** Calcula sugestão de custo ao atribuir a pessoa a uma task */
export function suggestTaskCost(member: {
  cost_mode: CostMode;
  hourly_rate: number | null;
  monthly_salary: number | null;
  monthly_hours: number | null;
  default_task_rate: number | null;
  task_rate_overrides: Record<string, number> | null;
}, ctx: { task_type_id: string | null; estimated_hours: number | null }): {
  amount: number;
  hours: number | null;
  kind: "per_task" | "per_hour" | "one_off" | "allocated_internal";
  hint: string;
} | null {
  if (!member) return null;
  const overrides = member.task_rate_overrides ?? {};
  switch (member.cost_mode) {
    case "freelancer_per_task": {
      const ov = ctx.task_type_id ? overrides[ctx.task_type_id] : undefined;
      const amount = ov ?? member.default_task_rate ?? 0;
      return { amount, hours: null, kind: "per_task", hint: ov != null ? "Valor específico do tipo de tarefa" : "Valor padrão por tarefa" };
    }
    case "freelancer_per_hour": {
      const rate = member.hourly_rate ?? 0;
      const hours = ctx.estimated_hours ?? 0;
      return { amount: rate * hours, hours, kind: "per_hour", hint: `${hours}h × R$ ${rate.toFixed(2)}/h` };
    }
    case "one_off": {
      return { amount: 0, hours: null, kind: "one_off", hint: "Pagamento avulso — defina o valor" };
    }
    case "internal_fixed": {
      const cph = member.monthly_salary && member.monthly_hours ? (member.monthly_salary / member.monthly_hours) : 0;
      const hours = ctx.estimated_hours ?? 0;
      return { amount: cph * hours, hours, kind: "allocated_internal", hint: `Alocação interna: ${hours}h × custo/hora R$ ${cph.toFixed(2)}` };
    }
  }
}
