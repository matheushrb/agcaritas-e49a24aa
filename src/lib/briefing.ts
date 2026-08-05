import { supabase } from "@/integrations/supabase/client";

export type BriefingFieldType = "text" | "textarea" | "select" | "number" | "date";

export interface BriefingFieldOption {
  value: string;
  label: string;
}

export interface BriefingField {
  key: string;
  label: string;
  type: BriefingFieldType;
  placeholder?: string;
  options?: BriefingFieldOption[];
  required?: boolean;
  colSpan?: 1 | 2 | 3;
}

export interface BriefingSection {
  title: string;
  emoji?: string;
  fields: BriefingField[];
}

export type BriefingTemplateType = "briefing" | "ficha_tecnica";

export interface BriefingTemplate {
  id: string;
  organization_id?: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  template_type: BriefingTemplateType;
  sections: BriefingSection[];
  active?: boolean;
}

export type BriefingData = Record<string, string>;

export const FIELD_TYPE_OPTIONS: { value: BriefingFieldType; label: string }[] = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "select", label: "Lista de opções" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
];

export const TEMPLATE_TYPE_LABEL: Record<BriefingTemplateType, string> = {
  briefing: "Briefing",
  ficha_tecnica: "Ficha Técnica",
};

/** Normaliza uma linha do banco no schema tipado. */
export function toTemplate(row: any): BriefingTemplate {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    description: row.description ?? null,
    icon: row.icon ?? null,
    template_type: (row.template_type as BriefingTemplateType) ?? "briefing",
    sections: Array.isArray(row.sections) ? (row.sections as BriefingSection[]) : [],
    active: row.active ?? true,
  };
}

export function slugKey(label: string) {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || `campo_${Math.random().toString(36).slice(2, 6)}`;
}

/** Quantos campos do template estão preenchidos. */
export function briefingProgress(template: BriefingTemplate | null, data: BriefingData) {
  if (!template) return { filled: 0, total: 0, pct: 0 };
  const fields = template.sections.flatMap(s => s.fields ?? []);
  const filled = fields.filter(f => String(data?.[f.key] ?? "").trim() !== "").length;
  return { filled, total: fields.length, pct: fields.length ? Math.round((filled / fields.length) * 100) : 0 };
}

export async function getOrgId(): Promise<string> {
  const { data } = await supabase.from("profiles").select("organization_id").maybeSingle();
  if (!data?.organization_id) throw new Error("Organização não encontrada");
  return data.organization_id;
}

export async function fetchBriefingTemplates(): Promise<BriefingTemplate[]> {
  const { data, error } = await supabase
    .from("briefing_templates")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []).map(toTemplate);
}
