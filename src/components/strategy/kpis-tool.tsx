import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import "@/windows.css";

const sb = supabase as any;

export type Kpi = {
  id: string;
  plan_id: string;
  name: string;
  target_value: number | null;
  current_value: number;
  unit: string | null;
  category: string | null;
  period: string | null;
};

const emptyForm = { name: "", target_value: "", unit: "", category: "", period: "" };

export function KpisTool({ planId }: { planId: string }) {
  const qc = useQueryClient();
  const key = ["strategic_kpis", planId];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data: kpis = [] } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Kpi[]> => {
      const { data, error } = await sb
        .from("strategic_kpis")
        .select("*")
        .eq("plan_id", planId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Kpi[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const createKpi = useMutation({
    mutationFn: async () => {
      const { data: profile } = await sb.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await sb.from("strategic_kpis").insert({
        organization_id: profile.organization_id,
        plan_id: planId,
        name: form.name.trim(),
        target_value: form.target_value ? Number(form.target_value) : null,
        unit: form.unit.trim() || null,
        category: form.category.trim() || null,
        period: form.period.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("KPI criado");
      setForm({ ...emptyForm });
      setShowForm(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar KPI"),
  });

  const updateKpi = useMutation({
    mutationFn: async ({ id, current_value }: { id: string; current_value: number }) => {
      const { error } = await sb.from("strategic_kpis").update({ current_value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Valor atualizado");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const removeKpi = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("strategic_kpis").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  return (
    <div className="cw space-y-3">
      <div className="flex items-center justify-between">
        <span className="cw-label">Indicadores (KPIs)</span>
        <button className="cw-btn cw-btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? "Cancelar" : "+ Novo KPI"}
        </button>
      </div>

      {showForm && (
        <div className="cw-card cw-card-pad space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="cw-field">
              <label className="cw-label">Nome</label>
              <input className="cw-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Valor alvo</label>
              <input type="number" className="cw-input" value={form.target_value} onChange={e => setForm({ ...form, target_value: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Unidade</label>
              <input className="cw-input" placeholder="%, R$, seguidores" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Categoria</label>
              <input className="cw-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Período</label>
              <input className="cw-input" placeholder="Mensal / 2026-Q1" value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="cw-btn cw-btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            <button
              className="cw-btn cw-btn-primary"
              disabled={!form.name.trim() || createKpi.isPending}
              onClick={() => createKpi.mutate()}
            >
              Criar
            </button>
          </div>
        </div>
      )}

      {kpis.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">Nenhum KPI ainda.</p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {kpis.map(k => {
          const target = Number(k.target_value ?? 0);
          const pct = target > 0 ? Math.min(100, Math.round((Number(k.current_value) / target) * 100)) : 0;
          return (
            <div key={k.id} className="cw-card cw-card-pad space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{k.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {Number(k.current_value)}{k.unit ? ` ${k.unit}` : ""}
                    {target > 0 ? ` de ${target}${k.unit ? ` ${k.unit}` : ""}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {k.category && <span className="cw-chip is-neutral">{k.category}</span>}
                  {k.period && <span className="cw-chip is-neutral">{k.period}</span>}
                  <button className="cw-btn cw-btn-secondary" onClick={() => removeKpi.mutate(k.id)}>×</button>
                </div>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{pct}%</p>

              <div className="flex items-end gap-2">
                <div className="cw-field flex-1">
                  <label className="cw-label">Valor atual</label>
                  <input
                    type="number"
                    className="cw-input"
                    value={drafts[k.id] ?? String(k.current_value)}
                    onChange={e => setDrafts({ ...drafts, [k.id]: e.target.value })}
                  />
                </div>
                <button
                  className="cw-btn cw-btn-primary"
                  onClick={() => updateKpi.mutate({ id: k.id, current_value: Number(drafts[k.id] ?? k.current_value) || 0 })}
                >
                  Salvar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
