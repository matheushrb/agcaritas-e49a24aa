import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BookOpen, Pencil, LayoutGrid, Users, Filter, ListChecks,
  ThumbsUp, ThumbsDown, ArrowUpCircle, AlertOctagon, Check, Calendar,
  Plus, X,
} from "lucide-react";
import { toast } from "sonner";
import "@/prj05.css";

const initials = (n: string) =>
  n.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

const QUADRANTS = [
  { key: "strength", title: "Forças", color: "#10B981", icon: ThumbsUp },
  { key: "weakness", title: "Fraquezas", color: "#F59E0B", icon: ThumbsDown },
  { key: "opportunity", title: "Oportunidades", color: "#2F6BEF", icon: ArrowUpCircle },
  { key: "threat", title: "Ameaças", color: "#EF4444", icon: AlertOctagon },
] as const;

type Swot = { id: string; quadrant: string; content: string; position: number };
type Persona = { id: string; name: string; role: string | null; age: number | null; pains: unknown; desires: unknown; channels: unknown };
type Bench = { id: string; name: string; url: string | null; strengths: string | null; weaknesses: string | null; notes: string | null };
type Action = { id: string; title: string; description: string | null; due_date: string | null; status: string; order_index: number };

const asList = (v: unknown): string[] =>
  Array.isArray(v) ? (v as unknown[]).map(String) : typeof v === "string" && v.trim() ? [v] : [];

const dt = (s: string | null) =>
  s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "Sem prazo";

