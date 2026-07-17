import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Wallet } from "lucide-react";
import { COST_MODE_LABEL, type CostMode } from "./team-cost-fields";

export type CostSuggestion = {
  amount: number;
  hours: number | null;
  kind: "per_task" | "per_hour" | "one_off" | "allocated_internal";
  hint: string;
};

export function CostConfirmDialog({
  open, onOpenChange, memberName, costMode, suggestion, onConfirm, onSkip,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  memberName: string;
  costMode: CostMode;
  suggestion: CostSuggestion;
  onConfirm: (v: { amount: number; hours: number | null; description: string }) => void;
  onSkip: () => void;
}) {
  const [amount, setAmount] = useState(suggestion.amount);
  const [hours, setHours] = useState<number | null>(suggestion.hours);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setAmount(suggestion.amount);
      setHours(suggestion.hours);
      setDescription("");
    }
  }, [open, suggestion.amount, suggestion.hours]);

  const isInternal = costMode === "internal_fixed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-full bg-primary/15 text-primary inline-flex items-center justify-center">
              <Wallet className="size-4" />
            </div>
            <div>
              <DialogTitle>Gerar custo para esta tarefa?</DialogTitle>
              <DialogDescription>
                {memberName} · {COST_MODE_LABEL[costMode]}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-xs text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">
            {suggestion.hint}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" value={amount}
                onChange={e => setAmount(Number(e.target.value))} disabled={isInternal} />
            </div>
            {suggestion.hours != null && (
              <div>
                <Label className="text-xs">Horas</Label>
                <Input type="number" step="0.25" value={hours ?? 0}
                  onChange={e => setHours(Number(e.target.value))} />
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea rows={2} placeholder="Ex.: pagamento na entrega, referente à peça X…"
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {isInternal && (
            <div className="text-[11px] text-muted-foreground">
              Colaborador interno não gera custo variável. O valor acima é uma alocação de referência para calcular rentabilidade do projeto.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onSkip}>Só atribuir, sem custo</Button>
          <Button onClick={() => onConfirm({ amount, hours, description })}>
            {isInternal ? "Registrar alocação" : "Gerar custo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
