import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import "@/windows.css";

const sb = supabase as any;

export type Persona = {
  id: string;
  plan_id: string;
  name: string;
  age_range: string | null;
  gender: string | null;
  location: string | null;
  occupation: string | null;
  fictional_quote: string | null;
  bio: string | null;
  goals: string[];
  pains: string[];
  motivations: string[];
  preferred_channels: string[];
};

const emptyForm = {
  name: "",
  age_range: "",
  gender: "",
  location: "",
  occupation: "",
  fictional_quote: "",
  bio: "",
  goals: "",
  pains: "",
  motivations: "",
  preferred_channels: "",
};

const toArr = (v: string) => v.split(",").map(s => s.trim()).filter(Boolean);

export function PersonasBoard({ planId }: { planId: string }) {
  const qc = useQueryClient();
  const key = ["strategic_personas", planId];
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: personas = [] } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Persona[]> => {
      const { data, error } = await sb
        .from("strategic_personas")
        .select("*")
        .eq("plan_id", planId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Persona[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const createPersona = useMutation({
    mutationFn: async () => {
      const { data: profile } = await sb.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await sb.from("strategic_personas").insert({
        organization_id: profile.organization_id,
        plan_id: planId,
        name: form.name.trim(),
        age_range: form.age_range.trim() || null,
        gender: form.gender.trim() || null,
        location: form.location.trim() || null,
        occupation: form.occupation.trim() || null,
        fictional_quote: form.fictional_quote.trim() || null,
        bio: form.bio.trim() || null,
        goals: toArr(form.goals),
        pains: toArr(form.pains),
        motivations: toArr(form.motivations),
        preferred_channels: toArr(form.preferred_channels),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Persona criada");
      setForm({ ...emptyForm });
      setShowForm(false);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar persona"),
  });

  const removePersona = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("strategic_personas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  return (
    <div className="cw space-y-3">
      <div className="flex items-center justify-between">
        <span className="cw-label">Personas</span>
        <button className="cw-btn cw-btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? "Cancelar" : "+ Nova persona"}
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
              <label className="cw-label">Faixa etária</label>
              <input className="cw-input" placeholder="25-34" value={form.age_range} onChange={e => setForm({ ...form, age_range: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Gênero</label>
              <input className="cw-input" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Localização</label>
              <input className="cw-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Ocupação</label>
              <input className="cw-input" value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Frase fictícia</label>
              <input className="cw-input" value={form.fictional_quote} onChange={e => setForm({ ...form, fictional_quote: e.target.value })} />
            </div>
          </div>
          <div className="cw-field">
            <label className="cw-label">Bio</label>
            <textarea className="cw-textarea" rows={3} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="cw-field">
              <label className="cw-label">Objetivos (separados por vírgula)</label>
              <input className="cw-input" value={form.goals} onChange={e => setForm({ ...form, goals: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Dores (separadas por vírgula)</label>
              <input className="cw-input" value={form.pains} onChange={e => setForm({ ...form, pains: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Motivações (separadas por vírgula)</label>
              <input className="cw-input" value={form.motivations} onChange={e => setForm({ ...form, motivations: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Canais preferidos (separados por vírgula)</label>
              <input className="cw-input" value={form.preferred_channels} onChange={e => setForm({ ...form, preferred_channels: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="cw-btn cw-btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            <button
              className="cw-btn cw-btn-primary"
              disabled={!form.name.trim() || createPersona.isPending}
              onClick={() => createPersona.mutate()}
            >
              Criar
            </button>
          </div>
        </div>
      )}

      {personas.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">Nenhuma persona ainda.</p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {personas.map(p => (
          <div key={p.id} className="cw-card cw-card-pad space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[p.age_range, p.occupation, p.location].filter(Boolean).join(" · ")}
                </p>
              </div>
              <button className="cw-btn cw-btn-secondary" onClick={() => removePersona.mutate(p.id)}>×</button>
            </div>
            {p.fictional_quote && <p className="text-sm italic">“{p.fictional_quote}”</p>}
            {p.bio && <p className="text-xs text-muted-foreground">{p.bio}</p>}
            {[
              { label: "Objetivos", list: p.goals },
              { label: "Dores", list: p.pains },
              { label: "Motivações", list: p.motivations },
              { label: "Canais", list: p.preferred_channels },
            ].map(g =>
              (g.list ?? []).length ? (
                <div key={g.label} className="space-y-1">
                  <span className="cw-label">{g.label}</span>
                  <div className="flex flex-wrap gap-2">
                    {g.list.map((v, i) => <span key={`${g.label}-${i}`} className="cw-chip is-neutral">{v}</span>)}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
