## Objetivo
Trocar o autosave da janela de tarefa por um botão **Salvar** explícito, com aviso quando você tenta sair com alterações não salvas.

## Como vai funcionar

- Toda edição no modal (título, descrição, status, prioridade, prazo, etapa, entregáveis, subtarefas, faturamento, transmissão, responsável, tipo, plataforma, etc.) passa a atualizar **apenas o estado local**. Nada vai ao banco até você clicar em **Salvar**.
- Um botão **Salvar** fixo aparece no cabeçalho do modal:
  - Fica **desabilitado** quando não há alterações;
  - Fica **destacado em azul** quando há alterações pendentes;
  - Ao clicar, envia tudo em uma única gravação e mostra confirmação.
- Um indicador "Alterações não salvas" aparece ao lado do botão quando há mudanças.
- Ao fechar (X, minimizar, ESC, clique fora ou trocar de tarefa) com alterações pendentes, aparece um diálogo:
  ```text
  Você tem alterações não salvas nesta tarefa.
  [Salvar]   [Sair sem salvar]   [Cancelar]
  ```
- Atalho `Ctrl/Cmd + S` dentro do modal salva.
- Ações que já criam registros em outras tabelas (faturar tarefa, faturar entregável) continuam salvando imediatamente — elas exigem a tarefa persistida — mas antes de rodar vão pedir para salvar as pendências.

## Casos especiais

- **Rascunho local (tarefa nova)**: só é gravado no banco ao clicar em Salvar. Se fechar sem salvar, o rascunho é descartado.
- **Mudança de etapa/status**: continua atualizando visualmente na hora (progresso, subtarefas automáticas do checklist), mas só persiste ao salvar.
- **Excluir tarefa**: mantém o comportamento atual (confirma e apaga direto).

## Detalhes técnicos

Arquivo: `src/routes/_authenticated/tasks.tsx` (componente `TaskModal`).

- Substituir todas as chamadas `save.mutate({...})` espalhadas por um único `markDirty()` que apenas seta um `isDirty` local.
- Novo `handleSave()` monta o patch completo com o estado atual e chama uma única `update` no Supabase (ou `insert` no caso de rascunho).
- Interceptar `onClose`: se `isDirty`, abrir `AlertDialog` com as três opções.
- Remover o `onBlur` de cada campo (já não precisa disparar save).
- Preservar o cálculo automático de progresso e a injeção de subtarefas ao mudar de etapa.
