# Plano — Botões funcionais + Projetos expandidos

## Parte 1 — Auditoria de botões inertes

Vou varrer todas as rotas (`src/routes/_authenticated/*.tsx`) e componentes procurando:
- `<Button>` sem `onClick` e sem estar dentro de `<form>` / `<Link>` / `DialogTrigger`
- `onClick={() => {}}` ou handlers vazios
- Ícones clicáveis (⋯, editar, lixeira) sem ação

Para cada botão encontrado, aplico a ação óbvia pelo contexto:
- **Editar** → abre Sheet/Dialog do item
- **Excluir** → confirmação + delete no Supabase + toast
- **Duplicar** → insert cópia
- **Filtros/Exportar** → implementa ou remove se não fizer sentido ainda
- **Menu ⋯** → dropdown com editar/duplicar/excluir

Módulos varridos: dashboard, clients, projects, projects/$id, tasks, calendar, finance, marketing-plans, marketing-interno, contracts, proposals, crm, suppliers, goals, team, messages, inbox, notifications.

Entrego uma lista no final com o que foi ligado.

## Parte 2 — Novo cadastro de Projeto

### Campos novos no modal "Novo projeto"

Reorganizado em **passos/seções** dentro do mesmo modal (mantendo o layout atual `EntityDialog` — só amplio o `main` com seções colapsáveis, sem virar wizard).

**Seção 1 — Básico** (já existe): nome, cliente, descrição, início, prazo, status.

**Seção 2 — Classificação** (nova):
- **Tipo de projeto** (select): Social Media, Branding, Site/Landing, Tráfego Pago, Audiovisual, Consultoria, Planejamento Estratégico, Outro
- **Modelo de faturamento** (select): Por tarefa · Valor fixo · Contrato/Proposta · Recorrente mensal
  - Se "Contrato/Proposta" → aparece autocomplete de contrato existente
  - Se "Valor fixo" ou "Recorrente" → aparece campo de valor
- **Urgência** (pills selecionáveis): Baixa · Média · Alta · Crítica (com cor)

**Seção 3 — Verbas** (nova, opcional):
- Toggle "Este projeto tem verba de tráfego"
  - Se ligado: multi-select de plataformas (Meta, Google, TikTok, LinkedIn, Pinterest, X, YouTube) + campo valor por plataforma
- Lista dinâmica "Outras verbas" — botão "+ Adicionar verba" gera linha `{nome, valor}` (ex: Influencer, Produção, Impulsionamento, Ferramentas)
- Mostra total consolidado no rodapé da seção

**Seção 4 — Escopo de entregáveis** (nova, checklist):
- [ ] Plano de Ação
- [ ] KPIs & Metas
- [ ] Matriz SWOT
- [ ] Personas
- [ ] Briefing
- [ ] Cronograma / Roadmap
- [ ] Benchmarking / Concorrência
- [ ] Posicionamento
- [ ] Análise de Performance (vídeos / social media)
- [ ] Notas do projeto

Cada item marcado ativa a aba/bloco correspondente dentro do projeto (`projects.$projectId.tsx`). Os não marcados ficam escondidos — a página do projeto fica limpa.

**Ferramentas** — você comentou que ferramentas "é outra coisa". Concordo: não é dado de projeto, é preferência da agência. Vou tirar do modal de projeto e sugerir um lugar melhor em Configurações da Organização (fora do escopo desta rodada, deixo anotado).

### Schema no banco

Adiciono à tabela `projects`:
- `project_type` text
- `billing_model` text
- `urgency` text
- `traffic_budget` jsonb (`{ platforms: [{name, amount}] }`)
- `other_budgets` jsonb (`[{name, amount}]`)
- `scope_flags` jsonb (`{ action_plan: bool, kpis: bool, swot: bool, personas: bool, briefing: bool, roadmap: bool, benchmarking: bool, positioning: bool, performance: bool, notes: bool }`)
- `notes` text
- `contract_id` uuid (fk opcional)
- `fixed_value` numeric (opcional)

### Ajustes na página do projeto (`projects.$projectId.tsx`)

- Header ganha pills: **Tipo** · **Urgência** (colorida) · **Faturamento**
- Abas ficam **condicionais** ao `scope_flags`:
  - Estratégia só aparece se algum de SWOT/Personas/Briefing marcado (sub-abas conforme flags)
  - Nova aba **Plano de Ação** (lista de ações, prazo, responsável, status)
  - Nova aba **Performance** (embed dos KPIs vinculados ao projeto)
  - Nova aba **Roadmap** (timeline simples)
  - Nova aba **Benchmarking** (lista de concorrentes: nome, link, forças, fraquezas)
  - Nova aba **Notas** (rich text simples via textarea)
- Card lateral com **Verbas** consolidadas

### Card de projeto na lista

Adiciono pill de **urgência colorida** e badge do **tipo** para varredura rápida.

## Ordem de execução

1. Migration adicionando as colunas em `projects` + tabelas de apoio (`project_action_items`, `project_benchmarks`)
2. Varredura de botões inertes (parte 1) — em paralelo à espera de aprovação da migration
3. Novo modal de projeto com todas as seções
4. Atualizar card da lista (pills)
5. Atualizar página do projeto com abas condicionais

## Fora de escopo desta rodada

- Ferramentas da agência (vai para Configurações depois)
- Editor rich-text para Notas (uso textarea por ora)
- Vincular metas existentes ao projeto (crio a UI, o vínculo real usa a tabela `goals` que já tem `project_id`)