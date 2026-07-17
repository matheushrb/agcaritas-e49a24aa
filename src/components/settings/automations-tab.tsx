import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Zap } from "lucide-react";
import {
  useAutomationSettings,
  useUpdateAutomationSettings,
  DEFAULT_AUTOMATION_SETTINGS,
  type AutomationSettings,
  type TaskPriority,
} from "@/lib/automation-settings";

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
  { value: "critical", label: "Crítica" },
];

export function AutomationsTab() {
  const { data, isLoading } = useAutomationSettings();
  const update = useUpdateAutomationSettings();
  const [draft, setDraft] = useState<AutomationSettings>(DEFAULT_AUTOMATION_SETTINGS);

  useEffect(() => {
    if (data?.settings) setDraft(data.settings);
  }, [data?.settings]);

  const patch = (p: Partial<AutomationSettings["overdueEscalate"]>) =>
    setDraft(d => ({ ...d, overdueEscalate: { ...d.overdueEscalate, ...p } }));

  if (isLoading) {
    return <Card className="rounded-2xl p-6 text-sm text-muted-foreground">Carregando…</Card>;
  }

  const oe = draft.overdueEscalate;
  const dirty = JSON.stringify(draft) !== JSON.stringify(data?.settings);

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-5 space-y-5">
        <header className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">Escalar prioridade quando a tarefa atrasar</div>
                <div className="text-sm text-muted-foreground">
                  Quando uma tarefa passar da data de entrega sem ter sido concluída, o sistema aumenta a prioridade dela automaticamente.
                </div>
              </div>
              <Switch
                checked={oe.enabled}
                onCheckedChange={v => patch({ enabled: v })}
              />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-13">
          <div className="space-y-1.5">
            <Label className="text-xs">Aplicar depois de</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number" min={0} step={1}
                disabled={!oe.enabled}
                value={oe.daysAfterDue}
                onChange={e => patch({ daysAfterDue: Math.max(0, Number(e.target.value || 0)) })}
                className="h-9 rounded-lg w-24"
              />
              <span className="text-sm text-muted-foreground">
                {oe.daysAfterDue === 0 ? "dias — assim que vencer" : oe.daysAfterDue === 1 ? "dia após o vencimento" : "dias após o vencimento"}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nova prioridade</Label>
            <Select
              value={oe.targetPriority}
              onValueChange={v => patch({ targetPriority: v as TaskPriority })}
              disabled={!oe.enabled}
            >
              <SelectTrigger className="h-9 rounded-lg w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl bg-muted/40 border border-dashed p-3 text-xs text-muted-foreground flex gap-2 items-start">
          <Zap className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
          <span>
            A prioridade original permanece salva. A escalada é exibida automaticamente no card, kanban e filtros enquanto a tarefa estiver atrasada — se você concluir ou reagendar, ela volta ao normal.
          </span>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="ghost"
            className="rounded-full"
            onClick={() => data?.settings && setDraft(data.settings)}
            disabled={!dirty || update.isPending}
          >
            Descartar
          </Button>
          <Button
            className="rounded-full"
            onClick={() => update.mutate(draft)}
            disabled={!dirty || update.isPending}
          >
            Salvar automações
          </Button>
        </div>
      </Card>

      <Card className="rounded-2xl p-5 text-sm text-muted-foreground">
        <div className="font-medium text-foreground mb-1">Em breve</div>
        Mais gatilhos: notificar responsável quando faltar X dias, mover etapa automaticamente ao aprovar, criar cobrança ao concluir entregável faturável.
      </Card>
    </div>
  );
}
