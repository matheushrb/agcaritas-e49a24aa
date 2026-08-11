import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LayoutGrid, Users, Filter, Target, ListChecks, Plus, Trash2, Check, Save,
  ThumbsUp, ThumbsDown, ArrowUpCircle, AlertOctagon, Sparkles, Loader2, Pencil,
} from "lucide-react";
import { ToolWindow, WinField } from "./tool-window";
import { generatePersonas, type GeneratedPersona } from "@/lib/personas.functions";
import "@/strategy-win.css";


const sb = supabase as any;

const toList = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
const fromCsv = (v: string) => v.split(",").map(s => s.trim()).filter(Boolean);
const lines = (v: string) => v.split("\n").map(s => s.trim()).filter(Boolean);
const initials = (n: string) =>
  (n || "?").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

async function orgId(): Promise<string> {
  const { data } = await sb.from("profiles").select("organization_id").maybeSingle();
  if (!data?.organization_id) throw new Error("Sem organização");
  return data.organization_id as string;
}

function useRows<T>(table: string, projectId: string, order: string, enabled: boolean) {
  return useQuery({
    queryKey: [table, projectId],
    enabled,
    queryFn: async (): Promise<T[]> => {
      const { data, error } = await sb.from(table).select("*").eq("project_id", projectId).order(order, { ascending: true });
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

function useCrud(table: string, projectId: string) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: [table, projectId] });
  const err = (e: any) => toast.error(e?.message ?? "Erro ao salvar");
  return {
    add: useMutation({
      mutationFn: async (row: Record<string, unknown>) => {
        const organization_id = await orgId();
        const { error } = await sb.from(table).insert({ ...row, organization_id, project_id: projectId });
        if (error) throw error;
      },
      onSuccess: inv, onError: err,
    }),
    addMany: useMutation({
      mutationFn: async (rows: Record<string, unknown>[]) => {
        if (!rows.length) return;
        const organization_id = await orgId();
        const { error } = await sb.from(table).insert(rows.map(r => ({ ...r, organization_id, project_id: projectId })));
        if (error) throw error;
      },
      onSuccess: inv, onError: err,
    }),
    upd: useMutation({
      mutationFn: async ({ id, ...patch }: any) => {
        const { error } = await sb.from(table).update(patch).eq("id", id);
        if (error) throw error;
      },
      onSuccess: inv, onError: err,
    }),
    del: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await sb.from(table).delete().eq("id", id);
        if (error) throw error;
      },
      onSuccess: inv, onError: err,
    }),
  };
}

