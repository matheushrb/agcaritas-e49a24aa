# Plano — Pixie Pro v2 (baseado no PDF do usuário)

Documento-guia: `Pixie_Telas_v2-2.pdf` — 13 módulos, 18 páginas, 8 drawers, 6 modais.

## Regra de menu
Sidebar segue o doc: **Dashboard · CRM · Propostas · Projetos · Financeiro · Agenda · RH** + **Configurações** no rodapé. Nada mais entra na sidebar; módulos como Metas, Campanhas Internas, Fornecedores, Ideias, Aprovação Pública ficam acessíveis por links contextuais (dentro do módulo pai).

## Feito nesta rodada
- [x] Sidebar realinhada aos 7 ícones do doc + Configurações + Sair
- [x] TopBar limpa (removidos botões "Exportar" e "Novo projeto" que não funcionavam; Sino → /notifications, Engrenagem → /settings)
- [x] Rota `/settings` com 7 abas (Dados Agência · Serviços · Plataformas · Fluxos de Tarefa · Funil CRM · Usuários · Integrações)
- [x] Rota `/clients` (lista + filtros + novo cliente com EntityDialog)
- [x] Financeiro já tem as 5 abas internas (Visão Geral · Movimentações · Faturamentos · DRE · Parâmetros)

## Próximas rodadas (ordem sugerida)

### R2 — Cliente
- [ ] `/clients/$clientId` com 4 abas: Dados · Contatos · Projetos · Propostas
- [ ] Auto-fill de CNPJ (ReceitaWS) e CEP (ViaCEP)
- [ ] Vínculo com projetos/propostas existentes

### R3 — Tarefas (Módulo 02)
- [ ] Split-panel desktop + drawer mobile
- [ ] Drawer T03 com 4 abas: Detalhes · Uploads · Faturamento · Atividade
- [ ] Turbo Financeiro (reordena por valor)
- [ ] Kanban view (dnd)
- [ ] Timer com widget flutuante ao minimizar

### R4 — CRM (Módulo 03)
- [ ] Kanban T04 com temperatura do lead + alerta de follow-up
- [ ] Detalhe do Lead T05 com 6 abas: Atividades · Stakeholders · Reuniões · Briefing · Social · Agente IA

### R5 — Propostas (Módulo 04)
- [ ] T06 Nova proposta com 2 colunas + resumo ao vivo
- [ ] T14 Lista com status e ações (···)
- [ ] T15 Detalhe com Diagnóstico · Plano de Execução · Contrato
- [ ] Página pública `/p/$token` (T21)

### R6 — Projetos (Módulo 05)
- [ ] Reorganizar abas em `/projects/$projectId` conforme doc
- [ ] Aba Estratégia completa (SWOT · Personas · Concorrentes · Roadmap · KPIs · Plano de ação · IA)
- [ ] T16 Calendário de Conteúdo (aba condicional)
- [ ] T17 Grid de Conteúdo (Kanban por status)
- [ ] Wizard de novo projeto (tipo · faturamento · urgência · ferramentas · verba tráfego · verbas outras · toggles de planejamento) — solicitado pelo usuário

### R7 — Agenda (Módulo 07)
- [ ] T09 Grade semanal com 3 abas (Planejamento · Entregas pendentes · Vencimentos)
- [ ] Snap 15min · drag para mover · resize
- [ ] Sync Google Calendar

### R8 — RH (Módulo 08)
- [ ] T10 Lista + detalhe com 5 abas (Dados · Custos · Folha · Acesso · Histórico)
- [ ] Simulação de encargos por tipo de contrato

### R9 — Módulos secundários
- [ ] Metas (T18) — acessível via Dashboard
- [ ] Campanhas Internas (T19) — acessível via Marketing/Projetos
- [ ] Fornecedores (T20) — acessível via Financeiro
- [ ] Banco de Ideias — acessível via Projetos/CRM
- [ ] Aprovação Pública `/aprovar/$token` (T22)

### R10 — Configurações — editores dedicados
- [ ] T23 Fluxos de Tarefa (stage sets)
- [ ] T24 Plataformas com regras de prazo
- [ ] Serviços (catálogo)
- [ ] Funil CRM (etapas)
- [ ] Usuários (papéis, convites)
- [ ] Integrações (Buffer, Google Calendar)

## Tabelas ainda não criadas
Serão migradas por rodada, junto do módulo correspondente:
- `stage_sets`, `stages`, `stage_checklist_items` (R10)
- `platforms`, `platform_delivery_rules` (R10)
- `services_catalog` (R10)
- `crm_stages` (R10)
- `time_entries` (já existe)
- `subtasks`, `task_uploads`, `task_activity` (R3)
- `content_items` (já existe — usar em R6)
- `payroll_records` (R8)
