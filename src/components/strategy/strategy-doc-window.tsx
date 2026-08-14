import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Printer, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ToolWindow } from "./tool-window";
import { fetchBriefingTemplates, type BriefingData } from "@/lib/briefing";
import { BRAND_SCHEMA, POSITIONING_SCHEMA, splitList, type DocSchema, type StrategyDocData } from "@/lib/strategy-docs";
import "@/strategy-win.css";

const sb = supabase as any;

export type DocStrategy = {
  audience?: string; essence?: string[]; tone?: string; value_prop?: string; positioning?: string;
};

type SwotRow = { id: string; quadrant: string; content: string; position: number };
type PersonaRow = { id: string; name: string; role: string | null; tags: string[] | null; desires: string[] | null; pains: string[] | null; help: string | null };
type BenchRow = { id: string; name: string; positioning: string | null; strengths: string | null; weaknesses: string | null; threat_level: string };
type KpiRow = { id: string; name: string; target_value: number | null; current_value: number; unit: string | null; period: string | null; notes: string | null };
type StepRow = { id: string; title: string; due_date: string | null; status: string };

const QUAD = [
  { key: "strength", title: "Forças" },
  { key: "weakness", title: "Fraquezas" },
  { key: "opportunity", title: "Oportunidades" },
  { key: "threat", title: "Ameaças" },
];

function schemaLines(schema: DocSchema, data: StrategyDocData, heading: string): string[] {
  const L: string[] = [`## ${heading}`, ""];
  schema.sections.forEach(sec => {
    L.push(`### ${sec.title}`, "");
    sec.fields.forEach(f => {
      const raw = String(data?.[f.key] ?? "").trim();
      const val = f.type === "chips" || f.type === "colors" ? splitList(raw).join(", ") : raw;
      L.push(`**${f.label}:** ${val || "—"}`);
    });
    L.push("");
  });
  return L;
}

