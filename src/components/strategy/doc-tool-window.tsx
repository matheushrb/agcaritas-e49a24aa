import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Save } from "lucide-react";
import { ToolWindow, WinField } from "./tool-window";
import {
  countFilled, splitList, useStrategyDoc,
  type DocField, type DocSchema, type StrategyDocData,
} from "@/lib/strategy-docs";
import "@/strategy-win.css";

function Swatches({ value }: { value: string }) {
  const colors = splitList(value).filter(c => /^#?[0-9a-f]{3,8}$/i.test(c)).map(c => (c.startsWith("#") ? c : `#${c}`));
  if (!colors.length) return null;
  return (
    <div className="doc-chips" style={{ marginTop: 4 }}>
      {colors.map(c => (
        <span key={c} className="doc-chip" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 4, background: c, border: "1px solid var(--border)", display: "inline-block" }} />
          {c.toUpperCase()}
        </span>
      ))}
    </div>
  );
}

function DocValue({ field, raw }: { field: DocField; raw: string }) {
  if (field.type === "colors") {
    return raw ? <Swatches value={raw} /> : <p className="empty">Não preenchido</p>;
  }
  if (field.type === "chips") {
    return raw
      ? <div className="doc-chips">{splitList(raw).map(c => <span key={c} className="doc-chip">{c}</span>)}</div>
      : <p className="empty">Não preenchido</p>;
  }
  return <p className={raw ? "" : "empty"}>{raw || "Não preenchido"}</p>;
}

export function DocToolWindow({
  open, onClose, projectId, projectName, schema, icon,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  schema: DocSchema;
  icon: LucideIcon;
}) {
  const { data, save } = useStrategyDoc(projectId, schema.kind);
  const [form, setForm] = useState<StrategyDocData>(data);

  useEffect(() => {
    if (open) setForm(data);
  }, [open, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const { filled, total, pct } = countFilled(schema, form);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = () => {
    save.mutate(form, { onSuccess: () => onClose() });
  };

  return (
    <ToolWindow
      open={open}
      onClose={onClose}
      icon={icon}
      title={schema.title}
      subtitle={projectName}
      size="full"
      headerRight={
        <div className="swin-progress">
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <span>{filled}/{total}</span>
        </div>
      }
      footer={
        <>
          <small>O documento ao lado é gerado em tempo real e entra no consolidado da estratégia.</small>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="swin-btn" onClick={onClose}>Cancelar</button>
            <button type="button" className="swin-btn primary" onClick={submit}><Save /> Salvar</button>
          </div>
        </>
      }
    >
      <div className="swin-split">
        <div style={{ padding: "18px 20px 28px" }}>
          {schema.sections.map(sec => (
            <div className="swin-sec" key={sec.title}>
              <div className="swin-sec-t">{sec.title}</div>
              {sec.description && <p className="swin-empty" style={{ padding: "0 0 8px", textAlign: "left" }}>{sec.description}</p>}
              <div className="swin-grid">
                {sec.fields.map(f => (
                  <WinField key={f.key} label={f.label} hint={f.hint} span={f.span || f.type === "textarea"}>
                    {f.type === "textarea" ? (
                      <textarea value={form[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} />
                    ) : (
                      <input value={form[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} placeholder={f.type === "colors" ? "#1D4ED8, #0F172A" : undefined} />
                    )}
                    {f.type === "colors" && <Swatches value={form[f.key] ?? ""} />}
                  </WinField>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="swin-doc-wrap">
          <article className="swin-doc">
            <div className="doc-brand">{schema.docLabel}</div>
            <h1>{projectName || "Projeto"}</h1>
            <div className="doc-sub">{schema.subtitle} · {new Date().toLocaleDateString("pt-BR")}</div>
            <hr />
            {schema.sections.map(sec => (
              <div key={sec.title}>
                <h2>{sec.title}</h2>
                {sec.fields.map(f => (
                  <div className="doc-q" key={f.key}>
                    <b>{f.label}</b>
                    <DocValue field={f} raw={String(form[f.key] ?? "").trim()} />
                  </div>
                ))}
              </div>
            ))}
            <div className="doc-foot">{filled} de {total} campos preenchidos ({pct}%).</div>
          </article>
        </div>
      </div>
    </ToolWindow>
  );
}