function Modes({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="swin-modes">
      {options.map(([v, label]) => (
        <button key={v} type="button" className={value === v ? "active" : ""} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

/* ================================================================ SWOT */

const QUADRANTS = [
  { key: "strength", title: "Forças", color: "#10B981", icon: ThumbsUp, hint: "Vantagens internas que já temos." },
  { key: "weakness", title: "Fraquezas", color: "#F59E0B", icon: ThumbsDown, hint: "Limitações internas a resolver." },
  { key: "opportunity", title: "Oportunidades", color: "#2F6BEF", icon: ArrowUpCircle, hint: "Movimentos externos a aproveitar." },
  { key: "threat", title: "Ameaças", color: "#EF4444", icon: AlertOctagon, hint: "Riscos externos a monitorar." },
];

type SwotRow = { id: string; quadrant: string; content: string; position: number };

export function SwotWindow({ open, onClose, projectId, projectName }: {
  open: boolean; onClose: () => void; projectId: string; projectName: string;
}) {
  const { data: rows = [] } = useRows<SwotRow>("project_swot", projectId, "position", open);
  const { add, addMany, del } = useCrud("project_swot", projectId);
  const [mode, setMode] = useState("quadros");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState<Record<string, string>>({});

  const submitBulk = () => {
    const rowsToAdd = QUADRANTS.flatMap(q =>
      lines(bulk[q.key] ?? "").map((content, i) => ({
        quadrant: q.key, content, position: rows.filter(r => r.quadrant === q.key).length + i,
      })),
    );
    if (!rowsToAdd.length) { toast.error("Nada para adicionar"); return; }
    addMany.mutate(rowsToAdd, { onSuccess: () => { setBulk({}); setMode("quadros"); toast.success("Itens adicionados"); } });
  };

  return (
    <ToolWindow
      open={open} onClose={onClose} icon={LayoutGrid} title="Análise SWOT" subtitle={projectName}
      headerRight={<Modes value={mode} onChange={setMode} options={[["quadros", "Quadros"], ["lote", "Colar em lote"]]} />}
      footer={<><small>{rows.length} itens no total</small><button type="button" className="swin-btn" onClick={onClose}>Fechar</button></>}
    >
      <div className="swin-body">
        {mode === "quadros" ? (
          <div className="swin-grid">
            {QUADRANTS.map(q => {
              const Icon = q.icon;
              const items = rows.filter(r => r.quadrant === q.key);
              return (
                <div key={q.key} className="swin-quad">
                  <div className="swin-quad-h">
                    <span className="dot" style={{ background: q.color }}><Icon /></span>
                    <b>{q.title}</b>
                    <span className="count">{items.length}</span>
                  </div>
                  <p className="hint" style={{ fontSize: 10.5, color: "var(--muted-foreground)", marginBottom: 8 }}>{q.hint}</p>
                  <div className="swin-list">
                    {items.map(i => (
                      <div key={i.id} className="swin-item">
                        <span className="grow">{i.content}</span>
                        <button type="button" onClick={() => del.mutate(i.id)}><Trash2 /></button>
                      </div>
                    ))}
                  </div>
                  <div className="swin-f" style={{ marginTop: 8 }}>
                    <input
                      placeholder="Escreva e pressione Enter…"
                      value={draft[q.key] ?? ""}
                      onChange={e => setDraft({ ...draft, [q.key]: e.target.value })}
                      onKeyDown={e => {
                        if (e.key !== "Enter") return;
                        const v = (draft[q.key] ?? "").trim();
                        if (!v) return;
                        add.mutate({ quadrant: q.key, content: v, position: items.length });
                        setDraft({ ...draft, [q.key]: "" });
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div className="swin-grid">
              {QUADRANTS.map(q => (
                <WinField key={q.key} label={q.title} hint="Um item por linha.">
                  <textarea value={bulk[q.key] ?? ""} onChange={e => setBulk({ ...bulk, [q.key]: e.target.value })} />
                </WinField>
              ))}
            </div>
            <button type="button" className="swin-btn primary" style={{ marginTop: 14 }} onClick={submitBulk}>
              <Plus /> Adicionar itens
            </button>
          </>
        )}
      </div>
    </ToolWindow>
  );
}

/* ============================================================ Personas */

type PersonaRow = {
  id: string; name: string; role: string | null; tags: string[] | null;
  desires: string[] | null; pains: string[] | null; help: string | null;
};
const emptyPersona = { name: "", role: "", tags: "", desires: "", pains: "", help: "" };

export function PersonasWindow({ open, onClose, projectId, projectName }: {
  open: boolean; onClose: () => void; projectId: string; projectName: string;
}) {
  const { data: rows = [] } = useRows<PersonaRow>("project_personas", projectId, "created_at", open);
  const { add, addMany, upd, del } = useCrud("project_personas", projectId);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyPersona });

  /* ---- assistente por formulário (sem IA, sem créditos) ---- */
  const [wizOpen, setWizOpen] = useState(false);
  const [ans, setAns] = useState<PersonaAnswers>({ ...emptyAnswers });
  const [built, setBuilt] = useState<BuiltPersona[] | null>(null);
  const [picked, setPicked] = useState<Record<number, boolean>>({});
  const [names, setNames] = useState<Record<number, string>>({});

  const toggleIn = (list: string[], id: string) =>
    list.includes(id) ? list.filter(x => x !== id) : [...list, id];

  const runBuild = () => {
    const list = buildPersonas(ans);
    setBuilt(list);
    setPicked(Object.fromEntries(list.map((_, i) => [i, true])));
    setNames(Object.fromEntries(list.map((p, i) => [i, p.name])));
  };

  const applyPicked = () => {
    if (!built) return;
    const rowsToAdd = built
      .map((p, i) => ({ p, i }))
      .filter(({ i }) => picked[i])
      .map(({ p, i }) => ({
        name: names[i] || p.name, role: p.role, tags: p.tags,
        desires: p.desires, pains: p.pains, help: p.help,
      }));
    if (!rowsToAdd.length) { toast.error("Selecione ao menos uma persona"); return; }
    addMany.mutate(rowsToAdd, {
      onSuccess: () => {
        toast.success(`${rowsToAdd.length} persona(s) adicionada(s)`);
        setBuilt(null); setPicked({}); setNames({}); setWizOpen(false);
      },
    });
  };

  const pick = (p: PersonaRow) => {
    setSelected(p.id);
    setForm({
      name: p.name, role: p.role ?? "", tags: toList(p.tags).join(", "),
      desires: toList(p.desires).join("\n"), pains: toList(p.pains).join("\n"), help: p.help ?? "",
    });
  };

  const editGenerated = (p: BuiltPersona, i: number) => {
    setSelected(null);
    setForm({
      name: names[i] || p.name, role: p.role, tags: p.tags.join(", "),
      desires: p.desires.join("\n"), pains: p.pains.join("\n"), help: p.help,
    });
    setWizOpen(false);
  };


  const save = () => {
    if (!form.name.trim()) { toast.error("Informe o nome da persona"); return; }
    const row = {
      name: form.name.trim(),
      role: form.role.trim() || null,
      tags: fromCsv(form.tags),
      desires: lines(form.desires),
      pains: lines(form.pains),
      help: form.help.trim() || null,
    };
    if (selected) upd.mutate({ id: selected, ...row }, { onSuccess: () => toast.success("Persona atualizada") });
    else add.mutate(row, { onSuccess: () => { setForm({ ...emptyPersona }); toast.success("Persona criada"); } });
  };

  return (
    <ToolWindow
      open={open} onClose={onClose} icon={Users} title="Personas" subtitle={projectName} size="full"
      headerRight={
        <>
          <button type="button" className="swin-btn" onClick={() => { setAiOpen(o => !o); }}>
            <Sparkles /> {aiOpen ? "Fechar assistente" : "Gerar com IA"}
          </button>
          <button type="button" className="swin-btn" onClick={() => { setSelected(null); setForm({ ...emptyPersona }); setAiOpen(false); }}>
            <Plus /> Nova persona
          </button>
        </>
      }
      footer={
        <>
          <small>{rows.length} personas cadastradas</small>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="swin-btn" onClick={onClose}>Fechar</button>
            <button type="button" className="swin-btn primary" onClick={save}><Save /> {selected ? "Salvar alterações" : "Criar persona"}</button>
          </div>
        </>
      }
    >
      <div className="swin-split" style={{ gridTemplateColumns: "320px minmax(0,1fr)" }}>

        <div style={{ padding: 16 }}>
          <div className="swin-sec-t">Personas</div>
          <div className="swin-list">
            {rows.map(p => (
              <div key={p.id} className={`swin-item${selected === p.id ? " sel" : ""}`} onClick={() => pick(p)} style={{ cursor: "pointer" }}>
                <span
                  style={{
                    width: 28, height: 28, borderRadius: 999, display: "grid", placeItems: "center",
                    background: "color-mix(in oklab, var(--primary) 14%, transparent)", color: "var(--primary)",
                    fontSize: 11, fontWeight: 700, flex: "none",
                  }}
                >{initials(p.name)}</span>
                <span className="grow">
                  <b style={{ display: "block", fontSize: 12.5 }}>{p.name}</b>
                  <small style={{ color: "var(--muted-foreground)" }}>{p.role || "—"}</small>
                </span>
                <button type="button" onClick={e => { e.stopPropagation(); del.mutate(p.id); if (selected === p.id) { setSelected(null); setForm({ ...emptyPersona }); } }}><Trash2 /></button>
              </div>
            ))}
            {rows.length === 0 && <p className="swin-empty">Nenhuma persona ainda.</p>}
          </div>
        </div>

        <div style={{ padding: "18px 20px 28px" }}>
          {aiOpen && (
            <div className="swin-card" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 18, background: "var(--surface-2, transparent)" }}>
              <div className="swin-sec-t" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles style={{ width: 15, height: 15, color: "var(--primary)" }} /> Assistente de personas
              </div>
              <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: "2px 0 12px" }}>
                A IA lê o briefing, o cliente e o tipo do projeto para propor personas. Revise, escolha e adicione.
              </p>
              <div className="swin-grid">
                <WinField label="Quantas personas?" hint="De 1 a 5 por geração.">
                  <select value={aiCount} onChange={e => setAiCount(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </WinField>
                <WinField label="Direcionamento (opcional)" hint="Ex.: foco em decisores B2B do interior de SP" span>
                  <textarea value={aiNotes} onChange={e => setAiNotes(e.target.value)} rows={2} />
                </WinField>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                <button type="button" className="swin-btn primary" disabled={aiRun.isPending} onClick={() => aiRun.mutate()}>
                  {aiRun.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {aiRun.isPending ? "Gerando..." : aiResults.length ? "Gerar novamente" : "Gerar personas"}
                </button>
              </div>

              {aiResults.length > 0 && (
                <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                  {aiResults.map((p, i) => (
                    <div
                      key={`${p.name}-${i}`}
                      style={{
                        border: "1px solid var(--border)", borderRadius: 10, padding: 12,
                        opacity: aiPicked[i] ? 1 : 0.55, background: "var(--surface)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <input
                          type="checkbox" checked={!!aiPicked[i]} style={{ marginTop: 3 }}
                          onChange={e => setAiPicked({ ...aiPicked, [i]: e.target.checked })}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <b style={{ fontSize: 13 }}>{p.name}</b>
                          <small style={{ display: "block", color: "var(--muted-foreground)" }}>{p.role}</small>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
                            {p.tags.map((t, ti) => (
                              <span key={ti} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "color-mix(in oklab, var(--primary) 12%, transparent)", color: "var(--primary)" }}>{t}</span>
                            ))}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
                            <div>
                              <small style={{ color: "var(--muted-foreground)" }}>Objetivos</small>
                              <ul style={{ margin: "4px 0 0 16px" }}>{p.desires.map((d, di) => <li key={di}>{d}</li>)}</ul>
                            </div>
                            <div>
                              <small style={{ color: "var(--muted-foreground)" }}>Desafios</small>
                              <ul style={{ margin: "4px 0 0 16px" }}>{p.pains.map((d, di) => <li key={di}>{d}</li>)}</ul>
                            </div>
                          </div>
                          {p.help && <p style={{ fontSize: 12, marginTop: 8 }}><b>Como ajudamos: </b>{p.help}</p>}
                        </div>
                        <button type="button" className="swin-btn" onClick={() => editGenerated(p)} title="Editar antes de salvar">
                          <Pencil />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button type="button" className="swin-btn" onClick={() => { setAiResults([]); setAiPicked({}); }}>Descartar</button>
                    <button type="button" className="swin-btn primary" disabled={addMany.isPending} onClick={applyPicked}>
                      <Check /> Adicionar selecionadas
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="swin-sec-t">{selected ? "Editar persona" : "Nova persona"}</div>

          <div className="swin-grid">
            <WinField label="Nome" hint="Ex.: Marina, gestora de marketing"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></WinField>
            <WinField label="Cargo / contexto" hint="Ex.: CMO | Tech B2B"><input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} /></WinField>
            <WinField label="Características" hint="Separe por vírgula. Ex.: Estratégica, Exigente, Orientada a ROI" span>
              <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
            </WinField>
            <WinField label="Objetivos" hint="Um por linha."><textarea value={form.desires} onChange={e => setForm({ ...form, desires: e.target.value })} /></WinField>
            <WinField label="Desafios" hint="Um por linha."><textarea value={form.pains} onChange={e => setForm({ ...form, pains: e.target.value })} /></WinField>
            <WinField label="Como ajudamos" hint="Nossa resposta para essa persona." span>
              <textarea value={form.help} onChange={e => setForm({ ...form, help: e.target.value })} />
            </WinField>
          </div>
        </div>
      </div>
    </ToolWindow>
  );
}

/* ========================================================= Concorrentes */

type BenchRow = { id: string; name: string; positioning: string | null; strengths: string | null; weaknesses: string | null; threat_level: string };
const emptyBench = { name: "", positioning: "", strengths: "", weaknesses: "", threat_level: "Média" };

export function CompetitorsWindow({ open, onClose, projectId, projectName }: {
  open: boolean; onClose: () => void; projectId: string; projectName: string;
}) {
  const { data: rows = [] } = useRows<BenchRow>("project_benchmarks", projectId, "created_at", open);
  const { add, upd, del } = useCrud("project_benchmarks", projectId);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyBench });

  const pick = (c: BenchRow) => {
    setSelected(c.id);
    setForm({
      name: c.name, positioning: c.positioning ?? "", strengths: c.strengths ?? "",
      weaknesses: c.weaknesses ?? "", threat_level: c.threat_level ?? "Média",
    });
  };

  const save = () => {
    if (!form.name.trim()) { toast.error("Informe o nome do concorrente"); return; }
    const row = {
      name: form.name.trim(),
      positioning: form.positioning.trim() || null,
      strengths: form.strengths.trim() || null,
      weaknesses: form.weaknesses.trim() || null,
      threat_level: form.threat_level,
    };
    if (selected) upd.mutate({ id: selected, ...row }, { onSuccess: () => toast.success("Concorrente atualizado") });
    else add.mutate(row, { onSuccess: () => { setForm({ ...emptyBench }); toast.success("Concorrente adicionado"); } });
  };

  return (
    <ToolWindow
      open={open} onClose={onClose} icon={Filter} title="Concorrentes e benchmarks" subtitle={projectName} size="full"
      headerRight={
        <button type="button" className="swin-btn" onClick={() => { setSelected(null); setForm({ ...emptyBench }); }}>
          <Plus /> Novo concorrente
        </button>
      }
      footer={
        <>
          <small>{rows.length} concorrentes mapeados</small>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="swin-btn" onClick={onClose}>Fechar</button>
            <button type="button" className="swin-btn primary" onClick={save}><Save /> {selected ? "Salvar alterações" : "Adicionar"}</button>
          </div>
        </>
      }
    >
      <div className="swin-split" style={{ gridTemplateColumns: "340px minmax(0,1fr)" }}>
        <div style={{ padding: 16 }}>
          <div className="swin-sec-t">Mapeados</div>
          <div className="swin-list">
            {rows.map(c => (
              <div key={c.id} className={`swin-item${selected === c.id ? " sel" : ""}`} onClick={() => pick(c)} style={{ cursor: "pointer" }}>
                <span className="grow">
                  <b style={{ display: "block", fontSize: 12.5 }}>{c.name}</b>
                  <small style={{ color: "var(--muted-foreground)" }}>{c.positioning || "—"}</small>
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: c.threat_level === "Alta" ? "#D64545" : c.threat_level === "Média" ? "#B7791F" : "#10794F" }}>
                  {c.threat_level}
                </span>
                <button type="button" onClick={e => { e.stopPropagation(); del.mutate(c.id); if (selected === c.id) { setSelected(null); setForm({ ...emptyBench }); } }}><Trash2 /></button>
              </div>
            ))}
            {rows.length === 0 && <p className="swin-empty">Nenhum concorrente ainda.</p>}
          </div>
        </div>

        <div style={{ padding: "18px 20px 28px" }}>
          <div className="swin-sec-t">{selected ? "Editar concorrente" : "Novo concorrente"}</div>
          <div className="swin-grid">
            <WinField label="Nome"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></WinField>
            <WinField label="Nível de ameaça" hint="Quanto ele pressiona nosso posicionamento.">
              <select value={form.threat_level} onChange={e => setForm({ ...form, threat_level: e.target.value })}>
                <option>Alta</option><option>Média</option><option>Baixa</option>
              </select>
            </WinField>
            <WinField label="Posicionamento" hint="Como o concorrente se apresenta ao mercado." span>
              <input value={form.positioning} onChange={e => setForm({ ...form, positioning: e.target.value })} />
            </WinField>
            <WinField label="Pontos fortes" hint="Onde ele é bom."><textarea value={form.strengths} onChange={e => setForm({ ...form, strengths: e.target.value })} /></WinField>
            <WinField label="Gap vs. nós" hint="Onde ele perde para a gente."><textarea value={form.weaknesses} onChange={e => setForm({ ...form, weaknesses: e.target.value })} /></WinField>
          </div>
        </div>
      </div>
    </ToolWindow>
  );
}

/* ================================================================ KPIs */

type KpiRow = { id: string; name: string; target_value: number | null; current_value: number; unit: string | null; period: string | null; notes: string | null };
const emptyKpi = { name: "", target_value: "", current_value: "", unit: "", period: "", notes: "" };

const KPI_PRESETS = [
  { name: "Reconhecimento de marca", unit: "%", target_value: 60, period: "Trimestral" },
  { name: "Leads qualificados", unit: "/mês", target_value: 40, period: "Mensal" },
  { name: "Engajamento social", unit: "%", target_value: 8, period: "Mensal" },
  { name: "NPS", unit: "pts", target_value: 70, period: "Semestral" },
  { name: "Taxa de conversão", unit: "%", target_value: 3, period: "Mensal" },
];

export function KpisWindow({ open, onClose, projectId, projectName }: {
  open: boolean; onClose: () => void; projectId: string; projectName: string;
}) {
  const { data: rows = [] } = useRows<KpiRow>("project_kpis", projectId, "order_index", open);
  const { add, upd, del } = useCrud("project_kpis", projectId);
  const [mode, setMode] = useState("acompanhar");
  const [form, setForm] = useState({ ...emptyKpi });
  const [editing, setEditing] = useState<string | null>(null);

  const avg = useMemo(() => {
    const t = rows.filter(k => Number(k.target_value ?? 0) > 0);
    if (!t.length) return null;
    return Math.round(t.reduce((a, k) => a + Math.min(100, (Number(k.current_value) / Number(k.target_value)) * 100), 0) / t.length);
  }, [rows]);

  const save = () => {
    if (!form.name.trim()) { toast.error("Informe o indicador"); return; }
    const row = {
      name: form.name.trim(),
      target_value: form.target_value ? Number(form.target_value) : null,
      current_value: form.current_value ? Number(form.current_value) : 0,
      unit: form.unit.trim() || null,
      period: form.period.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (editing) upd.mutate({ id: editing, ...row }, { onSuccess: () => { setEditing(null); setForm({ ...emptyKpi }); setMode("acompanhar"); } });
    else add.mutate({ ...row, order_index: rows.length }, { onSuccess: () => { setForm({ ...emptyKpi }); setMode("acompanhar"); } });
  };

  return (
    <ToolWindow
      open={open} onClose={onClose} icon={Target} title="KPIs estratégicos" subtitle={projectName}
      headerRight={
        <>
          {avg !== null && <span style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>Média {avg}%</span>}
          <Modes value={mode} onChange={m => { setMode(m); if (m === "novo") { setEditing(null); setForm({ ...emptyKpi }); } }}
            options={[["acompanhar", "Acompanhar"], ["novo", "Novo indicador"]]} />
        </>
      }
      footer={<><small>{rows.length} indicadores</small><button type="button" className="swin-btn" onClick={onClose}>Fechar</button></>}
    >
      <div className="swin-body">
        {mode === "acompanhar" ? (
          rows.length === 0 ? (
            <p className="swin-empty">Nenhum indicador ainda. Use “Novo indicador” para começar.</p>
          ) : (
            <div className="swin-grid">
              {rows.map(k => {
                const target = Number(k.target_value ?? 0);
                const cur = Number(k.current_value ?? 0);
                const pct = target > 0 ? Math.min(100, Math.round((cur / target) * 100)) : 0;
                const color = pct >= 80 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444";
                return (
                  <div key={k.id} className="swin-quad">
                    <div className="swin-quad-h">
                      <b>{k.name}</b>
                      <span className="count">{target > 0 ? `${pct}%` : "sem meta"}</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      {cur}{k.unit ?? ""}
                      {target > 0 && <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}> / {target}{k.unit ?? ""}</span>}
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: "var(--muted)", overflow: "hidden", margin: "8px 0" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999 }} />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{k.period || "Sem período"}</div>
                    {k.notes && <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 6 }}>{k.notes}</p>}
                    <div className="swin-f" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                      <input
                        type="number" defaultValue={cur} key={`${k.id}-${cur}`} style={{ maxWidth: 120 }}
                        onBlur={e => { const v = Number(e.target.value); if (!Number.isNaN(v) && v !== cur) upd.mutate({ id: k.id, current_value: v }); }}
                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      />
                      <button
                        type="button" className="swin-btn"
                        onClick={() => {
                          setEditing(k.id);
                          setForm({
                            name: k.name, target_value: String(k.target_value ?? ""), current_value: String(k.current_value ?? ""),
                            unit: k.unit ?? "", period: k.period ?? "", notes: k.notes ?? "",
                          });
                          setMode("novo");
                        }}
                      >Editar</button>
                      <button type="button" className="swin-btn danger" onClick={() => del.mutate(k.id)}><Trash2 /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <>
            <div className="swin-sec">
              <div className="swin-sec-t">Sugestões rápidas</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {KPI_PRESETS.map(p => (
                  <button
                    key={p.name} type="button" className="swin-btn"
                    onClick={() => setForm({ ...form, name: p.name, unit: p.unit, target_value: String(p.target_value), period: p.period })}
                  >{p.name}</button>
                ))}
              </div>
            </div>
            <div className="swin-grid">
              <WinField label="Indicador" hint="Ex.: Leads qualificados/mês" span><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></WinField>
              <WinField label="Meta"><input type="number" value={form.target_value} onChange={e => setForm({ ...form, target_value: e.target.value })} /></WinField>
              <WinField label="Valor atual"><input type="number" value={form.current_value} onChange={e => setForm({ ...form, current_value: e.target.value })} /></WinField>
              <WinField label="Unidade" hint="%, R$, pts"><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></WinField>
              <WinField label="Período" hint="Mensal, 2026-Q1"><input value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} /></WinField>
              <WinField label="Observação" span><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></WinField>
            </div>
            <button type="button" className="swin-btn primary" style={{ marginTop: 14 }} onClick={save}>
              <Save /> {editing ? "Salvar indicador" : "Criar indicador"}
            </button>
          </>
        )}
      </div>
    </ToolWindow>
  );
}

/* ======================================================== Próximos passos */

type StepRow = { id: string; title: string; due_date: string | null; status: string; order_index?: number };

export function StepsWindow({ open, onClose, projectId, projectName }: {
  open: boolean; onClose: () => void; projectId: string; projectName: string;
}) {
  const { data: rows = [] } = useRows<StepRow>("project_action_items", projectId, "order_index", open);
  const { add, addMany, upd, del } = useCrud("project_action_items", projectId);
  const [mode, setMode] = useState("lista");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [bulk, setBulk] = useState("");

  const create = () => {
    if (!title.trim()) { toast.error("Informe a iniciativa"); return; }
    add.mutate({ title: title.trim(), due_date: due || null, status: "todo", order_index: rows.length },
      { onSuccess: () => { setTitle(""); setDue(""); } });
  };

  const createBulk = () => {
    const items = lines(bulk);
    if (!items.length) { toast.error("Nada para adicionar"); return; }
    addMany.mutate(items.map((t, i) => ({ title: t, status: "todo", due_date: null, order_index: rows.length + i })),
      { onSuccess: () => { setBulk(""); setMode("lista"); toast.success("Passos adicionados"); } });
  };

  const done = rows.filter(r => r.status === "done").length;

  return (
    <ToolWindow
      open={open} onClose={onClose} icon={ListChecks} title="Próximos passos estratégicos" subtitle={projectName}
      headerRight={<Modes value={mode} onChange={setMode} options={[["lista", "Lista"], ["lote", "Colar em lote"]]} />}
      footer={<><small>{done}/{rows.length} concluídos</small><button type="button" className="swin-btn" onClick={onClose}>Fechar</button></>}
    >
      <div className="swin-body">
        {mode === "lista" ? (
          <>
            <div className="swin-list" style={{ marginBottom: 16 }}>
              {rows.map(st => {
                const isDone = st.status === "done";
                return (
                  <div key={st.id} className="swin-item">
                    <button type="button" onClick={() => upd.mutate({ id: st.id, status: isDone ? "todo" : "done" })}
                      style={{
                        width: 18, height: 18, borderRadius: 999, flex: "none",
                        border: `1.5px solid ${isDone ? "#10B981" : "var(--border)"}`,
                        background: isDone ? "#10B981" : "transparent", color: "#fff",
                      }}>
                      {isDone && <Check style={{ width: 11, height: 11 }} />}
                    </button>
                    <span className="grow" style={{ textDecoration: isDone ? "line-through" : "none", color: isDone ? "var(--muted-foreground)" : undefined }}>
                      {st.title}
                    </span>
                    <input
                      type="date" defaultValue={st.due_date ?? ""} key={`${st.id}-${st.due_date}`}
                      onChange={e => upd.mutate({ id: st.id, due_date: e.target.value || null })}
                      style={{ fontSize: 11.5, border: "1px solid var(--border)", borderRadius: 8, padding: "4px 8px", background: "var(--background)" }}
                    />
                    <button type="button" onClick={() => del.mutate(st.id)}><Trash2 /></button>
                  </div>
                );
              })}
              {rows.length === 0 && <p className="swin-empty">Nenhum passo definido.</p>}
            </div>

            <div className="swin-grid">
              <WinField label="Nova iniciativa" hint="Ex.: Validar novo posicionamento com o cliente">
                <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === "Enter") create(); }} />
              </WinField>
              <WinField label="Prazo"><input type="date" value={due} onChange={e => setDue(e.target.value)} /></WinField>
            </div>
            <button type="button" className="swin-btn primary" style={{ marginTop: 12 }} onClick={create}><Plus /> Adicionar passo</button>
          </>
        ) : (
          <>
            <WinField label="Passos" hint="Um por linha.">
              <textarea style={{ minHeight: 200 }} value={bulk} onChange={e => setBulk(e.target.value)} />
            </WinField>
            <button type="button" className="swin-btn primary" style={{ marginTop: 12 }} onClick={createBulk}><Plus /> Adicionar todos</button>
          </>
        )}
      </div>
    </ToolWindow>
  );
}
