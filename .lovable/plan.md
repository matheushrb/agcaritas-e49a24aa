## Observação importante antes de começar

O prompt que você mandou foi escrito para outro projeto (fala em `src/pages/Dashboard.tsx`, queries `ops/crm/financial/txs`, rotas `/tarefas`, `/propostas`, tabelas `deal_meetings`, `financial_parameters`). Nada disso existe aqui. No nosso sistema o dashboard é:

- `src/routes/_authenticated/dashboard.tsx` (rota + queries `dashboard`, `profile`, `dashboard-preferences`)
- `src/lib/dashboard-widgets.tsx` (registro de widgets + personalização)
- `src/components/dashboard/day-panels.tsx` (Central do dia, Prioridades, Agenda, Receita, Projetos, Clientes)

Então vou reproduzir **o visual e a posição exata da referência**, usando nossas tabelas reais (`tasks`, `calendar_events`, `proposals`, `invoices`, `projects`, `clients`) e mantendo a personalização de widgets funcionando.

## Layout final (igual à referência)

```text
Bom dia, Matheus! 👋                                   [+ Novo] [Personalizar]
Aqui está o seu workspace diário

[✓ 4 tarefas para hoje] [📅 2 reuniões] [R$ pendente] [2 aprovações]   <- pills

┌──────────────────────┬──────────────┬───────────────┐┌──────────────┐
│ Central do dia       │ Prioridades  │ Agenda de hoje││ Receita do mês│
│ Terça, 28 de Julho   │ do dia       │ 08:00 Livre   ││ R$ + ↑14%     │
│ [Tudo|Tar|Reu|Fin|Ap]│ 🔥 Urgente   │ 09:00 evento  ││ Meta + 65%    │
│ 09:00 ● item  badge  │ ⭐ Importante│ 11:00 evento  ││ sparkline     │
│ 11:00 ● item  badge  │ 📅 Hoje      │ ...           │├──────────────┤
│ ...                  │ 🗓 Esta sem. │               ││ Projetos ativos│
│ Ver todas →          │              │ + Novo comp.  ││ donut 18 ativos│
└──────────────────────┴──────────────┴───────────────┘├──────────────┤
                                                       ││ Clientes ativos│
                                                       ││ 32 +5 avatares │
                                                       └└──────────────┘
```

Grid de 12 colunas: Central do dia = 4, Prioridades = 2, Agenda = 3, coluna direita de KPIs = 3 (empilhando Receita / Projetos / Clientes). Em telas menores tudo empilha.

## O que muda em cada arquivo

**`src/components/dashboard/day-panels.tsx`** (reescrita dos painéis)

- **Faixa de pills**: novo componente `DayQuickStats` com 4 pills clicáveis — tarefas de hoje, reuniões de hoje, valor pendente de recebimento (soma de `invoices` não pagas), propostas aguardando aprovação. Ícone quadrado colorido + número grande + label pequeno, exatamente como na imagem.
- **Central do dia**: abas como na referência (sublinhado azul no ativo + contador em badge, no lugar dos pills atuais), cabeçalho com "Terça, 28 de Julho" e chip "Hoje" à direita. Cada linha passa a ter coluna de **horário à esquerda**, bolinha de status, ícone quadrado colorido, título + subtítulo, e badge de tipo à direita (Tarefa / Reunião / Financeiro / Aprovação / Documento). Itens vencendo hoje ganham o badge vermelho "Vence hoje". Rodapé "Ver todas as atividades →".
- **Prioridades do dia**: passa a ser agrupada por nível — 🔥 Urgente, ⭐ Importante, 📅 Hoje, 🗓 Esta semana — em cards separados com barra/label colorido no topo, como na imagem (hoje é uma lista simples).
- **Agenda de hoje**: vira timeline por hora (08:00 → 18:00). Horas sem evento mostram a linha e "Livre" quando o dia está vazio; horas com evento mostram o card com título e subtítulo. Mantém "Ver agenda completa" e "+ Novo compromisso".
- **Receita do mês**: mantém a query atual e ganha a **linha de meta** (`Meta: R$ X` + % à direita) e um gráfico de área suave em vez das barras, com o ponto final destacado. Meta virá das configurações de precificação já existentes; se não houver meta cadastrada, a linha some.
- **Projetos ativos**: donut multi-cor (Prospecção / Em andamento / Concluídos) com número central "18 ativos" e legenda com bolinhas coloridas à direita — hoje é um anel de um só valor.
- **Clientes ativos**: número + "+N este mês" + fileira de avatares circulares com contador "+12", como na imagem (hoje é uma lista de nomes).

**`src/lib/dashboard-widgets.tsx`**

- Registrar o widget novo `day-quickstats` (as pills), definir os colSpans do novo grid (4/2/3/3, com a coluna direita agrupando os 3 KPIs em um único widget de coluna) e incluir os ids novos nos presets. Mantém tudo que já existe — nenhum widget é removido, só reposicionado.

**`src/routes/_authenticated/dashboard.tsx`**

- Saudação dinâmica ("Bom dia/Boa tarde/Boa noite, {nome}! 👋" + "Aqui está o seu workspace diário") no topo, com **+ Novo** e **Personalizar** à direita, na mesma linha — igual à referência.

## Detalhes técnicos

- Todas as cores saem dos tokens semânticos do `src/styles.css` (nada de hex fixo), então o modo escuro azul-marinho da segunda metade da imagem sai automático.
- Sem estilos inline: Tailwind + os componentes shadcn já usados.
- Novas leituras: `invoices` (pendente), `proposals` (aprovações) e a meta mensal; tudo com TanStack Query, sem alterar banco de dados.
- Personalização continua respeitando o que você desativou; os widgets novos entram habilitados uma vez só.

## Fora do escopo desta etapa

Barra de busca global, sino de notificações e avatar no topo (isso é do app shell, não do dashboard) — faço numa etapa seguinte se quiser.
