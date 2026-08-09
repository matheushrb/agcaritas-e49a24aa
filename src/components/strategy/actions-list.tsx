import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import "@/windows.css";

const sb = supabase as any;

export type StrategicAction = {
  id: string;
  plan_id: string;
  title: string;
  responsible: string | null;
  due_date: string | null;
  status: string;
  notes: string | null;
  position: number;
};

const STATUS_CYCLE: Record<string, string> = { todo: "doing", doing: "done", done: "todo" };
const STATUS_LABEL: Record<string, string> = { todo: "A fazer", doing: "Em andamento", done: "Concluída" };

export function ActionsList({ planId }: { planId: string }) {
  const qc = useQueryClient();
  const key = ["strategic_actions", planId];
  const [form, setForm] = useState({ title: "", responsible: "", due_date: "" });

  const { data: actions = [] } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<StrategicAction[]> => {
      const { data, error } = await sb
        .from("strategic_actions")
        .select("*")
        .eq("plan_id", planId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as StrategicAction[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const createAction = useMutation({
    mutationFn: async () => {
      const { data: profile } = await sb.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await sb.from("strategic_actions").insert({
        organization_id: profile.organization_id,
        plan_id: planId,
        title: form.title.trim(),
        responsible: form.responsible.trim() || null,
        due_date: form.due_date || null,
        position: actions.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setForm({ title: "", responsible: "", due_date: "" });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar ação"),
  });

  const updateAction = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, any> }) => {
      const { error } = await sb.from("strategic_actions").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const removeAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("strategic_actions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  return (
    <div className="cw space-y-3">
      <span className="cw-label">Plano de ações</span>

      {actions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma ação ainda.</p>}

      {actions.map(a => (
        <div key={a.id} className="cw-card cw-card-pad flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{a.title}</p>
            <p className="text-xs text-muted-foreground">
              {[a.responsible, a.due_date ? new Date(a.due_date + "T00:00:00").toLocaleDateString("pt-BR") : null]
                .filter(Boolean)
                .join(" · ") || "Sem responsável"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`cw-chip${a.status === "done" ? " is-green" : ""}`}
              onClick={() => updateAction.mutate({ id: a.id, values: { status: STATUS_CYCLE[a.status] ?? "todo" } })}
            >
              {STATUS_LABEL[a.status] ?? a.status}
            </button>
            <button className="cw-btn cw-btn-secondary" onClick={() => removeAction.mutate(a.id)}>×</button>
          </div>
        </div>
      ))}

      <div className="cw-card cw-card-pad space-y-3">
        <span className="cw-label">+ Nova ação</span>
        <div className="grid grid-cols-3 gap-3">
          <div className="cw-field">
            <label className="cw-label">Título</label>
            <input className="cw-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="cw-field">
            <label className="cw-label">Responsável</label>
            <input className="cw-input" value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} />
          </div>
          <div className="cw-field">
            <label className="cw-label">Prazo</label>
            <input type="date" className="cw-input" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            className="cw-btn cw-btn-primary"
            disabled={!form.title.trim() || createAction.isPending}
            onClick={() => createAction.mutate()}
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}
