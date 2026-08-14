import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const sb = supabase as any;

export type StrategyDocKind = "positioning" | "brand_manual";
export type StrategyDocData = Record<string, string>;

export type DocFieldType = "text" | "textarea" | "chips" | "colors";

export type DocField = {
  key: string;
  label: string;
  hint?: string;
  type?: DocFieldType;
  span?: boolean;
};

export type DocSection = { title: string; description?: string; fields: DocField[] };

export type DocSchema = {
  kind: StrategyDocKind;
  title: string;
  subtitle: string;
  docLabel: string;
  sections: DocSection[];
};

export const splitList = (v: string) =>
  String(v ?? "")
    .split(/[,\n;]/)
    .map(s => s.trim())
    .filter(Boolean);

export function countFilled(schema: DocSchema, data: StrategyDocData) {
  const fields = schema.sections.flatMap(s => s.fields);
  const filled = fields.filter(f => String(data?.[f.key] ?? "").trim() !== "").length;
  return { filled, total: fields.length, pct: fields.length ? Math.round((filled / fields.length) * 100) : 0 };
}

async function orgId(): Promise<string> {
  const { data } = await sb.from("profiles").select("organization_id").maybeSingle();
  if (!data?.organization_id) throw new Error("Sem organização");
  return data.organization_id as string;
}

