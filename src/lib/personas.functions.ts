import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  projectId: z.string().uuid(),
  count: z.number().int().min(1).max(5).default(3),
  notes: z.string().max(2000).optional().default(""),
});

export type GeneratedPersona = {
  name: string;
  role: string;
  tags: string[];
  desires: string[];
  pains: string[];
  help: string;
};

const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 6) : [];

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Resposta da IA sem JSON válido");
  return JSON.parse(raw.slice(start, end + 1));
}

export const generatePersonas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }): Promise<GeneratedPersona[]> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("IA indisponível no momento");

    const supabase = (context as any).supabase;
    const { data: project, error } = await supabase
      .from("projects")
      .select("name, description, project_type, briefing, strategy, notes, client_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Projeto não encontrado");

    let clientName = "";
    if (project.client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("name, segment")
        .eq("id", project.client_id)
        .maybeSingle();
      if (client) clientName = [client.name, client.segment].filter(Boolean).join(" · ");
    }

    const briefing =
      project.briefing && typeof project.briefing === "object"
        ? JSON.stringify(project.briefing).slice(0, 4000)
        : "";

    const contexto = [
      `Projeto: ${project.name}`,
      project.project_type ? `Tipo: ${project.project_type}` : "",
      clientName ? `Cliente: ${clientName}` : "",
      project.description ? `Descrição: ${project.description}` : "",
      project.notes ? `Notas: ${project.notes}` : "",
      briefing ? `Briefing (JSON): ${briefing}` : "",
      data.notes ? `Direcionamento do estrategista: ${data.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `Você é estrategista sênior de uma agência de marketing brasileira.
Com base no contexto abaixo, crie ${data.count} persona(s) de público-alvo distintas e realistas para este projeto.

CONTEXTO
${contexto}

Regras:
- Escreva em português do Brasil.
- Nomes brasileiros realistas (nome e sobrenome curto).
- "role": cargo/contexto curto (ex.: "Gestora de marketing | Varejo").
- "tags": 3 a 5 características comportamentais curtas.
- "desires": 3 a 4 objetivos concretos.
- "pains": 3 a 4 desafios concretos.
- "help": 1 a 2 frases sobre como a agência resolve o problema dessa persona.
- Personas diferentes entre si (momentos de compra, senioridade ou canais distintos).

Responda APENAS com json no formato:
{"personas":[{"name":"","role":"","tags":[""],"desires":[""],"pains":[""],"help":""}]}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Muitas solicitações à IA. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    if (!res.ok) throw new Error(`Falha na IA (${res.status}): ${(await res.text()).slice(0, 200)}`);

    const json: any = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    const parsed = extractJson(text);
    const list: any[] = Array.isArray(parsed?.personas) ? parsed.personas : [];

    return list.slice(0, data.count).map((p) => ({
      name: String(p?.name ?? "").trim() || "Persona",
      role: String(p?.role ?? "").trim(),
      tags: asList(p?.tags),
      desires: asList(p?.desires),
      pains: asList(p?.pains),
      help: String(p?.help ?? "").trim(),
    }));
  });