function SchemaBlock({ schema, data, heading }: { schema: DocSchema; data: StrategyDocData; heading: string }) {
  return (
    <>
      <h2>{heading}</h2>
      {schema.sections.map(sec => (
        <div key={sec.title}>
          <h3>{sec.title}</h3>
          {sec.fields.map(f => {
            const raw = String(data?.[f.key] ?? "").trim();
            if (f.type === "chips" || f.type === "colors") {
              const items = splitList(raw);
              return (
                <div className="doc-q" key={f.key}>
                  <b>{f.label}</b>
                  {items.length
                    ? <div className="doc-chips">{items.map(c => <span key={c} className="doc-chip">{c}</span>)}</div>
                    : <p className="empty">Não preenchido</p>}
                </div>
              );
            }
            return (
              <div className="doc-q" key={f.key}>
                <b>{f.label}</b>
                <p className={raw ? "" : "empty"}>{raw || "Não preenchido"}</p>
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

const SECTIONS = [
  { key: "brief", label: "Briefing" },
  { key: "positioning", label: "Posicionamento" },
  { key: "swot", label: "SWOT" },
  { key: "personas", label: "Personas" },
  { key: "bench", label: "Concorrentes" },
  { key: "brand", label: "Manual de marca" },
  { key: "kpis", label: "KPIs" },
  { key: "steps", label: "Próximos passos" },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

const toList = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
const fmtDate = (d?: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "";

export function StrategyDocWindow({
  open, onClose, projectId, projectName, description, strategy, briefing, briefingTemplateId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  description: string;
  strategy: DocStrategy;
  briefing?: BriefingData | null;
  briefingTemplateId?: string | null;
}) {
  const docRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [on, setOn] = useState<Record<SectionKey, boolean>>({
    brief: true, positioning: true, swot: true, personas: true, bench: true, brand: true, kpis: true, steps: true,
  });

  const list = <T,>(table: string, order: string) =>
    useQuery({
      queryKey: ["doc", table, projectId],
      enabled: open,
      queryFn: async (): Promise<T[]> => {
        const { data, error } = await sb.from(table).select("*").eq("project_id", projectId).order(order, { ascending: true });
        if (error) throw error;
        return (data ?? []) as T[];
      },
    });

  const { data: swot = [] } = list<SwotRow>("project_swot", "position");
  const { data: personas = [] } = list<PersonaRow>("project_personas", "created_at");
  const { data: benchmarks = [] } = list<BenchRow>("project_benchmarks", "created_at");
  const { data: kpis = [] } = list<KpiRow>("project_kpis", "order_index");
  const { data: steps = [] } = list<StepRow>("project_action_items", "order_index");

  const { data: docs = {} } = useQuery({
    queryKey: ["doc", "project_strategy_docs", projectId],
    enabled: open,
    queryFn: async (): Promise<Record<string, StrategyDocData>> => {
      const { data, error } = await sb.from("project_strategy_docs").select("kind, data").eq("project_id", projectId);
      if (error) throw error;
      const out: Record<string, StrategyDocData> = {};
      (data ?? []).forEach((r: any) => { out[r.kind] = (r.data ?? {}) as StrategyDocData; });
      return out;
    },
  });
  const positioningDoc = docs["positioning"] ?? {};
  const brandDoc = docs["brand_manual"] ?? {};



  const { data: templates = [] } = useQuery({
    queryKey: ["briefing_templates", "briefing"],
    queryFn: async () => (await fetchBriefingTemplates()).filter(t => t.template_type === "briefing"),
    enabled: open && !!briefingTemplateId,
  });
  const tpl = useMemo(
    () => templates.find(t => t.id === briefingTemplateId) ?? null,
    [templates, briefingTemplateId],
  );

  const today = new Date().toLocaleDateString("pt-BR");

  /* ------------------------------------------------ resumo executivo */
  const summary = useMemo(() => {
    const bits: string[] = [];
    if (strategy.positioning) bits.push(strategy.positioning.trim());
    if (strategy.audience) bits.push(`Falamos com ${strategy.audience.trim()}`);
    if (strategy.value_prop) bits.push(strategy.value_prop.trim());
    if (strategy.tone) bits.push(`Tom de voz: ${strategy.tone.trim()}`);
    const done = steps.filter(s => s.status === "done").length;
    if (steps.length) bits.push(`${done}/${steps.length} passos concluídos`);
    return bits;
  }, [strategy, steps]);

  const kpiAvg = useMemo(() => {
    const t = kpis.filter(k => Number(k.target_value ?? 0) > 0);
    if (!t.length) return null;
    return Math.round(t.reduce((a, k) => a + Math.min(100, (Number(k.current_value) / Number(k.target_value)) * 100), 0) / t.length);
  }, [kpis]);

  /* ------------------------------------------------ markdown */
  const markdown = useMemo(() => {
    const L: string[] = [];
    L.push(`# Roteiro estratégico — ${projectName}`, "", `_Gerado em ${today}_`, "");
    if (summary.length) {
      L.push("## Resumo executivo", "");
      summary.forEach(b => L.push(`- ${b}`));
      L.push("");
    }
    if (on.brief) {
      L.push("## 1. Briefing e posicionamento", "");
      L.push(`**Propósito:** ${description?.trim() || "—"}`);
      L.push(`**Público-alvo:** ${strategy.audience || "—"}`);
      L.push(`**Essência:** ${(strategy.essence ?? []).join(", ") || "—"}`);
      L.push(`**Tom de voz:** ${strategy.tone || "—"}`);
      L.push(`**Proposta de valor:** ${strategy.value_prop || "—"}`);
      L.push(`**Posicionamento:** ${strategy.positioning || "—"}`, "");
      tpl?.sections.forEach(sec => {
        L.push(`### ${sec.title}`, "");
        (sec.fields ?? []).forEach(f => L.push(`**${f.label}:** ${String(briefing?.[f.key] ?? "").trim() || "—"}`));
        L.push("");
      });
    }
    if (on.positioning) {
      L.push(...schemaLines(POSITIONING_SCHEMA, positioningDoc, "2. Pesquisa e posicionamento"));
    }
    if (on.swot) {
      L.push("## 2. Análise SWOT", "");
      QUAD.forEach(q => {
        L.push(`### ${q.title}`);
        const items = swot.filter(i => i.quadrant === q.key);
        if (!items.length) L.push("- —");
        items.forEach(i => L.push(`- ${i.content}`));
        L.push("");
      });
    }
    if (on.personas) {
      L.push("## 3. Personas", "");
      if (!personas.length) L.push("- Nenhuma persona cadastrada.", "");
      personas.forEach(p => {
        L.push(`### ${p.name}${p.role ? ` — ${p.role}` : ""}`);
        if (toList(p.tags).length) L.push(`Tags: ${toList(p.tags).join(", ")}`);
        L.push(`- Objetivos: ${toList(p.desires).join(" · ") || "—"}`);
        L.push(`- Desafios: ${toList(p.pains).join(" · ") || "—"}`);
        L.push(`- Como ajudamos: ${p.help || "—"}`, "");
      });
    }
    if (on.bench) {
      L.push("## 4. Concorrentes", "");
      if (!benchmarks.length) L.push("- Nenhum concorrente mapeado.", "");
      benchmarks.forEach(c => {
        L.push(`### ${c.name} (ameaça ${c.threat_level})`);
        L.push(`- Posicionamento: ${c.positioning || "—"}`);
        L.push(`- Pontos fortes: ${c.strengths || "—"}`);
        L.push(`- Gap vs. nós: ${c.weaknesses || "—"}`, "");
      });
    }
    if (on.brand) {
      L.push(...schemaLines(BRAND_SCHEMA, brandDoc, "5. Manual de marca"));
    }
    if (on.kpis) {
      L.push("## 5. KPIs estratégicos", "");
      if (!kpis.length) L.push("- Nenhum indicador definido.", "");
      kpis.forEach(k => {
        const t = Number(k.target_value ?? 0);
        const pct = t > 0 ? Math.round((Number(k.current_value) / t) * 100) : null;
        L.push(`- **${k.name}**: ${k.current_value}${k.unit ?? ""}${t ? ` / ${t}${k.unit ?? ""}` : ""}${pct !== null ? ` (${pct}%)` : ""}${k.period ? ` · ${k.period}` : ""}`);
      });
      L.push("");
    }
    if (on.steps) {
      L.push("## 6. Próximos passos", "");
      if (!steps.length) L.push("- Nenhum passo definido.", "");
      steps.forEach(s => L.push(`- [${s.status === "done" ? "x" : " "}] ${s.title}${s.due_date ? ` — ${fmtDate(s.due_date)}` : ""}`));
      L.push("");
    }
    return L.join("\n");
  }, [on, projectName, today, summary, description, strategy, tpl, briefing, swot, personas, benchmarks, kpis, steps, positioningDoc, brandDoc]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success("Roteiro copiado em Markdown");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const print = () => {
    const html = docRef.current?.innerHTML;
    if (!html) return;
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) { toast.error("Permita pop-ups para exportar o documento"); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Roteiro estratégico — ${projectName}</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;color:#1c2026;max-width:760px;margin:32px auto;padding:0 28px;font-size:12.5px;line-height:1.6}
  h1{font-size:22px;margin:6px 0 2px}
  h2{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6b7280;margin:22px 0 8px}
  h3{font-size:13px;margin:14px 0 4px}
  hr{border:0;border-top:1px solid #e5e7eb;margin:18px 0}
  .doc-brand{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#2F6BEF;font-weight:700}
  .doc-sub{font-size:11.5px;color:#6b7280}
  .doc-q b{display:block;font-size:12px}
  .doc-q p{margin:0 0 10px;white-space:pre-wrap}
  .doc-q p.empty{color:#9ca3af;font-style:italic}
  .doc-chip{display:inline-block;border:1px solid #e5e7eb;border-radius:999px;padding:2px 9px;margin:0 4px 4px 0;font-size:10.5px;color:#6b7280}
  table{width:100%;border-collapse:collapse;font-size:11.5px}
  th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left;vertical-align:top}
  ul{margin:0 0 10px;padding-left:18px}
  .doc-foot{margin-top:24px;font-size:10.5px;color:#6b7280}
</style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const Q = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="doc-q">
      <b>{label}</b>
      <p className={value?.trim() ? "" : "empty"}>{value?.trim() || "Não preenchido"}</p>
    </div>
  );

  return (
    <ToolWindow
      open={open}
      onClose={onClose}
      icon={FileText}
      title="Documento estratégico consolidado"
      subtitle={projectName}
      size="full"
      headerRight={
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {SECTIONS.map(s => (
            <button
              key={s.key}
              type="button"
              className={`swin-btn${on[s.key] ? " primary" : ""}`}
              style={{ height: 28, padding: "0 10px", fontSize: 11.5 }}
              onClick={() => setOn(o => ({ ...o, [s.key]: !o[s.key] }))}
            >
              {s.label}
            </button>
          ))}
        </div>
      }
      footer={
        <>
          <small>Reúne briefing, SWOT, personas, concorrentes, KPIs e próximos passos em um roteiro único.</small>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="swin-btn" onClick={copy}>
              {copied ? <Check /> : <Copy />} Copiar Markdown
            </button>
            <button type="button" className="swin-btn primary" onClick={print}><Printer /> Exportar / imprimir</button>
          </div>
        </>
      }
    >
      <div className="swin-doc-wrap" style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        <article className="swin-doc" ref={docRef}>
          <div className="doc-brand">Roteiro estratégico</div>
          <h1>{projectName || "Projeto"}</h1>
          <div className="doc-sub">Documento consolidado · {today}</div>
          <hr />

          {summary.length > 0 && (
            <>
              <h2>Resumo executivo</h2>
              <ul>{summary.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </>
          )}

          {on.brief && (
            <>
              <h2>1. Briefing e posicionamento</h2>
              <Q label="Propósito" value={description} />
              <Q label="Público-alvo principal" value={strategy.audience} />
              <div className="doc-q">
                <b>Essência da marca</b>
                {(strategy.essence ?? []).length
                  ? <div className="doc-chips">{(strategy.essence ?? []).map(c => <span key={c} className="doc-chip">{c}</span>)}</div>
                  : <p className="empty">Não preenchido</p>}
              </div>
              <Q label="Tom de voz" value={strategy.tone} />
              <Q label="Proposta de valor" value={strategy.value_prop} />
              <Q label="Posicionamento" value={strategy.positioning} />
              {tpl?.sections.map((sec, i) => (
                <div key={i}>
                  <h3>{sec.emoji ? `${sec.emoji} ` : ""}{sec.title}</h3>
                  {(sec.fields ?? []).map(f => (
                    <Q key={f.key} label={f.label} value={String(briefing?.[f.key] ?? "")} />
                  ))}
                </div>
              ))}
            </>
          )}

          {on.positioning && (
            <SchemaBlock schema={POSITIONING_SCHEMA} data={positioningDoc} heading="2. Pesquisa e posicionamento" />
          )}

          {on.swot && (
            <>
              <h2>2. Análise SWOT</h2>
              {QUAD.map(q => {
                const items = swot.filter(i => i.quadrant === q.key);
                return (
                  <div key={q.key}>
                    <h3>{q.title}</h3>
                    {items.length
                      ? <ul>{items.map(i => <li key={i.id}>{i.content}</li>)}</ul>
                      : <p className="empty" style={{ color: "var(--muted-foreground)", fontStyle: "italic" }}>Sem itens</p>}
                  </div>
                );
              })}
            </>
          )}

          {on.personas && (
            <>
              <h2>3. Personas</h2>
              {personas.length === 0 && <p className="empty">Nenhuma persona cadastrada.</p>}
              {personas.map(p => (
                <div key={p.id}>
                  <h3>{p.name}{p.role ? ` — ${p.role}` : ""}</h3>
                  {toList(p.tags).length > 0 && (
                    <div className="doc-chips">{toList(p.tags).map(t => <span key={t} className="doc-chip">{t}</span>)}</div>
                  )}
                  <ul>
                    <li><b>Objetivos:</b> {toList(p.desires).join(" · ") || "—"}</li>
                    <li><b>Desafios:</b> {toList(p.pains).join(" · ") || "—"}</li>
                    <li><b>Como ajudamos:</b> {p.help || "—"}</li>
                  </ul>
                </div>
              ))}
            </>
          )}

          {on.bench && (
            <>
              <h2>4. Concorrentes</h2>
              {benchmarks.length === 0 ? <p className="empty">Nenhum concorrente mapeado.</p> : (
                <table>
                  <thead>
                    <tr><th>Concorrente</th><th>Posicionamento</th><th>Pontos fortes</th><th>Gap vs. nós</th><th>Ameaça</th></tr>
                  </thead>
                  <tbody>
                    {benchmarks.map(c => (
                      <tr key={c.id}>
                        <td><b>{c.name}</b></td>
                        <td>{c.positioning || "—"}</td>
                        <td>{c.strengths || "—"}</td>
                        <td>{c.weaknesses || "—"}</td>
                        <td>{c.threat_level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {on.kpis && (
            <>
              <h2>5. KPIs estratégicos{kpiAvg !== null ? ` — média ${kpiAvg}%` : ""}</h2>
              {kpis.length === 0 ? <p className="empty">Nenhum indicador definido.</p> : (
                <table>
                  <thead>
                    <tr><th>Indicador</th><th>Atual</th><th>Meta</th><th>Progresso</th><th>Período</th></tr>
                  </thead>
                  <tbody>
                    {kpis.map(k => {
                      const t = Number(k.target_value ?? 0);
                      const pct = t > 0 ? Math.round((Number(k.current_value) / t) * 100) : null;
                      return (
                        <tr key={k.id}>
                          <td><b>{k.name}</b>{k.notes ? <div style={{ color: "#6b7280" }}>{k.notes}</div> : null}</td>
                          <td>{k.current_value}{k.unit ?? ""}</td>
                          <td>{t ? `${t}${k.unit ?? ""}` : "—"}</td>
                          <td>{pct !== null ? `${pct}%` : "—"}</td>
                          <td>{k.period || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          )}

          {on.steps && (
            <>
              <h2>6. Próximos passos</h2>
              {steps.length === 0 ? <p className="empty">Nenhum passo definido.</p> : (
                <ul>
                  {steps.map(s => (
                    <li key={s.id} style={{ textDecoration: s.status === "done" ? "line-through" : undefined }}>
                      {s.title}{s.due_date ? ` — ${fmtDate(s.due_date)}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <div className="doc-foot">
            Gerado automaticamente pelo Caritas · {today}
          </div>
        </article>
      </div>
    </ToolWindow>
  );
}
