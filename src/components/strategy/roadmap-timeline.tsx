import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import "@/windows.css";

const sb = supabase as any;

export type RoadmapItem = {
  id: string;
  plan_id: string;
  title: string;
  description: string | null;
  target_quarter: string | null;
  category: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  position: number;
};

const STATUS_CYCLE: Record<string, string> = { planned: "in_progress", in_progress: "done", done: "planned" };
const STATUS_LABEL: Record<string, string> = { planned: "Planejado", in_progress: "Em andamento", done: "Concluído" };

const emptyForm = {
  title: "",
  description: "",
  target_quarter: "",
  category: "",
  start_date: "",
  end_date: "",
};

const fmt = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : null);

export function RoadmapTimeline({ planId }: { planId: string }) {
  const qc = useQueryClient();
  const key = ["strategic_roadmap_items", planId];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: items = [] } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<RoadmapItem[]> => {
      const { data, error } = await sb
        .from("strategic_roadmap_items")
        .select("*")
        .eq("plan_id", planId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RoadmapItem[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const createItem = useMutation({
    mutationFn: async () => {
      const { data: profile } = await sb.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await sb.from("strategic_roadmap_items").insert({
        organization_id: profile.organization_id,
        plan_id: planId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        target_quarter: form.target_quarter.trim() || null,
        category: form.category.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        position: items.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Iniciativa criada");
      setForm({ ...emptyForm });
      setShowForm(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar iniciativa"),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, any> }) => {
      const { error } = await sb.from("strategic_roadmap_items").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("strategic_roadmap_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  const groups = Array.from(
    items.reduce((map, item) => {
      const k = item.target_quarter?.trim() || "";
      const arr = map.get(k) ?? [];
      arr.push(item);
      map.set(k, arr);
      return map;
    }, new Map<string, RoadmapItem[]>()),
  ).sort((a, b) => (a[0] === "" ? 1 : b[0] === "" ? -1 : a[0].localeCompare(b[0])));

  return (
    <div className="cw space-y-3">
      <div className="flex items-center justify-between">
        <span className="cw-label">Roadmap</span>
        <button className="cw-btn cw-btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? "Cancelar" : "+ Nova iniciativa"}
        </button>
      </div>

      {showForm && (
        <div className="cw-card cw-card-pad space-y-3">
          <div className="cw-field">
            <label className="cw-label">Título</label>
            <input className="cw-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="cw-field">
            <label className="cw-label">Descrição</label>
            <textarea className="cw-textarea" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="cw-field">
              <label className="cw-label">Trimestre</label>
              <input className="cw-input" placeholder="2026-Q1" value={form.target_quarter} onChange={e => setForm({ ...form, target_quarter: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Categoria</label>
              <input className="cw-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Data início</label>
              <input type="date" className="cw-input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Data fim</label>
              <input type="date" className="cw-input" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="cw-btn cw-btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            <button
              className="cw-btn cw-btn-primary"
              disabled={!form.title.trim() || createItem.isPending}
              onClick={() => createItem.mutate()}
            >
              Criar
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">Nenhuma iniciativa ainda.</p>
      )}

      {groups.map(([quarter, list]) => (
        <div key={quarter || "none"} className="space-y-2">
          <span className="cw-label">{quarter || "Sem trimestre"}</span>
          {list.map(item => (
            <div key={item.id} className="cw-card cw-card-pad space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                  {(item.start_date || item.end_date) && (
                    <p className="text-xs text-muted-foreground">
                      {[fmt(item.start_date), fmt(item.end_date)].filter(Boolean).join(" → ")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {item.category && <span className="cw-chip is-neutral">{item.category}</span>}
                  <button
                    type="button"
                    className={`cw-chip${item.status === "done" ? " is-green" : ""}`}
                    onClick={() => updateItem.mutate({ id: item.id, values: { status: STATUS_CYCLE[item.status] ?? "planned" } })}
                  >
                    {STATUS_LABEL[item.status] ?? item.status}
                  </button>
                  <button className="cw-btn cw-btn-secondary" onClick={() => removeItem.mutate(item.id)}>×</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
