import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Check, Loader2, Save } from "lucide-react";
import { ToolWindow, WinField } from "./tool-window";
import {
  fetchBriefingTemplates, type BriefingData, type BriefingField, type BriefingTemplate,
} from "@/lib/briefing";
import "@/strategy-win.css";

export type Strategy = {
  audience?: string; essence?: string[]; tone?: string; value_prop?: string; positioning?: string;
};

const BASE: { key: keyof Base; label: string; hint: string; long?: boolean; chips?: boolean }[] = [
  { key: "description", label: "Propósito", hint: "Por que este projeto/marca existe.", long: true },
  { key: "audience", label: "Público-alvo principal", hint: "Quem queremos alcançar (cargo, porte, segmento).", long: true },
  { key: "essence", label: "Essência da marca", hint: "Atributos separados por vírgula. Ex.: Criativa, Estratégica, Confiável", chips: true },
  { key: "tone", label: "Tom de voz", hint: "Como a marca fala. Ex.: Inspirador, claro e próximo." },
  { key: "value_prop", label: "Proposta de valor", hint: "O que entregamos de único para esse público.", long: true },
  { key: "positioning", label: "Posicionamento", hint: "Frase curta. Ex.: Criatividade com método." },
];

type Base = {
  description: string; audience: string; essence: string; tone: string; value_prop: string; positioning: string;
};

const fromCsv = (v: string) => v.split(",").map(s => s.trim()).filter(Boolean);

export type BriefingPatch = {
  title: string;
  description: string;
  strategy: Strategy;
  briefing: BriefingData;
  briefing_template_id: string | null;
  status: "draft" | "done";
};

