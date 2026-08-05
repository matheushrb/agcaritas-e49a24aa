import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { briefingProgress, type BriefingData, type BriefingField, type BriefingTemplate } from "@/lib/briefing";
import { ClipboardList, FileText } from "lucide-react";

interface Props {
  template: BriefingTemplate;
  data: BriefingData;
  onChange: (data: BriefingData) => void;
  readOnly?: boolean;
  /** Mostra o cabeçalho com nome do modelo e progresso */
  showHeader?: boolean;
}

export function BriefingForm({ template, data, onChange, readOnly, showHeader = true }: Props) {
  const set = (key: string, value: string) => onChange({ ...data, [key]: value });
  const { filled, total, pct } = briefingProgress(template, data);
  const isSheet = template.template_type === "ficha_tecnica";
  const Icon = isSheet ? ClipboardList : FileText;

  const renderField = (field: BriefingField) => {
    const value = data?.[field.key] ?? "";
    const span = field.colSpan === 3 ? "sm:col-span-3" : field.colSpan === 2 ? "sm:col-span-2" : "";
    return (
      <div key={field.key} className={span}>
        <Label className="text-[11px] text-muted-foreground">
          {field.label}{field.required ? " *" : ""}
        </Label>
        <div className="mt-1">
          {field.type === "textarea" ? (
            <Textarea
              rows={3}
              value={value}
              placeholder={field.placeholder}
              disabled={readOnly}
              onChange={e => set(field.key, e.target.value)}
              className="text-sm"
            />
          ) : field.type === "select" ? (
            <Select value={value || undefined} disabled={readOnly} onValueChange={v => set(field.key, v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {(field.options ?? []).map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
              value={value}
              placeholder={field.placeholder}
              disabled={readOnly}
              onChange={e => set(field.key, e.target.value)}
              className="h-9 text-sm"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {showHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{template.name}</p>
              {template.description && (
                <p className="text-xs text-muted-foreground truncate">{template.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-28 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground">{filled}/{total}</span>
          </div>
        </div>
      )}

      {template.sections.length === 0 && (
        <p className="text-sm text-muted-foreground">Este modelo ainda não tem seções configuradas.</p>
      )}

      {template.sections.map((section, i) => (
        <section key={i} className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {section.emoji ? `${section.emoji} ` : ""}{section.title}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(section.fields ?? []).map(renderField)}
          </div>
        </section>
      ))}
    </div>
  );
}
