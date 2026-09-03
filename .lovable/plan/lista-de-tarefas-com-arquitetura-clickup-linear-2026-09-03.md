# Lista de tarefas com arquitetura ClickUp/Linear

## Objetivo
Reorganizar somente a visualização **Lista** de `/tasks`, aproveitando a arquitetura da referência sem perder os dados, filtros, paginação, temas ou ações existentes da Caritas.

## O que será alterado
- Criar uma única definição de `grid-template-columns`, compartilhada pelo cabeçalho e por todas as linhas.
- Deixar apenas **Tarefa** flexível; manter slots estáveis para expansão, status visual, responsável, prazo, projeto, etapa, prioridade, progresso e ações.
- Separar visualmente as três camadas: cabeçalho de grupo, cabeçalho de colunas e linhas.
- Manter grupos por etapa recolhíveis, com badge e contador fora do grid de dados.
- Fixar a altura das linhas, impedir quebras e aplicar truncamento consistente, sem divisórias verticais nem zebra.
- Unir título, código e contador de comentários dentro da célula de tarefa.
- Exibir avatar sozinho e centralizado; usar traço para campos vazios e badges compactos pela largura do conteúdo.
- Permitir expandir subtarefas abaixo da tarefa, com indentação no nome e sem abrir a janela da tarefa.
- Tornar status e progresso editáveis inline, preservando a abertura da tarefa ao clicar no restante da linha.
- Adicionar ordenação clicável para prazo e progresso, com indicação no cabeçalho.
- Manter o menu de ações, seleção, criação rápida, arquivamento e paginação já existentes.

## Adaptação das propriedades
A tabela usará propriedades reais disponíveis no sistema, em vez de inventar colunas mockadas:

```text
[expandir] [estado] [Tarefa flexível] [Responsável] [Prazo]
[Projeto] [Status] [Etapa/Tipo] [Progresso] [Prioridade] [Ações]
```

Em telas menores, a grade continuará inteira dentro do scroll horizontal, sem comprimir ou desalinhá-la.

## Direção visual
- Fonte atual do produto, aproximadamente 12–13 px.
- Linhas densas, mas com respiro suficiente para leitura.
- Fundo e cores vindos dos tokens atuais, funcionando nos temas claro e escuro.
- Hover discreto, badges translúcidos e nenhuma linha vertical entre colunas.

## Validação
- Conferir alinhamento idêntico entre cabeçalho e linhas.
- Testar recolhimento de grupos, expansão de subtarefas, edição inline, ordenação e abertura da tarefa.
- Validar visualmente em `/tasks` no viewport atual e em largura de notebook.
