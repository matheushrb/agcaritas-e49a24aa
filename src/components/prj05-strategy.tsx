import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BookOpen, Pencil, LayoutGrid, Users, Filter, Target, ListChecks,
  ThumbsUp, ThumbsDown, ArrowUpCircle, AlertOctagon, Check, Calendar,
  ChevronLeft, ChevronRight, Plus, Trash2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import "@/prj05.css";

const sb = supabase as any;

const initials = (n: string) =>
  (n || "?").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

const toList = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
const fromCsv = (v: string) => v.split(",").map(s => s.trim()).filter(Boolean);

const fmtDate = (d?: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "";

async function orgId(): Promise<string> {
  const { data } = await sb.from("profiles").select("organization_id").maybeSingle();
  if (!data?.organization_id) throw new Error("Sem organização");
  return data.organization_id as string;
}

/* ---------------------------------------------------------------- modal */

function Modal({
  open, onClose, title, onSubmit, submitLabel = "Salvar", children, wide,
}: {
  open: boolean; onClose: () => void; title: string; onSubmit: () => void;
  submitLabel?: string; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className={wide ? "sm:max-w-[720px]" : "sm:max-w-[520px]"}>
        <DialogHeader><DialogTitle className="text-base">{title}</DialogTitle></DialogHeader>
        <div className="cw grid gap-3 max-h-[65vh] overflow-y-auto pr-1">{children}</div>
        <DialogFooter>
          <button type="button" className="cw-btn cw-btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="button" className="cw-btn cw-btn-primary" onClick={onSubmit}>{submitLabel}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="cw-field">
      <label className="cw-label">{label}</label>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Empty({ text, onAdd, label }: { text: string; onAdd?: () => void; label?: string }) {
  return (
    <div style={{ padding: "18px 16px", textAlign: "center" }}>
      <p className="p5-bt" style={{ marginBottom: onAdd ? 10 : 0 }}>{text}</p>
      {onAdd && <button type="button" className="p5-save" style={{ marginTop: 0 }} onClick={onAdd}>{label ?? "Adicionar"}</button>}
    </div>
  );
}

/* ---------------------------------------------------------------- types */

type Strategy = {
  audience?: string; essence?: string[]; tone?: string; value_prop?: string; positioning?: string;
};
type SwotRow = { id: string; quadrant: string; content: string; position: number };
type PersonaRow = { id: string; name: string; role: string | null; tags: string[] | null; desires: string[] | null; pains: string[] | null; help: string | null };
type BenchRow = { id: string; name: string; positioning: string | null; strengths: string | null; weaknesses: string | null; threat_level: string };
type KpiRow = { id: string; name: string; target_value: number | null; current_value: number; unit: string | null; period: string | null; notes: string | null };
type StepRow = { id: string; title: string; due_date: string | null; status: string };

const QUADRANTS = [
  { key: "strength", title: "Forças", color: "#10B981", icon: ThumbsUp },
  { key: "weakness", title: "Fraquezas", color: "#F59E0B", icon: ThumbsDown },
  { key: "opportunity", title: "Oportunidades", color: "#2F6BEF", icon: ArrowUpCircle },
  { key: "threat", title: "Ameaças", color: "#EF4444", icon: AlertOctagon },
];

const threatClass = (t: string) => (t === "Alta" ? "red" : t === "Média" ? "amber" : "green");

/* ================================================================ main */

export function Prj05Strategy({
  projectId,
  description,
  strategy,
  onSaveBriefing,
}: {
  projectId: string;
  description: string;
  strategy?: Strategy | null;
  onSaveBriefing?: (patch: { description: string; strategy: Strategy }) => void;
}) {
  const qc = useQueryClient();
  const inv = (k: string) => qc.invalidateQueries({ queryKey: [k, projectId] });

  const list = <T,>(table: string, order: string) =>
    useQuery({
      queryKey: [table, projectId],
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

  const insert = (table: string) =>
    useMutation({
      mutationFn: async (row: Record<string, unknown>) => {
        const organization_id = await orgId();
        const { error } = await sb.from(table).insert({ ...row, organization_id, project_id: projectId });
        if (error) throw error;
      },
      onSuccess: () => inv(table),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
    });
  const update = (table: string) =>
    useMutation({
      mutationFn: async ({ id, ...patch }: any) => {
        const { error } = await sb.from(table).update(patch).eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => inv(table),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
    });
  const remove = (table: string) =>
    useMutation({
      mutationFn: async (id: string) => {
        const { error } = await sb.from(table).delete().eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => inv(table),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
    });

  const addSwot = insert("project_swot"); const delSwot = remove("project_swot");
  const addPersona = insert("project_personas"); const updPersona = update("project_personas"); const delPersona = remove("project_personas");
  const addBench = insert("project_benchmarks"); const updBench = update("project_benchmarks"); const delBench = remove("project_benchmarks");
  const addKpi = insert("project_kpis"); const updKpi = update("project_kpis"); const delKpi = remove("project_kpis");
  const addStep = insert("project_action_items"); const updStep = update("project_action_items"); const delStep = remove("project_action_items");

  /* ---------------- briefing ---------------- */
  const s: Strategy = strategy ?? {};
  const [briefOpen, setBriefOpen] = useState(false);
  const [brief, setBrief] = useState({
    description, audience: s.audience ?? "", essence: (s.essence ?? []).join(", "),
    tone: s.tone ?? "", value_prop: s.value_prop ?? "", positioning: s.positioning ?? "",
  });
  const openBrief = () => {
    setBrief({
      description, audience: s.audience ?? "", essence: (s.essence ?? []).join(", "),
      tone: s.tone ?? "", value_prop: s.value_prop ?? "", positioning: s.positioning ?? "",
    });
    setBriefOpen(true);
  };

  /* ---------------- swot inline add ---------------- */
  const [swotDraft, setSwotDraft] = useState<Record<string, string>>({});

  /* ---------------- personas ---------------- */
  const emptyPersona = { name: "", role: "", tags: "", desires: "", pains: "", help: "" };
  const [personaOpen, setPersonaOpen] = useState(false);
  const [personaEdit, setPersonaEdit] = useState<string | null>(null);
  const [personaForm, setPersonaForm] = useState({ ...emptyPersona });
  const [page, setPage] = useState(0);
  const maxPage = Math.max(0, Math.ceil(personas.length / 2) - 1);
  const shown = personas.slice(page * 2, page * 2 + 2);

  /* ---------------- benchmarks ---------------- */
  const emptyBench = { name: "", positioning: "", strengths: "", weaknesses: "", threat_level: "Média" };
  const [benchOpen, setBenchOpen] = useState(false);
  const [benchEdit, setBenchEdit] = useState<string | null>(null);
  const [benchForm, setBenchForm] = useState({ ...emptyBench });

  /* ---------------- kpis ---------------- */
  const emptyKpi = { name: "", target_value: "", current_value: "", unit: "", period: "", notes: "" };
  const [kpiOpen, setKpiOpen] = useState(false);
  const [kpiEdit, setKpiEdit] = useState<string | null>(null);
  const [kpiForm, setKpiForm] = useState({ ...emptyKpi });

  /* ---------------- steps ---------------- */
  const [stepOpen, setStepOpen] = useState(false);
  const [stepForm, setStepForm] = useState({ title: "", due_date: "" });

  const kpiAvg = useMemo(() => {
    const withTarget = kpis.filter(k => Number(k.target_value ?? 0) > 0);
    if (!withTarget.length) return null;
    const sum = withTarget.reduce((a, k) => a + Math.min(100, (Number(k.current_value) / Number(k.target_value)) * 100), 0);
    return Math.round(sum / withTarget.length);
  }, [kpis]);

  return (
    <div className="prj05">
      <div className="p5-grid">
        {/* 1. Briefing */}
        <section className="p5-card">
          <div className="p5-card-h">
            <div className="p5-ht"><BookOpen /><span className="p5-card-t">1. Briefing e posicionamento</span></div>
            <button type="button" className="p5-ghost" onClick={openBrief}><Pencil /></button>
          </div>
          {!description?.trim() && !s.audience && !s.tone && !s.value_prop && !s.positioning && !(s.essence ?? []).length ? (
            <Empty text="Nenhuma informação de posicionamento preenchida." onAdd={openBrief} label="Preencher briefing" />
          ) : (
            <div className="p5-brief">
              <div>
                <div className="p5-bl">Propósito</div>
                <p className="p5-bt">{description?.trim() || "—"}</p>
              </div>
              <div>
                <div className="p5-bl">Público-alvo principal</div>
                <p className="p5-bt">{s.audience || "—"}</p>
              </div>
              <div>
                <div className="p5-bl">Essência da marca</div>
                {(s.essence ?? []).length
                  ? <div className="p5-chips">{(s.essence ?? []).map(c => <span key={c} className="p5-chip">{c}</span>)}</div>
                  : <p className="p5-bt">—</p>}
              </div>
              <div>
                <div className="p5-bl">Tom de voz</div>
                <p className="p5-bt">{s.tone || "—"}</p>
              </div>
              <div>
                <div className="p5-bl">Proposta de valor</div>
                <p className="p5-bt">{s.value_prop || "—"}</p>
              </div>
              <div>
                <div className="p5-bl">Posicionamento</div>
                <p className="p5-bt">{s.positioning || "—"}</p>
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
              const items = swot.filter(i => i.quadrant === q.key);
              return (
                <div key={q.key} className="p5-sw">
                  <div className="p5-sw-h">
                    <span className="p5-dot" style={{ background: q.color }}><Icon /></span>
                    <b>{q.title}</b>
                  </div>
                  <ul>
                    {items.map(i => (
                      <li key={i.id} className="p5-sw-item">
                        <span>{i.content}</span>
                        <button type="button" className="p5-x" onClick={() => delSwot.mutate(i.id)}><Trash2 /></button>
                      </li>
                    ))}
                  </ul>
                  <input
                    className="p5-inline"
                    placeholder="+ adicionar item"
                    value={swotDraft[q.key] ?? ""}
                    onChange={e => setSwotDraft({ ...swotDraft, [q.key]: e.target.value })}
                    onKeyDown={e => {
                      if (e.key !== "Enter") return;
                      const v = (swotDraft[q.key] ?? "").trim();
                      if (!v) return;
                      addSwot.mutate({ quadrant: q.key, content: v, position: items.length });
                      setSwotDraft({ ...swotDraft, [q.key]: "" });
                    }}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. Personas */}
        <section className="p5-card">
          <div className="p5-card-h">
            <div className="p5-ht"><Users /><span className="p5-card-t">3. Personas principais</span></div>
            <button
              type="button" className="p5-link"
              onClick={() => { setPersonaEdit(null); setPersonaForm({ ...emptyPersona }); setPersonaOpen(true); }}
            >
              + Nova persona
            </button>
          </div>
          {personas.length === 0 ? (
            <Empty
              text="Nenhuma persona cadastrada."
              onAdd={() => { setPersonaEdit(null); setPersonaForm({ ...emptyPersona }); setPersonaOpen(true); }}
              label="Criar persona"
            />
          ) : (
            <div className="p5-personas">
              <div className="p5-pgrid">
                {shown.map(p => (
                  <div key={p.id} className="p5-persona">
                    <div className="p5-p-top">
                      <span className="p5-av">{initials(p.name)}</span>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="p5-p-name">{p.name}</div>
                        <div className="p5-p-role">{p.role || "—"}</div>
                        {toList(p.tags).length > 0 && (
                          <div className="p5-chips" style={{ marginTop: 6 }}>
                            {toList(p.tags).map(t => <span key={t} className="p5-chip">{t}</span>)}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          type="button" className="p5-ghost"
                          onClick={() => {
                            setPersonaEdit(p.id);
                            setPersonaForm({
                              name: p.name, role: p.role ?? "", tags: toList(p.tags).join(", "),
                              desires: toList(p.desires).join("\n"), pains: toList(p.pains).join("\n"), help: p.help ?? "",
                            });
                            setPersonaOpen(true);
                          }}
                        ><Pencil /></button>
                        <button type="button" className="p5-ghost" onClick={() => delPersona.mutate(p.id)}><Trash2 /></button>
                      </div>
                    </div>
                    <div className="p5-p-sec"><b>Objetivos</b><span>{toList(p.desires).join(" · ") || "—"}</span></div>
                    <div className="p5-p-sec"><b>Desafios</b><span>{toList(p.pains).join(" · ") || "—"}</span></div>
                    <div className="p5-p-sec"><b>Como ajudamos</b><span>{p.help || "—"}</span></div>
                  </div>
                ))}
              </div>
              {personas.length > 2 && (
                <div className="p5-nav">
                  <button type="button" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}><ChevronLeft /></button>
                  <button type="button" disabled={page >= maxPage} onClick={() => setPage(p => Math.min(maxPage, p + 1))}><ChevronRight /></button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="p5-grid">
        {/* 4. Concorrentes */}
        <section className="p5-card">
          <div className="p5-card-h">
            <div className="p5-ht"><Filter /><span className="p5-card-t">4. Concorrentes</span></div>
            <button
              type="button" className="p5-link"
              onClick={() => { setBenchEdit(null); setBenchForm({ ...emptyBench }); setBenchOpen(true); }}
            >
              + Novo concorrente
            </button>
          </div>
          {benchmarks.length === 0 ? (
            <Empty
              text="Nenhum concorrente mapeado."
              onAdd={() => { setBenchEdit(null); setBenchForm({ ...emptyBench }); setBenchOpen(true); }}
              label="Adicionar concorrente"
            />
          ) : (
            <table className="p5-table">
              <thead>
                <tr>
                  <th>Concorrente</th><th>Posicionamento</th><th>Pontos fortes</th><th>Gap vs. nós</th><th>Ameaça</th><th />
                </tr>
              </thead>
              <tbody>
                {benchmarks.map(c => (
                  <tr key={c.id}>
                    <td><div className="p5-comp"><span className="p5-logo">{initials(c.name)}</span><b>{c.name}</b></div></td>
                    <td>{c.positioning || "—"}</td>
                    <td>{c.strengths || "—"}</td>
                    <td>{c.weaknesses || "—"}</td>
                    <td><span className={`p5-badge ${threatClass(c.threat_level)}`}>{c.threat_level}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button
                        type="button" className="p5-ghost"
                        onClick={() => {
                          setBenchEdit(c.id);
                          setBenchForm({
                            name: c.name, positioning: c.positioning ?? "", strengths: c.strengths ?? "",
                            weaknesses: c.weaknesses ?? "", threat_level: c.threat_level ?? "Média",
                          });
                          setBenchOpen(true);
                        }}
                      ><Pencil /></button>
                      <button type="button" className="p5-ghost" style={{ marginLeft: 4 }} onClick={() => delBench.mutate(c.id)}><Trash2 /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* 5. KPIs estratégicos */}
        <section className="p5-card">
          <div className="p5-card-h">
            <div className="p5-ht"><Target /><span className="p5-card-t">5. KPIs estratégicos</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {kpiAvg !== null && <span className="p5-badge blue">Média {kpiAvg}%</span>}
              <button
                type="button" className="p5-link"
                onClick={() => { setKpiEdit(null); setKpiForm({ ...emptyKpi }); setKpiOpen(true); }}
              >
                + Novo KPI
              </button>
            </div>
          </div>
          {kpis.length === 0 ? (
            <Empty
              text="Nenhum indicador definido."
              onAdd={() => { setKpiEdit(null); setKpiForm({ ...emptyKpi }); setKpiOpen(true); }}
              label="Criar KPI"
            />
          ) : (
            <div className="p5-kpis">
              {kpis.map(k => {
                const target = Number(k.target_value ?? 0);
                const cur = Number(k.current_value ?? 0);
                const pct = target > 0 ? Math.min(100, Math.round((cur / target) * 100)) : 0;
                const tone = pct >= 80 ? "green" : pct >= 50 ? "amber" : "red";
                return (
                  <div key={k.id} className="p5-kpi">
                    <div className="p5-kpi-top">
                      <div style={{ minWidth: 0 }}>
                        <div className="p5-kpi-name">{k.name}</div>
                        <div className="p5-kpi-sub">
                          {target > 0 ? `Meta ${target}${k.unit ?? ""}` : "Sem meta"}{k.period ? ` · ${k.period}` : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span className={`p5-badge ${tone}`}>{target > 0 ? `${pct}%` : "—"}</span>
                        <button
                          type="button" className="p5-ghost"
                          onClick={() => {
                            setKpiEdit(k.id);
                            setKpiForm({
                              name: k.name, target_value: String(k.target_value ?? ""), current_value: String(k.current_value ?? ""),
                              unit: k.unit ?? "", period: k.period ?? "", notes: k.notes ?? "",
                            });
                            setKpiOpen(true);
                          }}
                        ><Pencil /></button>
                        <button type="button" className="p5-ghost" onClick={() => delKpi.mutate(k.id)}><Trash2 /></button>
                      </div>
                    </div>
                    <div className="p5-kpi-val">
                      <b>{cur}{k.unit ?? ""}</b>
                      {target > 0 && <span>/ {target}{k.unit ?? ""}</span>}
                    </div>
                    <div className={`p5-kpi-bar ${tone}`}><i style={{ width: `${pct}%` }} /></div>
                    <div className="p5-kpi-actions">
                      <input
                        className="p5-inline p5-kpi-input"
                        type="number"
                        defaultValue={cur}
                        key={`${k.id}-${cur}`}
                        onBlur={e => {
                          const v = Number(e.target.value);
                          if (!Number.isNaN(v) && v !== cur) updKpi.mutate({ id: k.id, current_value: v });
                        }}
                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      />
                      <span className="p5-kpi-hint">valor atual</span>
                    </div>
                    {k.notes && <p className="p5-kpi-note">{k.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 6. Próximos passos */}
        <section className="p5-card">
          <div className="p5-card-h">
            <div className="p5-ht"><ListChecks /><span className="p5-card-t">6. Próximos passos estratégicos</span></div>
            <button type="button" className="p5-link" onClick={() => { setStepForm({ title: "", due_date: "" }); setStepOpen(true); }}>
              + Novo passo
            </button>
          </div>
          {steps.length === 0 ? (
            <Empty text="Nenhum próximo passo definido." onAdd={() => { setStepForm({ title: "", due_date: "" }); setStepOpen(true); }} label="Adicionar passo" />
          ) : (
            <div className="p5-steps">
              {steps.map(st => {
                const done = st.status === "done";
                return (
                  <div key={st.id} className={`p5-step${done ? " done" : ""}`}>
                    <button
                      type="button"
                      className={`p5-check${done ? " on" : ""}`}
                      onClick={() => updStep.mutate({ id: st.id, status: done ? "todo" : "done" })}
                    >
                      {done && <Check />}
                    </button>
                    <span className="p5-step-t">{st.title}</span>
                    {st.due_date && <span className="p5-date"><Calendar />{fmtDate(st.due_date)}</span>}
                    <button type="button" className="p5-ghost" onClick={() => delStep.mutate(st.id)}><Trash2 /></button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="p5-foot">
            <button type="button" onClick={() => { setStepForm({ title: "", due_date: "" }); setStepOpen(true); }}>
              <Plus /> Adicionar iniciativa
            </button>
          </div>
        </section>
      </div>

      {/* ---------------- dialogs ---------------- */}

      <Modal
        open={briefOpen} onClose={() => setBriefOpen(false)} wide
        title="Briefing e posicionamento"
        onSubmit={() => {
          onSaveBriefing?.({
            description: brief.description,
            strategy: {
              audience: brief.audience.trim() || undefined,
              essence: fromCsv(brief.essence),
              tone: brief.tone.trim() || undefined,
              value_prop: brief.value_prop.trim() || undefined,
              positioning: brief.positioning.trim() || undefined,
            },
          });
          setBriefOpen(false);
        }}
      >
        <Field label="Propósito" hint="Por que este projeto/marca existe.">
          <textarea className="cw-input" rows={3} value={brief.description} onChange={e => setBrief({ ...brief, description: e.target.value })} />
        </Field>
        <Field label="Público-alvo principal" hint="Quem queremos alcançar (cargo, porte, segmento).">
          <textarea className="cw-input" rows={2} value={brief.audience} onChange={e => setBrief({ ...brief, audience: e.target.value })} />
        </Field>
        <Field label="Essência da marca" hint="Separe os atributos por vírgula. Ex.: Criativa, Estratégica, Confiável">
          <input className="cw-input" value={brief.essence} onChange={e => setBrief({ ...brief, essence: e.target.value })} />
        </Field>
        <Field label="Tom de voz" hint="Como a marca fala. Ex.: Inspirador, claro e próximo.">
          <input className="cw-input" value={brief.tone} onChange={e => setBrief({ ...brief, tone: e.target.value })} />
        </Field>
        <Field label="Proposta de valor" hint="O que entregamos de único para esse público.">
          <textarea className="cw-input" rows={2} value={brief.value_prop} onChange={e => setBrief({ ...brief, value_prop: e.target.value })} />
        </Field>
        <Field label="Posicionamento" hint="Frase curta de posicionamento. Ex.: Criatividade com método.">
          <input className="cw-input" value={brief.positioning} onChange={e => setBrief({ ...brief, positioning: e.target.value })} />
        </Field>
      </Modal>

      <Modal
        open={personaOpen} onClose={() => setPersonaOpen(false)} wide
        title={personaEdit ? "Editar persona" : "Nova persona"}
        onSubmit={() => {
          if (!personaForm.name.trim()) { toast.error("Informe o nome da persona"); return; }
          const row = {
            name: personaForm.name.trim(),
            role: personaForm.role.trim() || null,
            tags: fromCsv(personaForm.tags),
            desires: personaForm.desires.split("\n").map(v => v.trim()).filter(Boolean),
            pains: personaForm.pains.split("\n").map(v => v.trim()).filter(Boolean),
            help: personaForm.help.trim() || null,
          };
          if (personaEdit) updPersona.mutate({ id: personaEdit, ...row });
          else addPersona.mutate(row);
          setPersonaOpen(false);
        }}
      >
        <Field label="Nome"><input className="cw-input" value={personaForm.name} onChange={e => setPersonaForm({ ...personaForm, name: e.target.value })} /></Field>
        <Field label="Cargo / contexto" hint="Ex.: CMO | Tech B2B">
          <input className="cw-input" value={personaForm.role} onChange={e => setPersonaForm({ ...personaForm, role: e.target.value })} />
        </Field>
        <Field label="Características" hint="Separe por vírgula. Ex.: Estratégica, Exigente, Orientada a ROI">
          <input className="cw-input" value={personaForm.tags} onChange={e => setPersonaForm({ ...personaForm, tags: e.target.value })} />
        </Field>
        <Field label="Objetivos" hint="Um por linha.">
          <textarea className="cw-input" rows={3} value={personaForm.desires} onChange={e => setPersonaForm({ ...personaForm, desires: e.target.value })} />
        </Field>
        <Field label="Desafios" hint="Um por linha.">
          <textarea className="cw-input" rows={3} value={personaForm.pains} onChange={e => setPersonaForm({ ...personaForm, pains: e.target.value })} />
        </Field>
        <Field label="Como ajudamos">
          <textarea className="cw-input" rows={2} value={personaForm.help} onChange={e => setPersonaForm({ ...personaForm, help: e.target.value })} />
        </Field>
      </Modal>

      <Modal
        open={benchOpen} onClose={() => setBenchOpen(false)} wide
        title={benchEdit ? "Editar concorrente" : "Novo concorrente"}
        onSubmit={() => {
          if (!benchForm.name.trim()) { toast.error("Informe o nome do concorrente"); return; }
          const row = {
            name: benchForm.name.trim(),
            positioning: benchForm.positioning.trim() || null,
            strengths: benchForm.strengths.trim() || null,
            weaknesses: benchForm.weaknesses.trim() || null,
            threat_level: benchForm.threat_level,
          };
          if (benchEdit) updBench.mutate({ id: benchEdit, ...row });
          else addBench.mutate(row);
          setBenchOpen(false);
        }}
      >
        <Field label="Nome"><input className="cw-input" value={benchForm.name} onChange={e => setBenchForm({ ...benchForm, name: e.target.value })} /></Field>
        <Field label="Posicionamento" hint="Como o concorrente se apresenta ao mercado.">
          <input className="cw-input" value={benchForm.positioning} onChange={e => setBenchForm({ ...benchForm, positioning: e.target.value })} />
        </Field>
        <Field label="Pontos fortes">
          <textarea className="cw-input" rows={2} value={benchForm.strengths} onChange={e => setBenchForm({ ...benchForm, strengths: e.target.value })} />
        </Field>
        <Field label="Gap vs. nós" hint="Onde ele perde para a gente.">
          <textarea className="cw-input" rows={2} value={benchForm.weaknesses} onChange={e => setBenchForm({ ...benchForm, weaknesses: e.target.value })} />
        </Field>
        <Field label="Nível de ameaça">
          <select className="cw-select" value={benchForm.threat_level} onChange={e => setBenchForm({ ...benchForm, threat_level: e.target.value })}>
            <option>Alta</option><option>Média</option><option>Baixa</option>
          </select>
        </Field>
      </Modal>

      <Modal
        open={kpiOpen} onClose={() => setKpiOpen(false)}
        title={kpiEdit ? "Editar KPI" : "Novo KPI"}
        onSubmit={() => {
          if (!kpiForm.name.trim()) { toast.error("Informe o nome do indicador"); return; }
          const row = {
            name: kpiForm.name.trim(),
            target_value: kpiForm.target_value ? Number(kpiForm.target_value) : null,
            current_value: kpiForm.current_value ? Number(kpiForm.current_value) : 0,
            unit: kpiForm.unit.trim() || null,
            period: kpiForm.period.trim() || null,
            notes: kpiForm.notes.trim() || null,
          };
          if (kpiEdit) updKpi.mutate({ id: kpiEdit, ...row });
          else addKpi.mutate({ ...row, order_index: kpis.length });
          setKpiOpen(false);
        }}
      >
        <Field label="Indicador" hint="Ex.: Reconhecimento de marca, NPS, Leads qualificados/mês">
          <input className="cw-input" value={kpiForm.name} onChange={e => setKpiForm({ ...kpiForm, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Meta"><input type="number" className="cw-input" value={kpiForm.target_value} onChange={e => setKpiForm({ ...kpiForm, target_value: e.target.value })} /></Field>
          <Field label="Valor atual"><input type="number" className="cw-input" value={kpiForm.current_value} onChange={e => setKpiForm({ ...kpiForm, current_value: e.target.value })} /></Field>
          <Field label="Unidade"><input className="cw-input" placeholder="%, R$, pts" value={kpiForm.unit} onChange={e => setKpiForm({ ...kpiForm, unit: e.target.value })} /></Field>
        </div>
        <Field label="Período" hint="Ex.: Mensal, 2026-Q1">
          <input className="cw-input" value={kpiForm.period} onChange={e => setKpiForm({ ...kpiForm, period: e.target.value })} />
        </Field>
        <Field label="Observação">
          <textarea className="cw-input" rows={2} value={kpiForm.notes} onChange={e => setKpiForm({ ...kpiForm, notes: e.target.value })} />
        </Field>
      </Modal>

      <Modal
        open={stepOpen} onClose={() => setStepOpen(false)}
        title="Novo passo estratégico"
        onSubmit={() => {
          if (!stepForm.title.trim()) { toast.error("Informe a iniciativa"); return; }
          addStep.mutate({
            title: stepForm.title.trim(),
            due_date: stepForm.due_date || null,
            status: "todo",
            order_index: steps.length,
          });
          setStepOpen(false);
        }}
      >
        <Field label="Iniciativa"><input className="cw-input" value={stepForm.title} onChange={e => setStepForm({ ...stepForm, title: e.target.value })} /></Field>
        <Field label="Prazo"><input type="date" className="cw-input" value={stepForm.due_date} onChange={e => setStepForm({ ...stepForm, due_date: e.target.value })} /></Field>
      </Modal>
    </div>
  );
}