export function Prj05Strategy({
  projectId,
  organizationId,
  description,
  onSaveDescription,
}: {
  projectId: string;
  organizationId: string;
  description: string;
  onSaveDescription?: (d: string) => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description);

  const invalidate = (k: string) => qc.invalidateQueries({ queryKey: [k, projectId] });

  const { data: swot = [] } = useQuery<Swot[]>({
    queryKey: ["p5-swot", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_swot")
        .select("id,quadrant,content,position").eq("project_id", projectId).order("position");
      if (error) throw error;
      return (data ?? []) as Swot[];
    },
  });

  const { data: personas = [] } = useQuery<Persona[]>({
    queryKey: ["p5-personas", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_personas")
        .select("id,name,role,age,pains,desires,channels").eq("project_id", projectId).order("created_at");
      if (error) throw error;
      return (data ?? []) as Persona[];
    },
  });

  const { data: benchmarks = [] } = useQuery<Bench[]>({
    queryKey: ["p5-bench", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_benchmarks")
        .select("id,name,url,strengths,weaknesses,notes").eq("project_id", projectId).order("created_at");
      if (error) throw error;
      return (data ?? []) as Bench[];
    },
  });

  const { data: actions = [] } = useQuery<Action[]>({
    queryKey: ["p5-actions", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_action_items")
        .select("id,title,description,due_date,status,order_index").eq("project_id", projectId).order("order_index");
      if (error) throw error;
      return (data ?? []) as Action[];
    },
  });

  const addSwot = useMutation({
    mutationFn: async ({ quadrant, content }: { quadrant: string; content: string }) => {
      const position = swot.filter(s => s.quadrant === quadrant).length;
      const { error } = await supabase.from("project_swot")
        .insert({ project_id: projectId, organization_id: organizationId, quadrant, content, position });
      if (error) throw error;
    },
    onSuccess: () => invalidate("p5-swot"),
    onError: (e: Error) => toast.error(e.message),
  });
  const delSwot = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("project_swot").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => invalidate("p5-swot"),
  });

  const addPersona = useMutation({
    mutationFn: async (p: { name: string; role: string }) => {
      const { error } = await supabase.from("project_personas")
        .insert({ project_id: projectId, organization_id: organizationId, name: p.name, role: p.role || null });
      if (error) throw error;
    },
    onSuccess: () => invalidate("p5-personas"),
    onError: (e: Error) => toast.error(e.message),
  });
  const delPersona = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("project_personas").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => invalidate("p5-personas"),
  });

  const addBench = useMutation({
    mutationFn: async (b: { name: string; url: string }) => {
      const { error } = await supabase.from("project_benchmarks")
        .insert({ project_id: projectId, organization_id: organizationId, name: b.name, url: b.url || null });
      if (error) throw error;
    },
    onSuccess: () => invalidate("p5-bench"),
    onError: (e: Error) => toast.error(e.message),
  });
  const delBench = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("project_benchmarks").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => invalidate("p5-bench"),
  });

  const addAction = useMutation({
    mutationFn: async (a: { title: string; due_date: string }) => {
      const { error } = await supabase.from("project_action_items").insert({
        project_id: projectId, organization_id: organizationId,
        title: a.title, due_date: a.due_date || null, status: "todo", order_index: actions.length,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate("p5-actions"),
    onError: (e: Error) => toast.error(e.message),
  });
  const toggleAction = useMutation({
    mutationFn: async (a: Action) => {
      const { error } = await supabase.from("project_action_items")
        .update({ status: a.status === "done" ? "todo" : "done" }).eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => invalidate("p5-actions"),
  });
  const delAction = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("project_action_items").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => invalidate("p5-actions"),
  });

  return (
    <div className="prj05">
      <div className="p5-grid">
        {/* 1. Briefing */}
        <section className="p5-card">
          <div className="p5-card-h">
            <div className="p5-ht"><BookOpen /><span className="p5-card-t">1. Briefing e posicionamento</span></div>
            <button type="button" className="p5-ghost" onClick={() => { setDraft(description); setEditing(v => !v); }}>
              <Pencil />
            </button>
          </div>
          {editing ? (
            <div style={{ padding: "2px 16px 18px" }}>
              <textarea className="p5-ta" value={draft} onChange={e => setDraft(e.target.value)} />
              <button type="button" className="p5-save" onClick={() => { onSaveDescription?.(draft); setEditing(false); }}>
                Salvar
              </button>
            </div>
          ) : (
            <div className="p5-brief">
              <div>
                <div className="p5-bl">Briefing do projeto</div>
                <p className="p5-bt">
                  {description?.trim() || "Nenhum briefing cadastrado ainda. Clique no lápis para escrever o posicionamento deste projeto."}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* 2. SWOT */}
        <section className="p5-card">
          <div className="p5-card-h">
            <div className="p5-ht"><LayoutGrid /><span className="p5-card-t">2. Análise SWOT</span></div>
          </div>
          <div className="p5-swot">
            {QUADRANTS.map(q => {
              const Icon = q.icon;
              const items = swot.filter(s => s.quadrant === q.key);
              return (
                <div key={q.key} className="p5-sw">
                  <div className="p5-sw-h">
                    <span className="p5-dot" style={{ background: q.color }}><Icon /></span>
                    <b>{q.title}</b>
                  </div>
                  <ul>
                    {items.length === 0 && <li style={{ opacity: .6 }}>Nada cadastrado</li>}
                    {items.map(i => (
                      <li key={i.id} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <span style={{ flex: 1 }}>{i.content}</span>
                        <button type="button" className="p5-ghost" title="Remover" onClick={() => delSwot.mutate(i.id)}><X /></button>
                      </li>
                    ))}
                  </ul>
                  <InlineAdd placeholder={`Adicionar em ${q.title.toLowerCase()}`} onAdd={(v) => addSwot.mutate({ quadrant: q.key, content: v })} />
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. Personas */}
        <section className="p5-card">
          <div className="p5-card-h">
            <div className="p5-ht"><Users /><span className="p5-card-t">3. Personas do projeto</span></div>
            <span className="p5-link">{personas.length} cadastrada(s)</span>
          </div>
          <div className="p5-personas">
            <div className="p5-pgrid">
              {personas.length === 0 && (
                <div className="p5-bt" style={{ padding: "4px 2px" }}>Nenhuma persona cadastrada para este projeto.</div>
              )}
              {personas.map(p => (
                <div key={p.id} className="p5-persona">
                  <div className="p5-p-top">
                    <span className="p5-av">{initials(p.name)}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="p5-p-name">{p.name}</div>
                      <div className="p5-p-role">{[p.role, p.age ? `${p.age} anos` : null].filter(Boolean).join(" · ") || "—"}</div>
                      {asList(p.channels).length > 0 && (
                        <div className="p5-chips" style={{ marginTop: 6 }}>
                          {asList(p.channels).map(t => <span key={t} className="p5-chip">{t}</span>)}
                        </div>
                      )}
                    </div>
                    <button type="button" className="p5-ghost" title="Remover" onClick={() => delPersona.mutate(p.id)}><X /></button>
                  </div>
                  {asList(p.desires).length > 0 && <div className="p5-p-sec"><b>Objetivos</b><span>{asList(p.desires).join(", ")}</span></div>}
                  {asList(p.pains).length > 0 && <div className="p5-p-sec"><b>Dores</b><span>{asList(p.pains).join(", ")}</span></div>}
                </div>
              ))}
            </div>
            <InlineAdd2
              placeholders={["Nome da persona", "Papel / segmento"]}
              onAdd={([name, role]) => addPersona.mutate({ name, role })}
            />
          </div>
        </section>
      </div>

      <div className="p5-grid">
        {/* 4. Concorrentes */}
        <section className="p5-card">
          <div className="p5-card-h">
            <div className="p5-ht"><Filter /><span className="p5-card-t">4. Concorrentes e benchmarks</span></div>
          </div>
          {benchmarks.length === 0 ? (
            <div className="p5-brief"><p className="p5-bt">Nenhum concorrente mapeado neste projeto.</p></div>
          ) : (
            <table className="p5-table">
              <thead>
                <tr><th>Concorrente</th><th>Pontos fortes</th><th>Pontos fracos</th><th>Notas</th><th /></tr>
              </thead>
              <tbody>
                {benchmarks.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div className="p5-comp">
                        <span className="p5-logo">{initials(c.name)}</span>
                        <b>{c.name}</b>
                      </div>
                    </td>
                    <td>{c.strengths || "—"}</td>
                    <td>{c.weaknesses || "—"}</td>
                    <td>{c.notes || c.url || "—"}</td>
                    <td><button type="button" className="p5-ghost" onClick={() => delBench.mutate(c.id)}><X /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div style={{ padding: "0 16px 16px" }}>
            <InlineAdd2 placeholders={["Nome do concorrente", "Site (opcional)"]} onAdd={([name, url]) => addBench.mutate({ name, url })} />
          </div>
        </section>

        {/* 5. Próximos passos */}
        <section className="p5-card">
          <div className="p5-card-h">
            <div className="p5-ht"><ListChecks /><span className="p5-card-t">5. Próximos passos estratégicos</span></div>
            <span className="p5-link">{actions.filter(a => a.status === "done").length}/{actions.length} concluídos</span>
          </div>
          <div className="p5-steps">
            {actions.length === 0 && <div className="p5-bt" style={{ padding: "4px 2px" }}>Nenhuma ação estratégica cadastrada.</div>}
            {actions.map(s => (
              <div key={s.id} className={`p5-step${s.status === "done" ? " done" : ""}`}>
                <button type="button" className={`p5-check${s.status === "done" ? " on" : ""}`} onClick={() => toggleAction.mutate(s)}>
                  {s.status === "done" && <Check />}
                </button>
                <span className="p5-step-t">{s.title}</span>
                <span className="p5-date"><Calendar />{dt(s.due_date)}</span>
                <button type="button" className="p5-ghost" onClick={() => delAction.mutate(s.id)}><X /></button>
              </div>
            ))}
          </div>
          <div style={{ padding: "0 16px 16px" }}>
            <InlineAdd2 placeholders={["Nova ação estratégica", ""]} types={["text", "date"]} onAdd={([title, due]) => addAction.mutate({ title, due_date: due })} />
          </div>
        </section>
      </div>
    </div>
  );
}

function InlineAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form
      className="p5-inline-add"
      onSubmit={(e) => { e.preventDefault(); if (!v.trim()) return; onAdd(v.trim()); setV(""); }}
    >
      <input value={v} onChange={e => setV(e.target.value)} placeholder={placeholder} />
      <button type="submit"><Plus /></button>
    </form>
  );
}

function InlineAdd2({
  placeholders, types = ["text", "text"], onAdd,
}: { placeholders: [string, string] | string[]; types?: string[]; onAdd: (v: [string, string]) => void }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  return (
    <form
      className="p5-inline-add"
      onSubmit={(e) => { e.preventDefault(); if (!a.trim()) return; onAdd([a.trim(), b.trim()]); setA(""); setB(""); }}
    >
      <input value={a} type={types[0]} onChange={e => setA(e.target.value)} placeholder={placeholders[0]} />
      <input value={b} type={types[1]} onChange={e => setB(e.target.value)} placeholder={placeholders[1]} />
      <button type="submit"><Plus /></button>
    </form>
  );
}
