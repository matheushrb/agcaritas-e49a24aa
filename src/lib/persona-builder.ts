/**
 * Gerador de personas por regras (sem IA / sem consumo de créditos).
 * A partir de um formulário padrão o sistema decide QUANTAS personas
 * são necessárias, como elas são, e oferece opções de nome.
 */

export type PersonaAnswers = {
  market: "b2b" | "b2c" | "both";
  audienceSize: "mei" | "pme" | "media" | "grande" | "consumidor";
  ticket: "baixo" | "medio" | "alto";
  cycle: "curto" | "medio" | "longo";
  deciders: string[];   // b2b: quem participa da decisão
  stages: string[];     // b2c: momento do consumidor
  goal: "reconhecimento" | "leads" | "vendas" | "retencao";
  channels: string[];
  barrier: "preco" | "confianca" | "prazo" | "complexidade" | "concorrencia";
};

export const emptyAnswers: PersonaAnswers = {
  market: "b2b",
  audienceSize: "pme",
  ticket: "medio",
  cycle: "medio",
  deciders: ["decisor"],
  stages: ["descoberta"],
  goal: "leads",
  channels: ["instagram"],
  barrier: "confianca",
};

export const DECIDER_OPTIONS = [
  { id: "decisor", label: "Dono / decisor final" },
  { id: "gestor", label: "Gestor de marketing" },
  { id: "tecnico", label: "Time técnico / operação" },
  { id: "financeiro", label: "Financeiro / compras" },
  { id: "usuario", label: "Usuário final do serviço" },
];

export const STAGE_OPTIONS = [
  { id: "descoberta", label: "Descobrindo o problema" },
  { id: "comparando", label: "Comparando opções" },
  { id: "recorrente", label: "Já é cliente / recompra" },
];

export const CHANNEL_OPTIONS = [
  { id: "instagram", label: "Instagram" },
  { id: "google", label: "Google / busca" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "indicacao", label: "Indicação" },
  { id: "eventos", label: "Eventos / presencial" },
];

export type BuiltPersona = {
  key: string;
  nameOptions: string[];
  name: string;
  role: string;
  tags: string[];
  desires: string[];
  pains: string[];
  help: string;
  why: string;
};

const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(
  CHANNEL_OPTIONS.map(c => [c.id, c.label]),
);

const BARRIER_TEXT: Record<PersonaAnswers["barrier"], { pain: string; help: string }> = {
  preco: { pain: "Precisa justificar o investimento internamente", help: "Mostramos retorno esperado e escopo claro antes do contrato" },
  confianca: { pain: "Já se decepcionou com fornecedor anterior", help: "Entregamos cases, provas e rotina de reportes previsível" },
  prazo: { pain: "Não pode esperar meses por resultado", help: "Entregamos quick wins nas primeiras semanas" },
  complexidade: { pain: "Se perde em termos técnicos e relatórios longos", help: "Traduzimos tudo em painéis simples e linguagem direta" },
  concorrencia: { pain: "Sente que os concorrentes aparecem mais", help: "Trabalhamos posicionamento e presença consistente" },
};

const GOAL_DESIRE: Record<PersonaAnswers["goal"], string> = {
  reconhecimento: "Ser lembrado como referência no segmento",
  leads: "Receber contatos qualificados com previsibilidade",
  vendas: "Aumentar vendas sem inflar o custo de aquisição",
  retencao: "Manter clientes comprando por mais tempo",
};

const NAMES: Record<string, string[]> = {
  decisor: ["Ricardo", "Marcelo", "Cláudia", "Eduardo"],
  gestor: ["Marina", "Bruna", "Rafael", "Letícia"],
  tecnico: ["Diego", "Felipe", "Camila", "Thiago"],
  financeiro: ["Sandra", "Patrícia", "Alexandre", "Juliana"],
  usuario: ["Ana", "Lucas", "Bia", "Paulo"],
  descoberta: ["Júlia", "Matheus", "Carol", "Vinícius"],
  comparando: ["Fernanda", "Rodrigo", "Aline", "Gustavo"],
  recorrente: ["Renata", "Sérgio", "Priscila", "André"],
};

const SIZE_LABEL: Record<PersonaAnswers["audienceSize"], string> = {
  mei: "MEI / autônomo",
  pme: "Pequena empresa",
  media: "Empresa média",
  grande: "Grande empresa",
  consumidor: "Consumidor final",
};

