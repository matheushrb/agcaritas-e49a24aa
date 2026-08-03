## Próxima etapa: Módulo Tarefas

Projetos está concluído (PRJ-01 a PRJ-06 e PRJ-08). As referências aprovadas restantes são **Tarefas (TSK-02, TSK-03, TSK-04, TSK-05 + componente Timesheet)** e depois **Financeiro (FIN-01 a FIN-04, FIN-06)**.

Proponho reconstruir a tela `/tasks` do zero, igual ao que fizemos em Projetos: um CSS próprio (`src/tsk.css`) com os tokens lidos das imagens e componentes novos, sem reaproveitar o layout atual.

### TSK-02 — Tarefas / Lista (visão padrão)
- Cabeçalho "Tarefas" + subtítulo, ações `Exportar` e `+ Nova tarefa`.
- Abas: Lista | Quadro | Gantt.
- Barra de filtros: busca + Status, Responsável, Prioridade, Projeto, Prazo + "Limpar filtros".
- Faixa de 5 KPIs: Total, Em andamento, Em revisão, Concluídas, Atrasadas (valor + % do total + ícone colorido).
- Tabela: checkbox, tarefa (+ código #RV-128), projeto com avatar quadrado colorido, etapa/status em pill, responsável com avatar e cargo, prioridade, prazo (dias restantes / atraso em vermelho), progresso (%+barra), menu ⋮.
- Rodapé: "Mostrando 1 a 10 de N" + paginação + itens por página.

### TSK-03 — Quadro (Kanban) + painel lateral
- Colunas A fazer / Em andamento / Em revisão / Concluídas com contador e ⋮.
- Cards: título, projeto, pill de prioridade, avatar + prazo, rodapé com comentários / anexos / subtarefas (x/y).
- Drag & drop entre colunas atualizando o status.
- Painel lateral de detalhe: pills (prioridade, status, projeto), grid Responsável/Prazo/Criada em/ID, descrição, checklist de subtarefas com barra de progresso, comentários recentes, atividade, rodapé "Editar tarefa" / "Marcar como concluída".

### TSK-04 — Gantt
- KPIs no topo (Em andamento, Concluídas, Atrasadas, Vencem esta semana).
- Painel esquerdo: tarefas agrupadas por projeto (colapsáveis) com responsável, status, início e prazo.
- Timeline à direita por semanas, com barras coloridas por status/prioridade, marcos (losangos), linha "Hoje", setas de dependência, legenda e zoom.

### TSK-05 — Modal de detalhe da tarefa
- Modal grande: cabeçalho com ID, título editável, pills de status/prioridade/projeto, ações (link, copiar, ⋮, navegação ‹ ›).
- Faixa: Responsáveis (pilha de avatares), Prazo, Criado por, Última atualização.
- Descrição + abas Subtarefas / Anexos / Comentários / Atividade.
- Coluna direita "Campos principais": tipo, categoria, tags, prioridade, esforço estimado, tempo gasto, dependências, recorrência.
- Timesheet (TSK-COMP-01) embutido como bloco de apontamento de horas.

### Detalhes técnicos
- Novos arquivos: `src/tsk.css`, `src/components/tsk02-list.tsx`, `tsk03-board.tsx`, `tsk04-gantt.tsx`, `tsk05-task-modal.tsx`, `tsk-timesheet.tsx`; rota `/tasks` reescrita.
- Dados reais do backend (tabelas de tarefas, projetos, perfis); KPIs calculados por query, sem mock.
- O `TaskModal` atual (faturamento por entregável, checklist, timeline) tem regras de negócio que serão preservadas e migradas para o novo layout TSK-05 — nada de faturamento se perde.
- Entrego em 2 blocos: (1) TSK-02 + TSK-05, (2) TSK-03 + TSK-04, com screenshot de validação a cada bloco.

Depois de Tarefas, seguimos para o Financeiro (FIN-01 a FIN-04 e FIN-06).
