import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import "@/windows.css";

const sb = supabase as any;

export type SwotItem = {
  id: string;
  plan_id: string;
  quadrant: string;
  description: string;
  position: number;
};

const QUADRANTS = [
  { key: "strengths", label: "Forças" },
  { key: "weaknesses", label: "Fraquezas" },
  { key: "opportunities", label: "Oportunidades" },
  { key: "threats", label: "Ameaças" },
];

export function SwotBoard({ planId }: { planId: string }) {
  const qc = useQueryClient();
  const key = ["strategic_swot_items", planId];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data: items = [] } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<SwotItem[]> => {
      const { data, error } = await sb
        .from("strategic_swot_items")
        .select("*")
        .eq("plan_id", planId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SwotItem[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const addItem = useMutation({
    mutationFn: async ({ quadrant, description, position }: { quadrant: string; description: string; position: number }) => {
      const { data: profile } = await sb.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await sb.from("strategic_swot_items").insert({
        organization_id: profile.organization_id,
        plan_id: planId,
        quadrant,
        description,
        position,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Erro ao adicionar item"),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string }) => {
      const { error } = await sb.from("strategic_swot_items").update({ description }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("strategic_swot_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  return (
    <div className="cw grid gap-3 md:grid-cols-2">
      {QUADRANTS.map(q => {
        const list = items.filter(i => i.quadrant === q.key);
        return (
          <div key={q.key} className="cw-card cw-card-pad space-y-2">
            <div className="flex items-center justify-between">
              <span className="cw-label">{q.label}</span>
              <span className="cw-chip is-neutral">{list.length}</span>
            </div>

            {list.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum item ainda.</p>
            )}

            {list.map(item => (
              <div key={item.id} className="flex items-center gap-2">
                {editingId === item.id ? (
                  <input
                    autoFocus
                    className="cw-input flex-1"
                    defaultValue={item.description}
                    onBlur={e => {
                      const v = e.target.value.trim();
                      setEditingId(null);
                      if (v && v !== item.description) updateItem.mutate({ id: item.id, description: v });
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="flex-1 text-left text-sm"
                    onClick={() => setEditingId(item.id)}
                  >
                    {item.description}
                  </button>
                )}
                <button
                  className="cw-btn cw-btn-secondary"
                  onClick={() => removeItem.mutate(item.id)}
                  aria-label="Remover"
                >
                  ×
                </button>
              </div>
            ))}

            <input
              className="cw-input"
              placeholder="Adicionar item…"
              value={drafts[q.key] ?? ""}
              onChange={e => setDrafts({ ...drafts, [q.key]: e.target.value })}
              onKeyDown={e => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                const v = (drafts[q.key] ?? "").trim();
                if (!v) return;
                addItem.mutate({ quadrant: q.key, description: v, position: list.length });
                setDrafts({ ...drafts, [q.key]: "" });
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
