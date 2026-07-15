# Roadmap — Pixie Pro / Caritas Gestão Criativa

## Ordem de construção (definida com o usuário)

Fluxo do cliente: **CRM → Propostas → Contratos → Planos de Marketing → Projetos → Tarefas → Financeiro → Agenda → RH → Configurações**.

Cada módulo entra completo — todas as janelas do PRD (páginas, drawers, modais, abas) + CRUD + integrações listadas — antes de passar para o próximo. Dashboard e personalização já feitos.

## Padrão visual comum

- Cards e superfícies em `rounded-2xl`/`rounded-3xl`, borda `border-border`, fundo `bg-card`, sombras suaves via tokens.
- Chips de status coloridos por semântica (badge Radix `Badge` + tokens).
- Header de página: título + subtítulo + KPIs em cards de 12 col e ação primária à direita.
- Filtros em barra horizontal com Selects e Input de busca em `rounded-full`.
- Drawers usam `Sheet` (side="right", `sm:max-w-lg`). Modais usam `Dialog`.
- Toasts via `sonner` para toda mutação.

## Estado do módulo

| Módulo | Status |
| --- | --- |
| Dashboard | Feito + personalização por role |
| **CRM** | **Em construção agora** |
| Propostas | Pendente |
| Contratos | Pendente |
| Planos de Marketing | Pendente |
| Projetos | Pendente |
| Tarefas | Pendente |
| Financeiro | Pendente |
| Agenda | Pendente |
| RH | Pendente |
| Configurações | Pendente |

## M02 · CRM (esta etapa)

### Janelas
1. **Página `/crm`** — kanban 5 colunas (Lead · Contato · Proposta · Negociação · Fechado), KPIs no topo (Pipeline total, Receita fechada, Taxa de conversão), busca e filtro por segmento, `+ Novo lead`.
2. **Drawer `Detalhe do lead`** — abre ao clicar no card. Dados completos, barra de etapas com Avançar/Voltar, campo de notas, botão `Criar proposta`.
3. **Modal `+ Novo lead`** — form: nome, empresa, telefone, email, segmento, valor estimado, etapa inicial, origem.

### Regras
- Arrastar com `@dnd-kit`. Ao soltar em **Fechado**, exibe banner "Criar Plano de Marketing?" com dois botões (Criar / Depois). Criar navega para `/marketing-plans/novo?leadId=…`.
- `+ Criar proposta` no drawer navega para `/proposals/nova?leadId=…`.
- Mutações reagem otimistas via TanStack Query.
- Todo lead pertence à `organization_id` do usuário logado (RLS já cuida).

### Fora do escopo
- Histórico de interações estruturado (por enquanto: campo único `notes`). Iteração futura.
- Automação de e-mail. Iteração futura.

## Já entregue anteriormente

- Dashboard personalizável com preset por role + painel lateral.
- Card "Tarefas de hoje" limitado a 4 linhas, cresce por conteúdo.
- Tabela `dashboard_preferences` com RLS.
