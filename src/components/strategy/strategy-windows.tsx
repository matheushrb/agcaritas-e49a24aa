import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LayoutGrid, Users, Filter, Target, ListChecks, Plus, Trash2, Check, Save,
  ThumbsUp, ThumbsDown, ArrowUpCircle, AlertOctagon, Sparkles, Pencil,
} from "lucide-react";
import { ToolWindow, WinField } from "./tool-window";
import {
  buildPersonas, emptyAnswers, DECIDER_OPTIONS, STAGE_OPTIONS, CHANNEL_OPTIONS,
  AGE_OPTIONS, REGION_OPTIONS, INCOME_OPTIONS, EDUCATION_OPTIONS,
  type PersonaAnswers, type BuiltPersona,
} from "@/lib/persona-builder";

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
  quote: string | null; persona_type: string | null;
  age_range: string | null; gender: string | null; location: string | null;
  family: string | null; education: string | null; income: string | null;
  company_context: string | null; decision_power: string | null;
  info_sources: string[] | null; tools: string | null; content_habits: string | null;
  objections: string[] | null; triggers: string[] | null; journey_stage: string | null;
};
const emptyPersona = {
  name: "", role: "", tags: "", desires: "", pains: "", help: "",
  quote: "", persona_type: "B2B", age_range: "", gender: "", location: "",
  family: "", education: "", income: "", company_context: "", decision_power: "",
  info_sources: "", tools: "", content_habits: "", objections: "", triggers: "",
  journey_stage: "",
};

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
        quote: p.quote, persona_type: p.personaType, age_range: p.ageRange,
        gender: p.gender, location: p.location, family: p.family,
        education: p.education, income: p.income, company_context: p.companyContext || null,
        decision_power: p.decisionPower, info_sources: p.infoSources, tools: p.tools,
        content_habits: p.contentHabits, objections: p.objections, triggers: p.triggers,
        journey_stage: p.journeyStage,
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
      quote: p.quote ?? "", persona_type: p.persona_type ?? "B2B",
      age_range: p.age_range ?? "", gender: p.gender ?? "", location: p.location ?? "",
      family: p.family ?? "", education: p.education ?? "", income: p.income ?? "",
      company_context: p.company_context ?? "", decision_power: p.decision_power ?? "",
      info_sources: toList(p.info_sources).join(", "), tools: p.tools ?? "",
      content_habits: p.content_habits ?? "",
      objections: toList(p.objections).join("\n"), triggers: toList(p.triggers).join("\n"),
      journey_stage: p.journey_stage ?? "",
    });
  };

  const editGenerated = (p: BuiltPersona, i: number) => {
    setSelected(null);
    setForm({
      name: names[i] || p.name, role: p.role, tags: p.tags.join(", "),
      desires: p.desires.join("\n"), pains: p.pains.join("\n"), help: p.help,
      quote: p.quote, persona_type: p.personaType, age_range: p.ageRange,
      gender: p.gender, location: p.location, family: p.family, education: p.education,
      income: p.income, company_context: p.companyContext, decision_power: p.decisionPower,
      info_sources: p.infoSources.join(", "), tools: p.tools, content_habits: p.contentHabits,
      objections: p.objections.join("\n"), triggers: p.triggers.join("\n"),
      journey_stage: p.journeyStage,
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
      quote: form.quote.trim() || null,
      persona_type: form.persona_type || null,
      age_range: form.age_range.trim() || null,
      gender: form.gender.trim() || null,
      location: form.location.trim() || null,
      family: form.family.trim() || null,
      education: form.education.trim() || null,
      income: form.income.trim() || null,
      company_context: form.company_context.trim() || null,
      decision_power: form.decision_power.trim() || null,
      info_sources: fromCsv(form.info_sources),
      tools: form.tools.trim() || null,
      content_habits: form.content_habits.trim() || null,
      objections: lines(form.objections),
      triggers: lines(form.triggers),
      journey_stage: form.journey_stage.trim() || null,
    };
    if (selected) upd.mutate({ id: selected, ...row }, { onSuccess: () => toast.success("Persona atualizada") });
    else add.mutate(row, { onSuccess: () => { setForm({ ...emptyPersona }); toast.success("Persona criada"); } });
  };

  return (
    <ToolWindow
      open={open} onClose={onClose} icon={Users} title="Personas" subtitle={projectName} size="full"
      headerRight={
        <>
          <button type="button" className="swin-btn" onClick={() => setWizOpen(o => !o)}>
            <Sparkles /> {wizOpen ? "Fechar assistente" : "Assistente de personas"}
          </button>
          <button type="button" className="swin-btn" onClick={() => { setSelected(null); setForm({ ...emptyPersona }); setWizOpen(false); }}>

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
          {wizOpen && (
            <div className="swin-card" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 18, background: "var(--surface-2, transparent)" }}>
              <div className="swin-sec-t" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles style={{ width: 15, height: 15, color: "var(--primary)" }} /> Assistente de personas
              </div>
              <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: "2px 0 12px" }}>
                Responda o formulário padrão. O sistema define sozinho quantas personas o projeto precisa e como elas são — você só escolhe o nome.
              </p>

              <div className="swin-grid">
                <WinField label="Tipo de mercado">
                  <select value={ans.market} onChange={e => setAns({ ...ans, market: e.target.value as PersonaAnswers["market"] })}>
                    <option value="b2b">B2B — vende para empresas</option>
                    <option value="b2c">B2C — vende para consumidor</option>
                    <option value="both">Os dois</option>
                  </select>
                </WinField>
                <WinField label="Perfil de quem compra">
                  <select value={ans.audienceSize} onChange={e => setAns({ ...ans, audienceSize: e.target.value as PersonaAnswers["audienceSize"] })}>
                    <option value="mei">MEI / autônomo</option>
                    <option value="pme">Pequena empresa</option>
                    <option value="media">Empresa média</option>
                    <option value="grande">Grande empresa</option>
                    <option value="consumidor">Consumidor final</option>
                  </select>
                </WinField>
                <WinField label="Ticket médio">
                  <select value={ans.ticket} onChange={e => setAns({ ...ans, ticket: e.target.value as PersonaAnswers["ticket"] })}>
                    <option value="baixo">Baixo</option>
                    <option value="medio">Médio</option>
                    <option value="alto">Alto</option>
                  </select>
                </WinField>
                <WinField label="Tempo de decisão">
                  <select value={ans.cycle} onChange={e => setAns({ ...ans, cycle: e.target.value as PersonaAnswers["cycle"] })}>
                    <option value="curto">Curto (dias)</option>
                    <option value="medio">Médio (semanas)</option>
                    <option value="longo">Longo (meses)</option>
                  </select>
                </WinField>
                <WinField label="Objetivo do projeto">
                  <select value={ans.goal} onChange={e => setAns({ ...ans, goal: e.target.value as PersonaAnswers["goal"] })}>
                    <option value="reconhecimento">Reconhecimento de marca</option>
                    <option value="leads">Geração de leads</option>
                    <option value="vendas">Vendas diretas</option>
                    <option value="retencao">Retenção / recompra</option>
                  </select>
                </WinField>
                <WinField label="Principal barreira">
                  <select value={ans.barrier} onChange={e => setAns({ ...ans, barrier: e.target.value as PersonaAnswers["barrier"] })}>
                    <option value="preco">Preço / justificar investimento</option>
                    <option value="confianca">Confiança no fornecedor</option>
                    <option value="prazo">Pressa por resultado</option>
                    <option value="complexidade">Assunto complexo demais</option>
                    <option value="concorrencia">Concorrência forte</option>
                  </select>
                </WinField>
                <WinField label="Inclinação de gênero" hint="Predomínio do público-alvo.">
                  <select value={ans.gender} onChange={e => setAns({ ...ans, gender: e.target.value as PersonaAnswers["gender"] })}>
                    <option value="equilibrado">Equilibrado (mulheres e homens)</option>
                    <option value="mulher">Predominantemente mulheres</option>
                    <option value="homem">Predominantemente homens</option>
                    <option value="indefinido">Não sei / indefinido</option>
                  </select>
                </WinField>
                <WinField label="Faixa etária predominante">
                  <select value={ans.ageRange} onChange={e => setAns({ ...ans, ageRange: e.target.value })}>
                    {AGE_OPTIONS.map(o => <option key={o} value={o}>{o} anos</option>)}
                  </select>
                </WinField>
                <WinField label="Localização">
                  <select value={ans.region} onChange={e => setAns({ ...ans, region: e.target.value })}>
                    {REGION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </WinField>
                <WinField label="Faixa de renda / porte">
                  <select value={ans.income} onChange={e => setAns({ ...ans, income: e.target.value })}>
                    {INCOME_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </WinField>
                <WinField label="Escolaridade">
                  <select value={ans.education} onChange={e => setAns({ ...ans, education: e.target.value })}>
                    {EDUCATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </WinField>


                {(ans.market === "b2b" || ans.market === "both") && (
                  <WinField label="Quem participa da decisão?" hint="Pode marcar mais de um." span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {DECIDER_OPTIONS.map(o => (
                        <button
                          key={o.id} type="button"
                          className={`swin-btn${ans.deciders.includes(o.id) ? " primary" : ""}`}
                          onClick={() => setAns({ ...ans, deciders: toggleIn(ans.deciders, o.id) })}
                        >{o.label}</button>
                      ))}
                    </div>
                  </WinField>
                )}

                {(ans.market === "b2c" || ans.market === "both") && (
                  <WinField label="Momentos do consumidor" hint="Pode marcar mais de um." span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {STAGE_OPTIONS.map(o => (
                        <button
                          key={o.id} type="button"
                          className={`swin-btn${ans.stages.includes(o.id) ? " primary" : ""}`}
                          onClick={() => setAns({ ...ans, stages: toggleIn(ans.stages, o.id) })}
                        >{o.label}</button>
                      ))}
                    </div>
                  </WinField>
                )}

                <WinField label="Onde essas pessoas estão?" hint="Pode marcar mais de um." span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {CHANNEL_OPTIONS.map(o => (
                      <button
                        key={o.id} type="button"
                        className={`swin-btn${ans.channels.includes(o.id) ? " primary" : ""}`}
                        onClick={() => setAns({ ...ans, channels: toggleIn(ans.channels, o.id) })}
                      >{o.label}</button>
                    ))}
                  </div>
                </WinField>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                <button type="button" className="swin-btn primary" onClick={runBuild}>
                  <Sparkles /> {built ? "Recalcular personas" : "Montar personas"}
                </button>
              </div>

              {built && (
                <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                  <small style={{ color: "var(--muted-foreground)" }}>
                    Com essas respostas, o projeto precisa de <b>{built.length}</b> persona(s).
                  </small>
                  {built.map((p, i) => (
                    <div
                      key={p.key}
                      style={{
                        border: "1px solid var(--border)", borderRadius: 10, padding: 12,
                        opacity: picked[i] ? 1 : 0.55, background: "var(--surface)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <input
                          type="checkbox" checked={!!picked[i]} style={{ marginTop: 3 }}
                          onChange={e => setPicked({ ...picked, [i]: e.target.checked })}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <select
                              value={names[i] ?? p.name}
                              onChange={e => setNames({ ...names, [i]: e.target.value })}
                              style={{ fontWeight: 700, fontSize: 13, padding: "3px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "inherit" }}
                            >
                              {p.nameOptions.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <small style={{ color: "var(--muted-foreground)" }}>{p.role}</small>
                          </div>
                          <small style={{ display: "block", color: "var(--muted-foreground)", marginTop: 4 }}>{p.why}</small>
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
                        <button type="button" className="swin-btn" onClick={() => editGenerated(p, i)} title="Editar antes de salvar">
                          <Pencil />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button type="button" className="swin-btn" onClick={() => { setBuilt(null); setPicked({}); setNames({}); }}>Descartar</button>
                    <button type="button" className="swin-btn primary" disabled={addMany.isPending} onClick={applyPicked}>
                      <Check /> Adicionar selecionadas
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}


          <div className="swin-sec-t">{selected ? "Editar persona" : "Nova persona"}</div>

          {/* cartão-resumo da persona */}
          {form.name.trim() && (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", border: "1px solid var(--border)", borderRadius: 12, padding: 14, margin: "0 0 16px", background: "var(--surface-2, transparent)" }}>
              <span style={{ width: 46, height: 46, borderRadius: 999, display: "grid", placeItems: "center", background: "color-mix(in oklab, var(--primary) 14%, transparent)", color: "var(--primary)", fontWeight: 800, fontSize: 15, flex: "none" }}>{initials(form.name)}</span>
              <div style={{ minWidth: 0 }}>
                <b style={{ fontSize: 14 }}>{form.name}</b>
                {form.persona_type && <span style={{ marginLeft: 8, fontSize: 10.5, padding: "2px 8px", borderRadius: 999, background: "color-mix(in oklab, var(--primary) 12%, transparent)", color: "var(--primary)" }}>{form.persona_type}</span>}
                <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{form.role || "—"}</div>
                {form.quote && <p style={{ fontSize: 12.5, fontStyle: "italic", margin: "6px 0 0" }}>“{form.quote}”</p>}
                <div style={{ fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 6 }}>
                  {[form.age_range && `${form.age_range} anos`, form.gender, form.location, form.income].filter(Boolean).join("  •  ")}
                </div>
              </div>
            </div>
          )}

          <div className="swin-sec-t">1. Identificação</div>
          <div className="swin-grid">
            <WinField label="Nome" hint="Ex.: Marina, gestora de marketing"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></WinField>
            <WinField label="Cargo / contexto" hint="Ex.: CMO | Tech B2B"><input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} /></WinField>
            <WinField label="Frase-resumo" hint="Uma citação que capture a essência dela." span>
              <input value={form.quote} onChange={e => setForm({ ...form, quote: e.target.value })} />
            </WinField>
            <WinField label="Tipo de persona">
              <select value={form.persona_type} onChange={e => setForm({ ...form, persona_type: e.target.value })}>
                <option value="B2B">B2B — compra para a empresa</option>
                <option value="B2C">B2C — consumidor final</option>
              </select>
            </WinField>
            <WinField label="Características" hint="Separe por vírgula.">
              <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
            </WinField>
          </div>

          <div className="swin-sec-t" style={{ marginTop: 18 }}>2. Dados demográficos</div>
          <div className="swin-grid">
            <WinField label="Faixa etária"><input value={form.age_range} onChange={e => setForm({ ...form, age_range: e.target.value })} /></WinField>
            <WinField label="Gênero"><input value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} /></WinField>
            <WinField label="Localização"><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></WinField>
            <WinField label="Estado civil / filhos"><input value={form.family} onChange={e => setForm({ ...form, family: e.target.value })} /></WinField>
            <WinField label="Escolaridade"><input value={form.education} onChange={e => setForm({ ...form, education: e.target.value })} /></WinField>
            <WinField label="Faixa de renda"><input value={form.income} onChange={e => setForm({ ...form, income: e.target.value })} /></WinField>
          </div>

          {form.persona_type === "B2B" && (
            <>
              <div className="swin-sec-t" style={{ marginTop: 18 }}>3. Contexto profissional</div>
              <div className="swin-grid">
                <WinField label="Empresa / setor / porte"><input value={form.company_context} onChange={e => setForm({ ...form, company_context: e.target.value })} /></WinField>
                <WinField label="Poder de decisão" hint="Decisor, influenciador ou usuário final."><input value={form.decision_power} onChange={e => setForm({ ...form, decision_power: e.target.value })} /></WinField>
              </div>
            </>
          )}

          <div className="swin-sec-t" style={{ marginTop: 18 }}>4. Objetivos e desafios</div>
          <div className="swin-grid">
            <WinField label="Objetivos e motivações" hint="Um por linha."><textarea value={form.desires} onChange={e => setForm({ ...form, desires: e.target.value })} /></WinField>
            <WinField label="Dores e desafios" hint="Um por linha."><textarea value={form.pains} onChange={e => setForm({ ...form, pains: e.target.value })} /></WinField>
          </div>

          <div className="swin-sec-t" style={{ marginTop: 18 }}>5. Comportamento e hábitos</div>
          <div className="swin-grid">
            <WinField label="Onde busca informação" hint="Separe por vírgula."><input value={form.info_sources} onChange={e => setForm({ ...form, info_sources: e.target.value })} /></WinField>
            <WinField label="Ferramentas / produtos que já usa"><input value={form.tools} onChange={e => setForm({ ...form, tools: e.target.value })} /></WinField>
            <WinField label="Conteúdo que consome" span><input value={form.content_habits} onChange={e => setForm({ ...form, content_habits: e.target.value })} /></WinField>
          </div>

          <div className="swin-sec-t" style={{ marginTop: 18 }}>6. Objeções, gatilhos e jornada</div>
          <div className="swin-grid">
            <WinField label="Objeções" hint="O que impede de fechar. Um por linha."><textarea value={form.objections} onChange={e => setForm({ ...form, objections: e.target.value })} /></WinField>
            <WinField label="Gatilhos de decisão" hint="O que convence. Um por linha."><textarea value={form.triggers} onChange={e => setForm({ ...form, triggers: e.target.value })} /></WinField>
            <WinField label="Etapa da jornada quando nos encontra"><input value={form.journey_stage} onChange={e => setForm({ ...form, journey_stage: e.target.value })} /></WinField>
            <WinField label="Como ajudamos" hint="Nossa resposta para essa persona.">
              <textarea value={form.help} onChange={e => setForm({ ...form, help: e.target.value })} />
            </WinField>
          </div>
        </div>
      </div>
    </ToolWindow>
  );
}

/* ========================================================= Concorrentes */

type BenchRow = {
  id: string; name: string; positioning: string | null; strengths: string | null;
  weaknesses: string | null; threat_level: string; url: string | null; notes: string | null;
  price_level: string | null; audience: string | null; differentials: string | null;
  channels: string[] | null; is_us: boolean; metrics: Record<string, number> | null;
};

const emptyBench = {
  name: "", positioning: "", strengths: "", weaknesses: "", threat_level: "Média",
  url: "", notes: "", price_level: "Médio", audience: "", differentials: "",
  channels: "", is_us: false,
};

/** Indicadores fixos comparáveis entre nós e concorrentes. */
const BENCH_METRICS: { key: string; label: string; unit: string; better: "high" | "low" }[] = [
  { key: "followers", label: "Seguidores (principal rede)", unit: "", better: "high" },
  { key: "engagement", label: "Engajamento médio", unit: "%", better: "high" },
  { key: "posts_month", label: "Publicações por mês", unit: "/mês", better: "high" },
  { key: "google_rating", label: "Nota no Google", unit: "★", better: "high" },
  { key: "reviews", label: "Avaliações recebidas", unit: "", better: "high" },
  { key: "avg_ticket", label: "Ticket médio", unit: "R$", better: "high" },
  { key: "response_hours", label: "Tempo de resposta", unit: "h", better: "low" },
  { key: "site_authority", label: "Autoridade do site", unit: "pts", better: "high" },
];

export function CompetitorsWindow({ open, onClose, projectId, projectName }: {
  open: boolean; onClose: () => void; projectId: string; projectName: string;
}) {
  const { data: rows = [] } = useRows<BenchRow>("project_benchmarks", projectId, "created_at", open);
  const { data: kpis = [] } = useRows<{ id: string; name: string; unit: string | null; current_value: number }>(
    "project_kpis", projectId, "order_index", open,
  );
  const { add, upd, del } = useCrud("project_benchmarks", projectId);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyBench });
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  const [compareOpen, setCompareOpen] = useState(false);

  const usRow = useMemo(() => rows.find(r => r.is_us) ?? null, [rows]);
  const competitors = useMemo(() => rows.filter(r => !r.is_us), [rows]);

  /** Catálogo completo: indicadores fixos + KPIs do projeto. */
  const catalog = useMemo(() => ([
    ...BENCH_METRICS,
    ...kpis.map(k => ({ key: `kpi:${k.id}`, label: `${k.name} (KPI)`, unit: k.unit ?? "", better: "high" as const })),
  ]), [kpis]);

  /** Nossos valores: linha "nós" + fallback nos KPIs do projeto. */
  const ourValues = useMemo(() => {
    const m: Record<string, number> = { ...(usRow?.metrics ?? {}) };
    kpis.forEach(k => {
      const key = `kpi:${k.id}`;
      if (m[key] === undefined && Number(k.current_value) > 0) m[key] = Number(k.current_value);
    });
    return m;
  }, [usRow, kpis]);

  const pick = (c: BenchRow) => {
    setSelected(c.id);
    setCompareOpen(false);
    setForm({
      name: c.name, positioning: c.positioning ?? "", strengths: c.strengths ?? "",
      weaknesses: c.weaknesses ?? "", threat_level: c.threat_level ?? "Média",
      url: c.url ?? "", notes: c.notes ?? "", price_level: c.price_level ?? "Médio",
      audience: c.audience ?? "", differentials: c.differentials ?? "",
      channels: (c.channels ?? []).join(", "), is_us: !!c.is_us,
    });
    setMetrics(Object.fromEntries(Object.entries(c.metrics ?? {}).map(([k, v]) => [k, String(v)])));
  };

  const reset = () => { setSelected(null); setForm({ ...emptyBench }); setMetrics({}); setCompareOpen(false); };

  const save = () => {
    if (!form.name.trim()) { toast.error("Informe o nome"); return; }
    const numeric: Record<string, number> = {};
    Object.entries(metrics).forEach(([k, v]) => {
      const n = Number(String(v).replace(",", "."));
      if (v !== "" && Number.isFinite(n)) numeric[k] = n;
    });
    const row = {
      name: form.name.trim(),
      positioning: form.positioning.trim() || null,
      strengths: form.strengths.trim() || null,
      weaknesses: form.weaknesses.trim() || null,
      threat_level: form.threat_level,
      url: form.url.trim() || null,
      notes: form.notes.trim() || null,
      price_level: form.price_level || null,
      audience: form.audience.trim() || null,
      differentials: form.differentials.trim() || null,
      channels: fromCsv(form.channels),
      is_us: form.is_us,
      metrics: numeric,
    };
    if (selected) upd.mutate({ id: selected, ...row }, { onSuccess: () => toast.success("Registro atualizado") });
    else add.mutate(row, { onSuccess: () => { reset(); toast.success("Registro adicionado"); } });
  };

  /** Comparação: só indicadores preenchidos por nós E pelo concorrente. */
  const comparison = useMemo(() => {
    return competitors.map(c => {
      const cm = c.metrics ?? {};
      const lines = catalog
        .filter(m => ourValues[m.key] !== undefined && cm[m.key] !== undefined)
        .map(m => {
          const us = Number(ourValues[m.key]);
          const them = Number(cm[m.key]);
          const win = us === them ? "empate" : (m.better === "high" ? (us > them ? "nós" : "eles") : (us < them ? "nós" : "eles"));
          const diff = them === 0 ? null : Math.round(((us - them) / Math.abs(them)) * 100);
          return { ...m, us, them, win, diff };
        });
      const wins = lines.filter(l => l.win === "nós").length;
      const losses = lines.filter(l => l.win === "eles").length;
      return { competitor: c, lines, wins, losses };
    });
  }, [competitors, catalog, ourValues]);

  const comparableCount = comparison.reduce((a, c) => a + c.lines.length, 0);

  const fmt = (v: number, unit: string) =>
    unit === "R$" ? `R$ ${v.toLocaleString("pt-BR")}` : `${v.toLocaleString("pt-BR")}${unit ? ` ${unit}` : ""}`;

  return (
    <ToolWindow
      open={open} onClose={onClose} icon={Filter} title="Concorrentes e benchmarks" subtitle={projectName} size="full"
      headerRight={
        <>
          <button type="button" className="swin-btn" onClick={() => setCompareOpen(o => !o)}>
            <ArrowUpCircle /> {compareOpen ? "Voltar ao cadastro" : "Comparar com a gente"}
          </button>
          <button type="button" className="swin-btn" onClick={reset}>
            <Plus /> Novo concorrente
          </button>
        </>
      }
      footer={
        <>
          <small>{competitors.length} concorrentes mapeados{usRow ? " • nossos dados cadastrados" : " • falta cadastrar 'nós'"}</small>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="swin-btn" onClick={onClose}>Fechar</button>
            {!compareOpen && (
              <button type="button" className="swin-btn primary" onClick={save}><Save /> {selected ? "Salvar alterações" : "Adicionar"}</button>
            )}
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
                  <b style={{ display: "block", fontSize: 12.5 }}>
                    {c.name}{c.is_us && <span style={{ marginLeft: 6, fontSize: 10, padding: "1px 6px", borderRadius: 999, background: "color-mix(in oklab, var(--primary) 14%, transparent)", color: "var(--primary)" }}>Nós</span>}
                  </b>
                  <small style={{ color: "var(--muted-foreground)" }}>{c.positioning || "—"}</small>
                </span>
                {!c.is_us && (
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: c.threat_level === "Alta" ? "#D64545" : c.threat_level === "Média" ? "#B7791F" : "#10794F" }}>
                    {c.threat_level}
                  </span>
                )}
                <button type="button" onClick={e => { e.stopPropagation(); del.mutate(c.id); if (selected === c.id) reset(); }}><Trash2 /></button>
              </div>
            ))}
            {rows.length === 0 && <p className="swin-empty">Nenhum registro ainda.</p>}
          </div>
        </div>

        <div style={{ padding: "18px 20px 28px" }}>
          {compareOpen ? (
            <>
              <div className="swin-sec-t">Comparação de indicadores</div>
              <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: "2px 0 14px" }}>
                O sistema compara apenas os indicadores preenchidos dos dois lados. Nossos valores vêm do registro marcado como “Nós” e dos KPIs do projeto.
              </p>

              {comparableCount === 0 && (
                <p className="swin-empty">
                  Ainda não há indicadores correspondentes. Preencha os mesmos indicadores no registro “Nós” e nos concorrentes.
                </p>
              )}

              <div style={{ display: "grid", gap: 14 }}>
                {comparison.filter(c => c.lines.length > 0).map(({ competitor, lines, wins, losses }) => (
                  <div key={competitor.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, background: "var(--surface)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
                      <div>
                        <b style={{ fontSize: 13 }}>Nós × {competitor.name}</b>
                        <small style={{ display: "block", color: "var(--muted-foreground)" }}>{competitor.positioning || "—"}</small>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "color-mix(in oklab, #10794F 14%, transparent)", color: "#10794F" }}>{wins} a favor</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "color-mix(in oklab, #D64545 14%, transparent)", color: "#D64545" }}>{losses} contra</span>
                      </div>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ color: "var(--muted-foreground)", textAlign: "left" }}>
                          <th style={{ padding: "6px 4px", fontWeight: 600 }}>Indicador</th>
                          <th style={{ padding: "6px 4px", fontWeight: 600 }}>Nós</th>
                          <th style={{ padding: "6px 4px", fontWeight: 600 }}>{competitor.name}</th>
                          <th style={{ padding: "6px 4px", fontWeight: 600 }}>Diferença</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map(l => (
                          <tr key={l.key} style={{ borderTop: "1px solid var(--border)" }}>
                            <td style={{ padding: "7px 4px" }}>{l.label}</td>
                            <td style={{ padding: "7px 4px", fontWeight: l.win === "nós" ? 700 : 500, color: l.win === "nós" ? "#10794F" : "inherit" }}>{fmt(l.us, l.unit)}</td>
                            <td style={{ padding: "7px 4px", fontWeight: l.win === "eles" ? 700 : 500, color: l.win === "eles" ? "#D64545" : "inherit" }}>{fmt(l.them, l.unit)}</td>
                            <td style={{ padding: "7px 4px", color: "var(--muted-foreground)" }}>
                              {l.diff === null ? "—" : `${l.diff > 0 ? "+" : ""}${l.diff}%`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="swin-sec-t">{selected ? "Editar registro" : "Novo registro"}</div>
              <div className="swin-grid">
                <WinField label="Nome"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></WinField>
                <WinField label="Site / perfil"><input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://" /></WinField>
                <WinField label="Nível de ameaça" hint="Quanto ele pressiona nosso posicionamento.">
                  <select value={form.threat_level} onChange={e => setForm({ ...form, threat_level: e.target.value })}>
                    <option>Alta</option><option>Média</option><option>Baixa</option>
                  </select>
                </WinField>
                <WinField label="Faixa de preço">
                  <select value={form.price_level} onChange={e => setForm({ ...form, price_level: e.target.value })}>
                    <option>Baixo</option><option>Médio</option><option>Alto</option><option>Premium</option>
                  </select>
                </WinField>
                <WinField label="Posicionamento" hint="Como se apresenta ao mercado." span>
                  <input value={form.positioning} onChange={e => setForm({ ...form, positioning: e.target.value })} />
                </WinField>
                <WinField label="Público atendido" hint="Quem ele atende."><input value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })} /></WinField>
                <WinField label="Canais" hint="Separe por vírgula. Ex.: Instagram, Google Ads"><input value={form.channels} onChange={e => setForm({ ...form, channels: e.target.value })} /></WinField>
                <WinField label="Pontos fortes" hint="Onde ele é bom."><textarea value={form.strengths} onChange={e => setForm({ ...form, strengths: e.target.value })} /></WinField>
                <WinField label="Gap vs. nós" hint="Onde ele perde para a gente."><textarea value={form.weaknesses} onChange={e => setForm({ ...form, weaknesses: e.target.value })} /></WinField>
                <WinField label="Diferenciais percebidos" hint="O que o mercado enxerga nele." span>
                  <textarea value={form.differentials} onChange={e => setForm({ ...form, differentials: e.target.value })} />
                </WinField>
                <WinField label="Observações" span><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></WinField>
                <WinField label="Este registro somos nós?" hint="Marque para usar estes números como base da comparação." span>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                    <input type="checkbox" checked={form.is_us} onChange={e => setForm({ ...form, is_us: e.target.checked })} />
                    Usar como “Nós” na comparação
                  </label>
                </WinField>
              </div>

              <div className="swin-sec-t" style={{ marginTop: 18 }}>Indicadores para comparação</div>
              <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: "2px 0 10px" }}>
                Preencha só o que você conseguir levantar. A comparação usa apenas os campos preenchidos dos dois lados.
              </p>
              <div className="swin-grid">
                {catalog.map(m => (
                  <WinField key={m.key} label={m.label} hint={m.unit ? `Em ${m.unit}` : undefined}>
                    <input
                      inputMode="decimal"
                      value={metrics[m.key] ?? ""}
                      onChange={e => setMetrics({ ...metrics, [m.key]: e.target.value })}
                      placeholder={ourValues[m.key] !== undefined ? `Nosso: ${ourValues[m.key]}` : ""}
                    />
                  </WinField>
                ))}
              </div>
            </>
          )}
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