const BASE: Record<string, { role: string; tags: string[]; desires: string[]; pains: string[]; why: string }> = {
  decisor: {
    role: "Dono / decisor final",
    tags: ["Pragmático", "Orientado a resultado", "Pouco tempo"],
    desires: ["Ver o negócio crescer sem depender só dele", "Decidir com números na mão"],
    pains: ["Agenda cheia, decide no intervalo", "Cansado de promessas genéricas"],
    why: "Sempre existe quem assina o contrato — essa persona é obrigatória.",
  },
  gestor: {
    role: "Gestor de marketing",
    tags: ["Estratégico", "Cobrado por metas", "Analítico"],
    desires: ["Bater a meta do trimestre", "Ter um parceiro que traga ideias, não só execução"],
    pains: ["Precisa prestar contas para a diretoria", "Equipe enxuta para o volume de demandas"],
    why: "Você indicou que o marketing participa da decisão.",
  },
  tecnico: {
    role: "Time técnico / operação",
    tags: ["Detalhista", "Cético", "Foco em processo"],
    desires: ["Que a entrega funcione sem retrabalho", "Integrações e prazos respeitados"],
    pains: ["Recebe demanda mal briefada", "Teme mudanças que quebrem a rotina"],
    why: "A operação foi marcada como participante da decisão.",
  },
  financeiro: {
    role: "Financeiro / compras",
    tags: ["Conservador", "Focado em custo", "Formal"],
    desires: ["Custo previsível e contrato claro", "Evitar surpresa no fluxo de caixa"],
    pains: ["Desconfia de escopo aberto", "Compara propostas linha a linha"],
    why: "O financeiro entra na aprovação segundo suas respostas.",
  },
  usuario: {
    role: "Usuário final do serviço",
    tags: ["Prático", "Impaciente", "Boca a boca"],
    desires: ["Resolver o problema rápido", "Experiência simples do início ao fim"],
    pains: ["Não quer processo burocrático", "Desiste se não entender em segundos"],
    why: "Quem usa o serviço influencia renovação e indicação.",
  },
  descoberta: {
    role: "Consumidor em descoberta",
    tags: ["Curioso", "Comparador", "Sensível a prova social"],
    desires: ["Entender se isso resolve o problema dele", "Encontrar referência confiável"],
    pains: ["Excesso de informação e opções", "Medo de escolher errado"],
    why: "Você marcou o momento de descoberta na jornada.",
  },
  comparando: {
    role: "Consumidor comparando opções",
    tags: ["Racional", "Pesquisa preço", "Lê avaliações"],
    desires: ["Ter certeza do melhor custo-benefício", "Falar com alguém antes de fechar"],
    pains: ["Propostas difíceis de comparar", "Insegurança sobre pós-venda"],
    why: "Você marcou o momento de comparação na jornada.",
  },
  recorrente: {
    role: "Cliente recorrente",
    tags: ["Fiel", "Exigente", "Indica"],
    desires: ["Ser reconhecido como cliente antigo", "Novidades e vantagens primeiro"],
    pains: ["Sente que só é lembrado na renovação", "Recebe menos atenção que o cliente novo"],
    why: "Recompra/retenção foi marcada como parte da jornada.",
  },
};

export function buildPersonas(a: PersonaAnswers): BuiltPersona[] {
  const keys: string[] = [];
  if (a.market === "b2b" || a.market === "both") {
    const d = a.deciders.length ? a.deciders : ["decisor"];
    keys.push(...d);
    if (a.ticket === "alto" && !keys.includes("financeiro")) keys.push("financeiro");
    if (a.cycle === "longo" && !keys.includes("gestor")) keys.push("gestor");
  }
  if (a.market === "b2c" || a.market === "both") {
    const s = a.stages.length ? a.stages : ["descoberta"];
    keys.push(...s);
    if (a.goal === "retencao" && !keys.includes("recorrente")) keys.push("recorrente");
  }

  const uniq = Array.from(new Set(keys)).slice(0, 5);
  const channels = a.channels.map(c => CHANNEL_LABEL[c] ?? c);
  const barrier = BARRIER_TEXT[a.barrier];

  return uniq.map(k => {
    const b = BASE[k] ?? BASE["decisor"]!;
    const nameOptions = NAMES[k] ?? NAMES["decisor"]!;
    const tags = [...b.tags];
    if (a.ticket === "alto") tags.push("Compra de alto valor");
    if (a.cycle === "curto") tags.push("Decide rápido");
    if (a.audienceSize !== "consumidor") tags.push(SIZE_LABEL[a.audienceSize]);

    return {
      key: k,
      nameOptions,
      name: nameOptions[0]!,
      role: `${b.role} | ${SIZE_LABEL[a.audienceSize]}`,
      tags,
      desires: [...b.desires, GOAL_DESIRE[a.goal]],
      pains: [...b.pains, barrier.pain],
      help: `${barrier.help}. Presença principal em ${channels.join(", ") || "canais digitais"}.`,
      why: b.why,
    };
  });
}
