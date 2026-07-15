## Objetivo

Transformar o dashboard atual em uma grade personalizável: cada usuário vê widgets diferentes conforme sua função (preset), e pode ligar/desligar/reordenar tudo em um painel lateral "Personalizar".

## Como vai funcionar

**1. Registro de widgets (extensível)**
Um único arquivo `src/lib/dashboard-widgets.tsx` lista todos os widgets disponíveis. Cada widget tem:
- `id` estável (ex.: `tasks.today`, `finance.revenue`, `hr.birthdays`)
- `category` (Tarefas, Projetos, Financeiro, RH, Agenda, Comercial, Notificações, Outros)
- `title`, `description`, `icon`
- `size` padrão (small / medium / large — mapeia para col-span do grid)
- `component` que já sabe buscar seus próprios dados
- `roles` sugeridas (para os presets)

Novos módulos futuros só precisam adicionar uma entrada nesse arquivo — nada mais muda.

**Widgets iniciais** (cobrindo os módulos existentes):
- Tarefas: Tarefas de hoje, Minhas tarefas, Atribuições, Concluídas hoje, Prazos em 7 dias
- Projetos: Projetos ativos, Próximas entregas, Status geral
- Financeiro: Faturamento, Despesas, Lucro, MRR, Pipeline, Conversão, Contas a receber
- RH/Equipe: Membros ativos, Aniversariantes, Férias
- Agenda: Próxima reunião, Mini calendário
- Comercial: Leads no funil, Propostas em aberto
- Outros: Notificações, KPIs de plataforma, Saudação

**2. Presets por função**
Ao concluir o onboarding, o `role_title` do perfil determina o preset inicial:
- Admin/Diretor → dashboard completo (visão macro)
- Financeiro → foco em Financeiro + Agenda
- Projetos/PM → Projetos + Tarefas + Agenda
- RH → RH + Agenda + Notificações
- Comercial → Comercial + Financeiro (pipeline)
- Operacional/Designer → Tarefas + Projetos

O usuário pode editar livremente depois.

**3. Painel lateral "Personalizar"**
Botão "Personalizar" no cabeçalho do dashboard abre um `Sheet` lateral com:
- Lista de widgets agrupada por categoria
- Toggle (Switch) para ligar/desligar cada widget
- Setas ↑↓ para reordenar (drag-and-drop fica para uma iteração futura para manter o escopo)
- Botão "Restaurar preset da minha função"
- Preferências salvas automaticamente

**4. Persistência**
Nova tabela `dashboard_preferences` (user_id, widgets jsonb, updated_at) com RLS por `auth.uid()`. Se o usuário ainda não tem preferências, aplica o preset da role no primeiro carregamento e salva.

## Ajuste já feito

Card **"Tarefas de hoje"** agora renderiza no máximo 4 linhas, cresce só conforme o conteúdo e não usa barra de rolagem. Um link "Ver todas (N)" aparece quando há mais.

## Detalhes técnicos

- **Migration**: `dashboard_preferences (user_id uuid PK, widgets jsonb not null default '[]', updated_at timestamptz)` + GRANTs + RLS (user só lê/edita as próprias) + trigger `set_updated_at`.
- **Query**: `useSuspenseQuery` carrega preferências junto do dashboard; server-side `upsert` via `createServerFn` com `requireSupabaseAuth` quando o usuário salva.
- **Grid**: layout continua em `grid-cols-12`; cada widget declara seu `colSpan` (4/6/8/12) e o render itera na ordem salva.
- **Presets**: função `getPresetForRole(role_title)` que devolve a lista ordenada de widget ids.
- **Fallback**: se `role_title` não bate com nenhum preset conhecido, aplica o preset "Admin" (completo).

## Fora do escopo desta etapa

- Drag-and-drop visual (fica ↑↓ por enquanto)
- Configuração fina por widget (ex.: escolher qual métrica específica dentro do card Financeiro) — cada widget hoje é "ligado/desligado" inteiro
- Compartilhar layouts entre usuários
