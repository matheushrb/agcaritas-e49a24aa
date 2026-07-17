import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Calculator, Info } from "lucide-react";
import { toast } from "sonner";

/* ---------- Modelo ----------
Custo/hora = (Custos fixos mensais + Custos variáveis mensais) / Horas faturáveis por mês
Preço sugerido/hora = Custo/hora ÷ (1 − margem) ÷ (1 − impostos)
Guardado em organizations.pricing_settings (jsonb).
------------------------------ */

export type CostLine = { id: string; label: string; amount: number };
export type PricingSettings = {
  fixed_costs: CostLine[];       // aluguel, salários, softwares…
  variable_costs: CostLine[];    // tráfego, comissões médias, freelas médios…
  billable_hours_month: number;  // ex.: 120
  profit_margin_pct: number;     // ex.: 30
  tax_pct: number;               // ex.: 6
};

const EMPTY: PricingSettings = {
  fixed_costs: [],
  variable_costs: [],
  billable_hours_month: 120,
  profit_margin_pct: 30,
  tax_pct: 6,
};

const BRL = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function computeAgencyRate(s: PricingSettings) {
  const fixed = s.fixed_costs.reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const variable = s.variable_costs.reduce((a, c) => a + (Number(c.amount) || 0), 0);
  const totalMonthly = fixed + variable;
  const hours = Math.max(1, Number(s.billable_hours_month) || 0);
  const costPerHour = totalMonthly / hours;
  const margin = Math.min(0.99, Math.max(0, (s.profit_margin_pct || 0) / 100));
  const tax = Math.min(0.99, Math.max(0, (s.tax_pct || 0) / 100));
  const withMargin = costPerHour / (1 - margin);
  const suggested = withMargin / (1 - tax);
  return { fixed, variable, totalMonthly, hours, costPerHour, withMargin, suggested };
}

export function useAgencyPricing() {
  return useQuery({
    queryKey: ["agency-pricing"],
    queryFn: async (): Promise<PricingSettings> => {
      const { data: p } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!p?.organization_id) return EMPTY;
      const { data } = await supabase
        .from("organizations")
        .select("pricing_settings")
        .eq("id", p.organization_id)
        .maybeSingle();
      const raw = (data?.pricing_settings ?? {}) as Partial<PricingSettings>;
      return { ...EMPTY, ...raw, fixed_costs: raw.fixed_costs ?? [], variable_costs: raw.variable_costs ?? [] };
    },
  });
}

