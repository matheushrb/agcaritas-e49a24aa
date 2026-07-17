# Tipos de Tarefa & Fluxos de Etapas

Hoje as etapas da task são um enum fixo (`task_stage`) igual para toda tarefa. Você quer que cada **Tipo de Tarefa** tenha seu próprio conjunto de etapas, cada etapa com cor e vinculada a um **Status macro** (A fazer / Em andamento / Revisão / Concluído), e que isso influencie progresso e faturamento.

## Modelo de dados (novas tabelas)

- `task_types` — catálogo de tipos por organização
  - `name`, `description`, `color`, `default_billing_model` (`hourly` / `fixed` / `per_task`), `default_price`, `icon`, `active`
- `task_type_stages` — etapas de cada tipo, ordenadas
  - `task_type_id`, `name`, `order`, `color`, `status_group` (`todo` / `in_progress` / `review` / `done`), `weight` (peso opcional no cálculo de progresso)

Alterações em `tasks`:
- Nova coluna `task_type_id` (FK opcional para não quebrar tarefas antigas)
- Nova coluna `current_stage_id` (FK opcional — substitui aos poucos o enum `stage`)
- Coluna `stage` (enum antigo) permanece por compatibilidade; novas tasks passam a usar o fluxo dinâmico quando o tipo estiver preenchido

RLS por `organization_id` em ambas tabelas, com GRANT para authenticated/service_role.

## Configurações → nova aba "Tipos de Tarefa"

Rota: `/settings` ganha uma aba (substitui o placeholder "Fluxos de Tarefa"):

- Lista de tipos criados (cards com cor, nº de etapas, status default)
- Botão "Novo tipo" → dialog com nome, descrição, cor, modelo de faturamento padrão, preço padrão
- Ao abrir um tipo: editor de etapas
  - Lista drag-and-drop das etapas (reordenar)
  - Cada linha: nome, cor (color picker), status macro (select: A fazer / Em andamento / Revisão / Concluído), peso
  - Adicionar / remover etapa
  - Botão "Duplicar tipo" para partir de um existente

Seed inicial (só se a org não tiver nenhum tipo): 2 exemplos prontos —
- "Produção Audiovisual — Teaser 3min" com as 10 etapas que você citou já mapeadas a status
- "Post estático" mais simples (Briefing → Criação → Revisão → Aprovação → Publicado)

## Impacto no TaskModal

- Novo campo inline **Tipo de Tarefa** (antes do Status). Ao escolher o tipo:
  - As etapas do `TaskStageSection` passam a vir do `task_type_stages` (não mais do enum fixo)
  - O **Status** vira derivado da etapa atual (`status_group` da etapa selecionada) — usuário ainda pode sobrescrever manualmente
  - Modelo de faturamento e preço iniciais preenchem os defaults do tipo (sem travar edição)
- Sem tipo escolhido: modal mantém o comportamento atual (fallback ao enum).
- **Progresso automático** passa a considerar o peso das etapas do tipo + subtarefas concluídas, em vez de contar etapas fixas.

## Ordem de implementação

1. Migration: `task_types`, `task_type_stages`, colunas em `tasks`, RLS, GRANT, seed condicional dos 2 exemplos.
2. Aba "Tipos de Tarefa" em `/settings` com CRUD e editor de etapas (drag/drop, cor, status macro).
3. Refatorar `TaskModal`:
   - Seletor de Tipo
   - `TaskStageSection` dinâmico a partir das etapas do tipo
   - Status derivado do `status_group` da etapa atual
   - Progresso recalculado com pesos
   - Defaults de faturamento herdados do tipo
4. Manter compat: tarefas antigas sem `task_type_id` continuam funcionando exatamente como hoje.

## Fora deste escopo (fica para depois)
- Checklist obrigatório por etapa
- Templates de briefing por tipo
- Regras "só avança se subtarefas x concluídas"

Confirma que posso seguir nessa direção? Se sim, começo pela migration.
