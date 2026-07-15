Pixie Pro — Plano de construção

ERP interno para a Caritas Gestão Criativa. Cobre o funil completo: Lead → Proposta → Contrato → Plano de Marketing → Projeto → Tarefas/KPIs → Faturamento. Segue o layout das duas referências enviadas (dashboard com sidebar estreita à esquerda, seguindo o mesmo modelo de menu, que não cobre a lateral interia, se puder ser o mais literal possível, cards grandes com bordas arredondadas, usando as paletas em azul (que é a cor da marca), Usar sempre ícones ao invés de ilustração, e ser o mais parecido possível com a referência, entendendo que talvez não teremos os mesmos cards., tipografia display + sans limpa, suporte dark/light).

## Fase 1 — Fundação (esta iteração)

Vamos começar pela base sólida antes de espalhar em 10 módulos:

1. **Design system fiel às referências**
  - Tokens em `src/styles.css`: fundo claro `#F6F5FB` / dark `#0F1020`, primário violeta `#6C63FF` + glow, cards `card`, superfícies com `radius` ~20px, sombras suaves.
  - Tipografia: display "Sora" para títulos, "Inter" para corpo (carregadas via `<link>` no `__root.tsx`).
  - Toggle Light/Dark no header (pílula igual à referência).
2. **Shell da aplicação**
  - Sidebar fixa à esquerda estilo "ilha flutuante" (ícones Lucide, item ativo em card branco/violeta, badge PRO).
  - Header com nav (Dashboard · Workflows · Integrations), campo de busca com placeholder "Search or type command", toggle tema, sino de notificação, ícone settings, botão "Export data" e CTA sólido "Add new board".
  - Layout responsivo com grid principal.
3. **Lovable Cloud (backend)**
  - Habilitar Cloud, criar schema inicial: `organizations`, `profiles`, `user_roles`, `clients`, `leads`, `proposals`, `contracts`, `marketing_plans`, `projects`, `tasks`, `platform_kpis`, `team_members`, `charges`.
  - RLS por `organization_id` em todas as tabelas. Roles (`admin`, `manager`, `member`) em tabela separada com função `has_role`.
  - Auth email/senha + tela `/auth`, layout `_authenticated` protegendo rotas.
4. **Dashboard (M01) — tela âncora do design**
  Recriamos exatamente o layout da referência:
  - Saudação "Olá, [nome]! Quais são seus planos para hoje?" + 3 cards de atalho (Stay organized / Sync your notes / Collaborate).
  - Painel Notificações (com swipe editar/excluir).
  - Assignments em destaque (tarefa prioritária + tags + prioridade).
  - Mini-calendário mensal + agenda do dia.
  - Today tasks com barra de progresso, comentários, anexos.
  - Card "Go premium" violeta.
  - Cards de KPI (Data Research 90%, UX/UI 65%) e "Board meeting" com Reschedule/Accept.

## Fase 2 (próximas iterações, depois de você validar a fundação)

5. CRM Kanban (M02) + Drawer de lead
6. Propostas + Contratos (M03/M04)
7. Plano de Marketing com briefing por segmento (M05)
8. Projetos + Tarefas com 4 modelos de faturamento (M06/M07)
9. Plataformas & KPIs + relatório PDF (M08)
10. Financeiro / Cobranças (M09)
11. RH / Time (M10)

## Regras que respeitarei em todo o sistema

- Zero emoji, apenas ícones Lucide.
- Nenhum mock permanente — tudo vem do Cloud.
- Validação Zod em todo formulário.
- Rotas protegidas sob `_authenticated`.
- Cores/gradientes/sombras apenas via tokens semânticos em `styles.css` — nada de `bg-[#...]` em componentes.
- Plano aprovado → cria projeto automaticamente (trigger no banco).

## Perguntas rápidas antes de eu começar

1. Confirma que vamos usar **Lovable Cloud** (backend integrado, sem contas externas)? É o que o PRD pede como Supabase, e no Lovable é o equivalente sem setup.
2. Começamos pela **Fase 1 completa** (design system + shell + auth + dashboard funcional consumindo o banco) e depois seguimos módulo a módulo? Ou você prefere que eu já monte o **esqueleto de todas as rotas** (páginas vazias com layout) para você navegar antes?
3. O idioma da interface é **português (BR)** em tudo, certo? As referências estão em inglês mas o PRD é em PT.

Assim que confirmar, começo pela Fase 1.