export function AgencyPricingTab() {
  const qc = useQueryClient();
  const { data } = useAgencyPricing();
  const [state, setState] = useState<PricingSettings>(EMPTY);

  useEffect(() => { if (data) setState(data); }, [data]);

  const totals = useMemo(() => computeAgencyRate(state), [state]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: p } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!p?.organization_id) throw new Error("Organização não encontrada");
      const { error } = await supabase
        .from("organizations")
        .update({ pricing_settings: state as any })
        .eq("id", p.organization_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Precificação atualizada");
      qc.invalidateQueries({ queryKey: ["agency-pricing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addLine = (key: "fixed_costs" | "variable_costs") =>
    setState(s => ({ ...s, [key]: [...s[key], { id: crypto.randomUUID(), label: "Nova despesa", amount: 0 }] }));

  const updateLine = (key: "fixed_costs" | "variable_costs", id: string, patch: Partial<CostLine>) =>
    setState(s => ({ ...s, [key]: s[key].map(l => l.id === id ? { ...l, ...patch } : l) }));

  const removeLine = (key: "fixed_costs" | "variable_costs", id: string) =>
    setState(s => ({ ...s, [key]: s[key].filter(l => l.id !== id) }));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Card className="rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-2">
            <Calculator className="h-4 w-4 mt-0.5 text-primary" />
            <div>
              <div className="text-sm font-medium">Precificação da agência</div>
              <p className="text-xs text-muted-foreground">
                Some os custos mensais da operação inteira, defina quantas horas você consegue faturar por mês
                e a agência calcula quanto vale a sua hora. Cada tipo de tarefa pode usar isso como sugestão — o
                valor real da task pode ser sobrescrito manualmente.
              </p>
            </div>
          </div>

          <CostSection
            title="Custos fixos mensais"
            hint="Aluguel, salários fixos, softwares, contabilidade, internet…"
            items={state.fixed_costs}
            onAdd={() => addLine("fixed_costs")}
            onChange={(id, patch) => updateLine("fixed_costs", id, patch)}
            onRemove={id => removeLine("fixed_costs", id)}
          />

          <CostSection
            title="Custos variáveis mensais"
            hint="Média mensal de freelas, tráfego pago recorrente, comissões, materiais recorrentes…"
            items={state.variable_costs}
            onAdd={() => addLine("variable_costs")}
            onChange={(id, patch) => updateLine("variable_costs", id, patch)}
            onRemove={id => removeLine("variable_costs", id)}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Horas faturáveis por mês" hint="Horas realmente cobráveis do time, descontando reuniões, admin, folgas.">
              <Input
                type="number" min={1} step={1}
                value={state.billable_hours_month}
                onChange={e => setState(s => ({ ...s, billable_hours_month: Number(e.target.value) }))}
                className="h-9 rounded-lg"
              />
            </Field>
            <Field label="Margem de lucro (%)" hint="Lucro esperado sobre o custo.">
              <Input
                type="number" min={0} max={95} step={1}
                value={state.profit_margin_pct}
                onChange={e => setState(s => ({ ...s, profit_margin_pct: Number(e.target.value) }))}
                className="h-9 rounded-lg"
              />
            </Field>
            <Field label="Impostos (%)" hint="Simples, ISS, etc. incidentes sobre o faturamento.">
              <Input
                type="number" min={0} max={95} step={0.1}
                value={state.tax_pct}
                onChange={e => setState(s => ({ ...s, tax_pct: Number(e.target.value) }))}
                className="h-9 rounded-lg"
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button className="rounded-full" onClick={() => save.mutate()} disabled={save.isPending}>
              Salvar precificação
            </Button>
          </div>
        </Card>
      </div>

      <Card className="rounded-2xl p-5 space-y-3 h-fit lg:sticky lg:top-4">
        <div className="text-sm font-medium">Resumo</div>
        <SummaryRow label="Custos fixos" value={BRL(totals.fixed)} />
        <SummaryRow label="Custos variáveis" value={BRL(totals.variable)} />
        <SummaryRow label="Total mensal" value={BRL(totals.totalMonthly)} strong />
        <div className="h-px bg-border" />
        <SummaryRow label="Custo por hora" value={BRL(totals.costPerHour)} />
        <SummaryRow label={`Com margem (${state.profit_margin_pct}%)`} value={BRL(totals.withMargin)} />
        <div className="pt-2 mt-1 rounded-xl bg-primary/10 px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-medium text-primary">Hora sugerida</span>
          <span className="text-lg font-semibold tabular-nums">{BRL(totals.suggested)}</span>
        </div>
        <p className="text-[11px] text-muted-foreground flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          Usado para sugerir o preço padrão dos tipos de tarefa. O valor pode ser ajustado manualmente em cada tarefa.
        </p>
      </Card>
    </div>
  );
}

function CostSection(props: {
  title: string; hint: string; items: CostLine[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<CostLine>) => void;
  onRemove: (id: string) => void;
}) {
  const total = props.items.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold">{props.title}</div>
          <p className="text-[11px] text-muted-foreground">{props.hint}</p>
        </div>
        <Button size="sm" variant="ghost" className="rounded-full h-7 gap-1 text-xs" onClick={props.onAdd}>
          <Plus className="h-3 w-3" /> Adicionar
        </Button>
      </div>
      <div className="rounded-xl border divide-y">
        {props.items.length === 0 && (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center">Nenhuma linha ainda.</div>
        )}
        {props.items.map(l => (
          <div key={l.id} className="grid grid-cols-[1fr_140px_36px] gap-2 px-3 py-2 items-center">
            <Input
              value={l.label}
              onChange={e => props.onChange(l.id, { label: e.target.value })}
              className="h-8 rounded-md"
            />
            <Input
              type="number" min={0} step={0.01}
              value={l.amount}
              onChange={e => props.onChange(l.id, { amount: Number(e.target.value) })}
              className="h-8 rounded-md text-right"
            />
            <button
              onClick={() => props.onRemove(l.id)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Remover"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {props.items.length > 0 && (
          <div className="px-3 py-2 text-xs flex items-center justify-between bg-muted/30">
            <span className="text-muted-foreground">Total</span>
            <span className="font-medium tabular-nums">{BRL(total)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-muted-foreground leading-tight">{hint}</p>}
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold tabular-nums" : "tabular-nums"}>{value}</span>
    </div>
  );
}