export function BriefingWindow({
  open, onClose, projectName, title: initialTitle = "Briefing", status: initialStatus = "draft",
  description, strategy, briefing, templateId, onSave, showPositioning = true,
}: {
  open: boolean;
  onClose: () => void;
  projectName: string;
  title?: string;
  status?: "draft" | "done";
  description: string;
  strategy: Strategy;
  briefing: BriefingData;
  templateId: string | null;
  showPositioning?: boolean;
  /** Chamado no autosave (debounce) e ao fechar. */
  onSave: (patch: BriefingPatch) => void | Promise<void>;
}) {
  const { data: templates = [] } = useQuery({
    queryKey: ["briefing_templates", "briefing"],
    queryFn: async () => (await fetchBriefingTemplates()).filter(t => t.template_type === "briefing" && t.active !== false),
    enabled: open,
  });

  const [tplId, setTplId] = useState<string | null>(templateId);
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState<"draft" | "done">(initialStatus);
  const [data, setData] = useState<BriefingData>(briefing ?? {});
  const [base, setBase] = useState<Base>({
    description,
    audience: strategy.audience ?? "",
    essence: (strategy.essence ?? []).join(", "),
    tone: strategy.tone ?? "",
    value_prop: strategy.value_prop ?? "",
    positioning: strategy.positioning ?? "",
  });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!open) return;
    setTplId(templateId);
    setTitle(initialTitle);
    setStatus(initialStatus);
    setData(briefing ?? {});
    setBase({
      description,
      audience: strategy.audience ?? "",
      essence: (strategy.essence ?? []).join(", "),
      tone: strategy.tone ?? "",
      value_prop: strategy.value_prop ?? "",
      positioning: strategy.positioning ?? "",
    });
    setSaveState("idle");
    setSavedAt(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildPatch = useCallback((): BriefingPatch => ({
    title: title.trim() || "Briefing",
    description: base.description,
    strategy: {
      audience: base.audience.trim() || undefined,
      essence: fromCsv(base.essence),
      tone: base.tone.trim() || undefined,
      value_prop: base.value_prop.trim() || undefined,
      positioning: base.positioning.trim() || undefined,
    },
    briefing: data,
    briefing_template_id: tplId,
    status,
  }), [title, base, data, tplId, status]);

  /* -------- autosave com debounce + flush ao fechar -------- */
  const patchRef = useRef(buildPatch);
  patchRef.current = buildPatch;
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);

  const flush = useCallback(async () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState("saving");
    await onSave(patchRef.current());
    setSavedAt(new Date());
    setSaveState("saved");
  }, [onSave]);

  useEffect(() => {
    if (!open) return;
    if (firstRun.current) { firstRun.current = false; return; }
    dirtyRef.current = true;
    setSaveState("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void flush(); }, 800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [title, status, tplId, data, base, open, flush]);

  useEffect(() => {
    if (open) firstRun.current = true;
  }, [open]);

  // salva também se o usuário sair da aba / fechar o navegador
  useEffect(() => {
    if (!open) return;
    const onHide = () => { void flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
  }, [open, flush]);

  const closeAndSave = useCallback(() => {
    void flush().finally(() => onClose());
  }, [flush, onClose]);

  const tpl: BriefingTemplate | null = useMemo(
    () => templates.find(t => t.id === tplId) ?? null,
    [templates, tplId],
  );

  const tplFields = useMemo(() => (tpl?.sections ?? []).flatMap(s => s.fields ?? []), [tpl]);
  const baseList = showPositioning ? BASE : [];
  const baseFilled = baseList.filter(f => String(base[f.key] ?? "").trim() !== "").length;
  const tplFilled = tplFields.filter(f => String(data?.[f.key] ?? "").trim() !== "").length;
  const total = baseList.length + tplFields.length;
  const filled = baseFilled + tplFilled;
  const pct = total ? Math.round((filled / total) * 100) : 0;

  const set = (k: string, v: string) => setData(d => ({ ...d, [k]: v }));

  const renderTplField = (f: BriefingField) => {
    const value = data?.[f.key] ?? "";
    return (
      <WinField key={f.key} label={f.label + (f.required ? " *" : "")} hint={f.placeholder} span={f.type === "textarea" || f.colSpan === 3}>
        {f.type === "textarea" ? (
          <textarea value={value} placeholder={f.placeholder} onChange={e => set(f.key, e.target.value)} />
        ) : f.type === "select" ? (
          <select value={value} onChange={e => set(f.key, e.target.value)}>
            <option value="">Selecionar…</option>
            {(f.options ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input
            type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
            value={value} placeholder={f.placeholder}
            onChange={e => set(f.key, e.target.value)}
          />
        )}
      </WinField>
    );
  };

  const finish = () => {
    setStatus("done");
    dirtyRef.current = true;
    void (async () => {
      setSaveState("saving");
      await onSave({ ...patchRef.current(), status: "done" });
      dirtyRef.current = false;
      setSavedAt(new Date());
      setSaveState("saved");
      onClose();
    })();
  };

  const savedLabel =
    saveState === "saving" ? "Salvando…" :
    savedAt ? `Salvo às ${savedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` :
    "Rascunho salvo automaticamente";

  return (
    <ToolWindow
      open={open}
      onClose={closeAndSave}
      icon={BookOpen}
      title="Briefing e posicionamento"
      subtitle={projectName}
      size="full"
      headerRight={
        <>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Nome do briefing"
            className="swin-f"
            style={{ height: 32, borderRadius: 9, border: "1px solid var(--border)", background: "var(--background)", fontSize: 12.5, padding: "0 10px", minWidth: 200, color: "var(--foreground)" }}
          />
          <select
            className="swin-f"
            style={{ height: 32, borderRadius: 9, border: "1px solid var(--border)", background: "var(--background)", fontSize: 12.5, padding: "0 10px", color: "var(--foreground)" }}
            value={tplId ?? ""}
            onChange={e => setTplId(e.target.value || null)}
          >
            <option value="">Somente posicionamento</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <div className="swin-progress">
            <div className="bar"><i style={{ width: `${pct}%` }} /></div>
            <span>{filled}/{total}</span>
          </div>
        </>
      }
      footer={
        <>
          <small style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {saveState === "saving"
              ? <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
              : <Check style={{ width: 13, height: 13, color: "var(--success)" }} />}
            {savedLabel}
          </small>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="swin-btn" onClick={closeAndSave}>Fechar</button>
            <button type="button" className="swin-btn primary" onClick={finish}><Save /> Concluir briefing</button>
          </div>
        </>
      }
    >
      <div className="swin-split">
        {/* ---------- formulário ---------- */}
        <div style={{ padding: "18px 20px 28px" }}>
          {showPositioning && (
            <div className="swin-sec">
              <div className="swin-sec-t">Posicionamento da marca</div>
              <div className="swin-grid">
                {BASE.map(f => (
                  <WinField key={f.key} label={f.label} hint={f.hint} span={f.long}>
                    {f.long ? (
                      <textarea value={base[f.key]} onChange={e => setBase({ ...base, [f.key]: e.target.value })} />
                    ) : (
                      <input value={base[f.key]} onChange={e => setBase({ ...base, [f.key]: e.target.value })} />
                    )}
                  </WinField>
                ))}
              </div>
            </div>
          )}

          {tpl ? (
            tpl.sections.map((sec, i) => (
              <div className="swin-sec" key={i}>
                <div className="swin-sec-t">{sec.emoji ? `${sec.emoji} ` : ""}{sec.title}</div>
                <div className="swin-grid">{(sec.fields ?? []).map(renderTplField)}</div>
              </div>
            ))
          ) : (
            <p className="swin-empty">
              Escolha um modelo de briefing no topo para responder as perguntas configuradas em Configurações.
            </p>
          )}
        </div>

        {/* ---------- documento ---------- */}
        <div className="swin-doc-wrap">
          <article className="swin-doc">
            <div className="doc-brand">{title || "Briefing estratégico"}</div>
            <h1>{projectName || "Projeto"}</h1>
            <div className="doc-sub">
              {tpl ? tpl.name : "Posicionamento"} · {new Date().toLocaleDateString("pt-BR")}
            </div>
            <hr />

            {showPositioning && (
              <>
                <h2>Posicionamento</h2>
                {BASE.map(f => {
                  const raw = String(base[f.key] ?? "").trim();
                  return (
                    <div className="doc-q" key={f.key}>
                      <b>{f.label}</b>
                      {f.chips && raw ? (
                        <div className="doc-chips">{fromCsv(raw).map(c => <span key={c} className="doc-chip">{c}</span>)}</div>
                      ) : (
                        <p className={raw ? "" : "empty"}>{raw || "Não preenchido"}</p>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {tpl?.sections.map((sec, i) => (
              <div key={i}>
                <h2>{sec.emoji ? `${sec.emoji} ` : ""}{sec.title}</h2>
                {(sec.fields ?? []).map(f => {
                  const raw = String(data?.[f.key] ?? "").trim();
                  return (
                    <div className="doc-q" key={f.key}>
                      <b>{f.label}</b>
                      <p className={raw ? "" : "empty"}>{raw || "Não preenchido"}</p>
                    </div>
                  );
                })}
              </div>
            ))}

            <div className="doc-foot">{filled} de {total} respostas preenchidas ({pct}%).</div>
          </article>
        </div>
      </div>
    </ToolWindow>
  );
}
