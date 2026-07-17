import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, Plus, Trash2 } from "lucide-react";

type Role = { id: string; label: string; hourlyRate: number; hours: number };

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const DEFAULT_ROLES: Role[] = [
  { id: crypto.randomUUID(), label: "Direção / Roteiro", hourlyRate: 120, hours: 2 },
  { id: crypto.randomUUID(), label: "Captação",         hourlyRate: 150, hours: 4 },
  { id: crypto.randomUUID(), label: "Edição",           hourlyRate: 100, hours: 6 },
];

export function PriceCalculatorButton({
  onApply,
}: {
  onApply: (price: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES);
  const [materials, setMaterials] = useState<number>(0);
  const [thirdParty, setThirdParty] = useState<number>(0);
  const [overheadPct, setOverheadPct] = useState<number>(15);
  const [marginPct, setMarginPct] = useState<number>(30);
  const [taxPct, setTaxPct] = useState<number>(6);

  const totals = useMemo(() => {
    const labor = roles.reduce((s, r) => s + (r.hourlyRate || 0) * (r.hours || 0), 0);
    const directCosts = labor + (materials || 0) + (thirdParty || 0);
    const overhead = directCosts * (overheadPct / 100);
    const subtotal = directCosts + overhead;
    const withMargin = subtotal / Math.max(0.01, 1 - marginPct / 100);
    const finalPrice = withMargin / Math.max(0.01, 1 - taxPct / 100);
    return { labor, directCosts, overhead, subtotal, withMargin, finalPrice };
  }, [roles, materials, thirdParty, overheadPct, marginPct, taxPct]);

  const updateRole = (id: string, patch: Partial<Role>) =>
    setRoles(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-full gap-1 h-9"
        onClick={() => setOpen(true)}
      >
        <Calculator className="h-3.5 w-3.5" /> Calculadora
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-2xl">
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Calculadora de preço
          </DialogTitle>
          <p className="text-xs text-muted-foreground -mt-1">
            Some as horas por função, custos diretos e aplique margem e impostos para chegar no preço final.
          </p>

          {/* Roles */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mão de obra</Label>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full h-7 gap-1 text-xs"
                onClick={() =>
                  setRoles(rs => [
                    ...rs,
                    { id: crypto.randomUUID(), label: "Nova função", hourlyRate: 100, hours: 1 },
                  ])
                }
              >
                <Plus className="h-3 w-3" /> Adicionar função
              </Button>
            </div>
            <div className="rounded-xl border divide-y">
              <div className="grid grid-cols-[1fr_120px_90px_110px_36px] gap-2 px-3 py-2 text-[11px] text-muted-foreground">
                <div>Função</div>
                <div>R$ / hora</div>
                <div>Horas</div>
                <div className="text-right">Subtotal</div>
                <div />
              </div>
              {roles.map(r => (
                <div key={r.id} className="grid grid-cols-[1fr_120px_90px_110px_36px] gap-2 px-3 py-2 items-center">
                  <Input
                    value={r.label}
                    onChange={e => updateRole(r.id, { label: e.target.value })}
                    className="h-8 rounded-md"
                  />
                  <Input
                    type="number" min={0} step={1}
                    value={r.hourlyRate}
                    onChange={e => updateRole(r.id, { hourlyRate: Number(e.target.value) })}
                    className="h-8 rounded-md"
                  />
                  <Input
                    type="number" min={0} step={0.5}
                    value={r.hours}
                    onChange={e => updateRole(r.id, { hours: Number(e.target.value) })}
                    className="h-8 rounded-md"
                  />
                  <div className="text-right text-sm tabular-nums">
                    {BRL((r.hourlyRate || 0) * (r.hours || 0))}
                  </div>
                  <button
                    onClick={() => setRoles(rs => rs.filter(x => x.id !== r.id))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Costs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Materiais / equipamentos (R$)</Label>
              <Input type="number" min={0} step={0.01} value={materials}
                onChange={e => setMaterials(Number(e.target.value))} className="h-9 rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Terceiros / freelas (R$)</Label>
              <Input type="number" min={0} step={0.01} value={thirdParty}
                onChange={e => setThirdParty(Number(e.target.value))} className="h-9 rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Overhead (%)</Label>
              <Input type="number" min={0} step={1} value={overheadPct}
                onChange={e => setOverheadPct(Number(e.target.value))} className="h-9 rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Margem de lucro (%)</Label>
              <Input type="number" min={0} step={1} value={marginPct}
                onChange={e => setMarginPct(Number(e.target.value))} className="h-9 rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Impostos (%)</Label>
              <Input type="number" min={0} step={0.1} value={taxPct}
                onChange={e => setTaxPct(Number(e.target.value))} className="h-9 rounded-lg" />
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-muted/40 p-3 space-y-1 text-sm">
            <Row label="Mão de obra" value={BRL(totals.labor)} />
            <Row label="Custos diretos" value={BRL(totals.directCosts)} />
            <Row label={`Overhead (${overheadPct}%)`} value={BRL(totals.overhead)} />
            <Row label="Subtotal" value={BRL(totals.subtotal)} />
            <Row label={`Com margem (${marginPct}%)`} value={BRL(totals.withMargin)} />
            <div className="pt-2 mt-1 border-t flex items-center justify-between">
              <span className="text-sm font-medium">Preço sugerido</span>
              <span className="text-lg font-semibold tabular-nums">{BRL(totals.finalPrice)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button
              className="rounded-full"
              onClick={() => {
                onApply(Number(totals.finalPrice.toFixed(2)));
                setOpen(false);
              }}
            >
              Usar como preço padrão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}
