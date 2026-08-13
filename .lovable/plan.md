# Elevar o visual do Caritas ao nível ClickUp

Plano visual (não executado agora) para deixar o sistema com aparência de produto profissional. Dividido em 5 frentes, da base para o detalhe.

## 1. Fundação: tokens e densidade

Hoje o sistema tem vários CSS por tela (`prj01.css`, `fin01.css`, `windows.css`, `tsk02.css`…), cada um com seus próprios raios, sombras e espaçamentos. O primeiro passo é uma camada única de tokens que todos consomem.

```text
--cv-space-1..6      4 / 8 / 12 / 16 / 24 / 32
--cv-radius-sm/md/lg 8 / 12 / 16
--cv-elev-1          0 1px 2px rgba(16,24,40,.06)
--cv-elev-2          0 4px 16px -6px rgba(16,24,40,.14)
--cv-row-h           36px (linhas de lista, igual ao ClickUp)
--cv-font-ui         13px / 1.45
```

Exemplo de padronização: todo card passa a ser `radius-lg + elev-1`, hover sobe para `elev-2` com `translateY(-1px)` em 120ms. Nada de sombra dura ou borda dupla.

## 2. Chrome do app (o que mais “vende” a sensação ClickUp)

- **Sidebar em dois níveis**: coluna estreita de ícones (56px) + painel de navegação contextual (240px) que muda conforme o módulo (em Projetos lista os projetos favoritos; em Financeiro lista Fluxo, DRE, Lançamentos).
- **Topbar com breadcrumb vivo**: `Projetos / Portus / Estratégia` com dropdown em cada nível para trocar de item sem voltar.
- **Barra de comandos ⌘K** unificando busca global, criar tarefa, criar lançamento, abrir projeto.
- **Barra de abas de itens abertos** (estilo navegador) — tarefas e lançamentos abertos ficam como pílulas no rodapé, retomáveis com um clique. Você já tem os modos minimizado/docked; isso vira a UI oficial disso.

## 3. Listas e tabelas de verdade

O ClickUp é reconhecido pela tabela densa e configurável. Exemplo aplicado às tarefas:

```text
▸ Portus · Social                                   12 tarefas   R$ 8.400
  ⬚  Reels institucional      Em produção  Ana  12/ago  ●●●○○ 60%   R$ 1.200
  ⬚  Carrossel lançamento     Aprovação    Léo  14/ago  ●●●●○ 80%   R$   900
```

- Linha de 36px, hover revela ações à direita (comentar, faturar, mais).
- Cabeçalho de coluna com menu: ordenar, agrupar por, ocultar, fixar.
- Grupos colapsáveis com somatório na régua do grupo.
- Seleção múltipla com barra de ação flutuante (“3 selecionadas · Mudar etapa · Faturar · Arquivar”).
- Edição inline: clicar na célula de etapa abre o seletor no lugar, sem modal.

## 4. Componentes-assinatura

- **Chips de status/etapa**: pílula com ponto colorido, fundo em 10% da cor, texto na cor 700 — um só componente para toda a app.
- **Avatares**: 24px, empilhados com `-6px`, borda da cor do fundo, `+N` no excedente.
- **Barra de progresso**: 4px, cor por faixa (vermelho <50, âmbar <80, verde), com tooltip do cálculo.
- **Empty states ilustrados**: ícone grande esmaecido + título + 1 ação primária (hoje são frases soltas).
- **Skeletons** em vez de “Carregando…”, respeitando a forma final do conteúdo.
- **Toasts com ação** (“Tarefa arquivada · Desfazer”).

## 5. Movimento e polimento

- Modais entram com `scale(.98) → 1` + fade em 140ms; drawers deslizam 180ms `cubic-bezier(.22,1,.36,1)`.
- Kanban com drag ghost translúcido e placeholder pontilhado na coluna de destino.
- Foco visível consistente (anel de 3px em 16% do primário) em todos os controles.
- Dark mode revisado por componente, não por correção pontual: um arquivo de tema, não `dark-fixes.css`.

## Ordem sugerida de execução

1. Tokens + densidade global (base para tudo, baixo risco).
2. Chips, avatares, progresso, skeletons e empty states (ganho visual imediato em todas as telas).
3. Tabela/lista padrão + seleção múltipla + agrupamento (maior impacto percebido).
4. Sidebar em dois níveis, breadcrumb e ⌘K.
5. Barra de itens abertos e refinamento de movimento.

Cada etapa é entregável sozinha; dá para parar em qualquer ponto sem quebrar o resto.