export function useStrategyDoc(projectId: string, kind: StrategyDocKind) {
  const qc = useQueryClient();
  const queryKey = ["project_strategy_docs", projectId, kind];

  const { data = {} } = useQuery<StrategyDocData>({
    queryKey,
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("project_strategy_docs")
        .select("data")
        .eq("project_id", projectId)
        .eq("kind", kind)
        .maybeSingle();
      if (error) throw error;
      return (data?.data ?? {}) as StrategyDocData;
    },
  });

  const save = useMutation({
    mutationFn: async (next: StrategyDocData) => {
      const organization_id = await orgId();
      const { error } = await sb
        .from("project_strategy_docs")
        .upsert({ organization_id, project_id: projectId, kind, data: next }, { onConflict: "project_id,kind" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Documento salvo");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  return { data, save };
}

/* ------------------------------------------------------- esquemas */

export const POSITIONING_SCHEMA: DocSchema = {
  kind: "positioning",
  title: "Pesquisa & Posicionamento",
  subtitle: "Diagnóstico de mercado e definição da posição da marca",
  docLabel: "Pesquisa e posicionamento",
  sections: [
    {
      title: "1. Contexto e mercado",
      description: "O cenário em que a marca compete hoje.",
      fields: [
        { key: "category", label: "Categoria / mercado", hint: "Em que categoria a marca compete." },
        { key: "moment", label: "Momento do negócio", hint: "Lançamento, crescimento, reposicionamento, crise…" },
        { key: "context", label: "Contexto de mercado", type: "textarea", span: true, hint: "Tamanho, tendências, sazonalidade, regulação." },
        { key: "sources", label: "Fontes da pesquisa", type: "textarea", span: true, hint: "Dados, entrevistas, pesquisas e relatórios usados." },
      ],
    },
    {
      title: "2. Público e demanda",
      fields: [
        { key: "audience_primary", label: "Público primário", type: "textarea", span: true },
        { key: "audience_secondary", label: "Público secundário", type: "textarea", span: true },
        { key: "jobs", label: "O que o público busca resolver", type: "textarea", span: true, hint: "Dores, desejos e critérios de decisão." },
        { key: "objections", label: "Principais objeções", type: "textarea", span: true },
      ],
    },
    {
      title: "3. Concorrência e território",
      description: "Complementa os concorrentes já mapeados na aba Estratégia.",
      fields: [
        { key: "direct", label: "Concorrentes diretos", type: "chips" },
        { key: "indirect", label: "Concorrentes indiretos", type: "chips" },
        { key: "market_gaps", label: "Espaços não ocupados", type: "textarea", span: true, hint: "Onde ninguém está falando com força." },
        { key: "axis_x", label: "Eixo horizontal da matriz", hint: "Ex.: Tradicional ↔ Inovador" },
        { key: "axis_y", label: "Eixo vertical da matriz", hint: "Ex.: Popular ↔ Premium" },
        { key: "our_spot", label: "Onde nos posicionamos na matriz", type: "textarea", span: true },
      ],
    },
    {
      title: "4. Posicionamento",
      description: "O resultado da pesquisa — é isso que guia toda a comunicação.",
      fields: [
        { key: "statement", label: "Frase de posicionamento", type: "textarea", span: true, hint: "Para [público], a [marca] é a [categoria] que [diferencial], porque [prova]." },
        { key: "promise", label: "Promessa central", type: "textarea", span: true },
        { key: "differentiators", label: "Diferenciais", type: "chips", span: true },
        { key: "proofs", label: "Provas / reason to believe", type: "textarea", span: true },
        { key: "avoid", label: "O que evitar", type: "textarea", span: true, hint: "Territórios, promessas e discursos proibidos." },
      ],
    },
  ],
};

export const BRAND_SCHEMA: DocSchema = {
  kind: "brand_manual",
  title: "Manual de Marca",
  subtitle: "Identidade, tom de voz e regras de aplicação",
  docLabel: "Manual de marca",
  sections: [
    {
      title: "1. Fundamentos",
      fields: [
        { key: "purpose", label: "Propósito", type: "textarea", span: true },
        { key: "mission", label: "Missão", type: "textarea", span: true },
        { key: "values", label: "Valores", type: "chips", span: true },
        { key: "archetype", label: "Arquétipo", hint: "Ex.: O Herói, O Sábio, O Cuidador." },
        { key: "personality", label: "Personalidade", type: "chips" },
      ],
    },
    {
      title: "2. Verbal",
      fields: [
        { key: "tone", label: "Tom de voz", type: "textarea", span: true },
        { key: "voice_do", label: "A marca sempre", type: "textarea", hint: "Um item por linha." },
        { key: "voice_dont", label: "A marca nunca", type: "textarea", hint: "Um item por linha." },
        { key: "naming", label: "Naming e assinaturas", type: "textarea", span: true, hint: "Como escrever o nome, slogan e assinatura." },
        { key: "glossary", label: "Palavras-chave e termos proibidos", type: "textarea", span: true },
      ],
    },
    {
      title: "3. Visual",
      fields: [
        { key: "palette", label: "Paleta oficial", type: "colors", span: true, hint: "Cores em HEX separadas por vírgula. Ex.: #1D4ED8, #0F172A, #F8FAFC" },
        { key: "palette_use", label: "Uso das cores", type: "textarea", span: true, hint: "Proporção, fundos permitidos, contraste mínimo." },
        { key: "typography", label: "Tipografia", type: "textarea", span: true, hint: "Famílias, pesos e hierarquia." },
        { key: "logo_versions", label: "Versões do logo", type: "chips", span: true, hint: "Ex.: horizontal, vertical, símbolo, monocromático." },
        { key: "logo_rules", label: "Regras do logo", type: "textarea", span: true, hint: "Área de respiro, tamanho mínimo, fundos." },
        { key: "logo_dont", label: "Usos proibidos", type: "textarea", span: true },
        { key: "imagery", label: "Estilo de imagem", type: "textarea", span: true, hint: "Fotografia, ilustração, tratamento, grafismos." },
      ],
    },
    {
      title: "4. Aplicações",
      fields: [
        { key: "social", label: "Redes sociais", type: "textarea", span: true },
        { key: "print", label: "Impressos", type: "textarea", span: true },
        { key: "other", label: "Outras aplicações", type: "textarea", span: true },
        { key: "assets", label: "Onde estão os arquivos", type: "textarea", span: true, hint: "Aponte para as pastas na aba Arquivos do projeto." },
      ],
    },
  ],
};
