# Projetos, Propostas, Faturamento e Faturas — Plano

Peguei a lógica do documento (fluxo Proposta → Projeto → Tarefa → Fatura → Conta a Receber/Pagar, com competência vs. caixa) e adaptei ao que já existe hoje no Caritas: `tasks` com `deliverables`, `charges`, `proposals`, `projects`, `clients`, `task_types` com etapas configuráveis. Nada é reescrito do zero — os módulos serão evoluídos.

## Princípios que vou aplicar

- **4 módulos independentes ligados por regras claras**: Propostas, Projetos, Tarefas (já feito), Faturamento (evoluir).
- **Competência ≠ Caixa**: toda métrica financeira sabe se olha competência (DRE, Faturamento) ou caixa (Fluxo).
- **Anti-rebilling**: uma tarefa/entregável só entra em fatura uma vez (`billed=true` bloqueia).
- **Documentos profissionais/industriais**: paleta densa (navy escuro, grafite, off-white, um único acento vibrante), tipografia editorial (display serifado + sans técnico), cabeçalhos com faixas, numeração vertical, réguas grossas — nada do visual "azulzinho suave" do exemplo.

## 1. Projetos — o que muda

Hoje já temos wizard e detalhe. Vou completar o modelo de dados e as regras:

- Campos novos em `projects`: `billing_model` (`fixed` mensal / `accumulative` por entrega), `monthly_value`, `hourly_rate`, `traffic_budget`, `printing_budget` (verbas repassadas, não são receita), `social_platforms` (JSON com plataforma + @handle), flags `has_content_calendar / has_content_grid / has_timeline`.
- **Regra dura**: `task.due_date` nunca pode ultrapassar `project.due_date` — bloqueio no formulário de tarefa.
- Verbas de tráfego/impressão entram como categoria própria em Faturamento (repasse), separadas de receita operacional.

## 2. Propostas — reescrita da rota pública

Modelo de dados: `proposals` ganha `doc_number` (auto PRO-0001), `intro_text`, `scope_text`, `exclusions_text`, `terms_text`, `warranty_text`, `diagnosis_blocks` (JSON), `execution_plan_blocks` (JSON), `payment_type` (`a_vista`/`parcelado`/`recorrente`), `installments_count`, `recurrence_interval`, `first_due_date`, `valid_until`, `start_date_expected`, `end_date_expected`, `public_token` (UUID), aprovador (`approved_at/by_name/by_email/approval_notes`), status `draft|sent|viewed|approved|rejected|expired`. Tabela filha `proposal_items` (ordem, descrição, qtd, valor unitário).

**Link público sem login** (`/p/:token` já existe): RLS libera SELECT anônimo só quando o token bate; UPDATE anônimo só nos campos de aprovação/rejeição. Ao abrir, se `status='sent'`, vira `'viewed'`. Botões Aprovar / Recusar coletam nome, e-mail e observação. `valid_until` expirado bloqueia acesso.

**Aprovar dispara**: criação de Projeto herdando cliente, valores, `billing_model`, datas previstas e itens (viram tarefas/serviços iniciais); status `approved` bloqueia edição comercial.

## 3. Faturamento — três passos

Módulo `/finance` ganha aba **Faturamento** com o fluxo:

- **Passo 1 · Gerar**: lista por cliente tudo que pode ser cobrado — tarefas com `billing_enabled=true`, `status=done`, valor > 0, `billed=false`; entregáveis faturáveis vinculados; valores mensais de projetos `fixed`; serviços avulsos. Agrupa por cliente e competência.
- **Passo 2 · Emitir**: revisão, edição de valores/descrições, geração de PDF, `status='emitida'`. Tarefas/entregáveis viram `billed=true` (bloqueia rebilling).
- **Passo 3 · Cobrar**: cria automaticamente:
  - 1× `charge` type=`receber`, nature=`recebimento_cliente`, `status='previsto'`, com `competence_month` e `due_date`.
  - Para cada colaborador com custo nas tarefas incluídas: 1× `charge` type=`pagar` (`Pagamento Colaborador`).
- **Excluir fatura**: reverte `billed` das tarefas/entregáveis e remove a conta a receber vinculada.
- **Numeração imutável**: `YYYYMM-{seq}`.

## 4. Modelo de dados novo

- `invoices` (fatura): `number` (YYYYMM-seq), `client_id`, `competence_month`, `issue_date`, `subtotal`, `discount`, `total`, `status` (`draft|issued|paid|cancelled`), `mode` (`detailed|summary`), `notes`, `payment_terms`, `pdf_url`, `financial_transaction_id`.
- `invoice_items`: `invoice_id`, `project_id`, `task_id`, `deliverable_key`, `service_label`, `description`, `item_date`, `quantity`, `unit_price`, `total`, `is_subitem`, `parent_item_id`, `sort_order`.
- `charges` (evoluir a atual): garantir `type` (`receber|pagar`), `nature` (`recebimento_cliente|servico_avulso|custo_fixo|custo_variavel|midia_paga|reembolso_pago|imposto|pro_labore|saque|investimento`), `status` (`previsto|pago|atrasado`), `competence_month`, `paid_date`, `invoice_id`, `project_id`, `client_id`.
- Todas as tabelas seguem o padrão: GRANT `authenticated`, `service_role`, RLS por `organization_id`.

## 5. Natureza e DRE

Naturezas alimentam o DRE já existente:

- Receita operacional: `recebimento_cliente`, `servico_avulso`
- Despesa operacional: `custo_fixo`, `custo_variavel`, `midia_paga`, `reembolso_pago`
- Tributos: `imposto`
- Abaixo do operacional: `pro_labore`
- Fora do DRE: `saque`, `investimento`

Helper central `financial-monthly-metrics.ts` para: faturado (competência), recebido (caixa), despesa (competência), vencimentos (due_date). Todas as telas passam a ler daqui — nenhum cálculo solto.

## 6. PDFs profissionais/industriais

Motor: jsPDF (mesmo do antigo, mas identidade completamente refeita).

**Paleta industrial**:

```text
ink        #0A0F1C (quase preto azulado)  títulos, totais, réguas
graphite   #2A3140                        corpo, cabeçalhos secundários
steel      #6B7280                        metadados, CNPJ, rodapé
line       #1F2937 (100% opacity, 0.4pt)  réguas grossas divisórias
paper      #F5F4EF (off-white quente)     fundos de bloco
accent     #C1440E (terra queimada) OU    faixa vertical, número do doc,
           #0F5FA6 (cobalto)              badges de status
```

**Tipografia**: display serifado condensado (Fraunces ou Playfair) para títulos + sans técnico (Söhne/Inter Tight) para corpo + mono (JetBrains Mono) só para números de documento e valores tabulares.

**Fatura — layout industrial**:

```text
┌───────────────────────────────────────────────────────────┐
│ AGÊNCIA CÁRITAS         ▍ FATURA         Nº 202507-0042   │  ← faixa vertical do accent
│ ─────────────────────────────────────────────────────────  │
│ COMPETÊNCIA JUL/2025    EMISSÃO 17.JUL.2025               │
│                                                            │
│ DE                          │ PARA                         │
│ Agência Cáritas             │ Instituto Horizonte Ltda.    │
│ CNPJ 45.678.123/0001-55     │ CNPJ 12.345.678/0001-90     │
│ endereço · fone · e-mail    │ contato                      │
│                                                            │
│ ═══════════════════════════════════════════════════════    │  ← régua grossa
│  # ITEM                    DATA    SERVIÇO       VALOR    │
│ ─────────────────────────────────────────────────────────  │
│ 01  INSTITUTO HORIZONTE — BRANDING 2025      R$ 8.600,00  │  ← header projeto em caixa alta
│     Campanha institucional      05/07  Gestão   3.500,00  │
│     ↳ Roteiro vídeo manifesto   08/07  Copy       900,00  │
│     ↳ Captação e edição         12/07  Audio    2.400,00  │
│ ─────────────────────────────────────────────────────────  │
│                                     TOTAL   R$ 15.150,00  │  ← bloco em ink, texto em paper
│                                                            │
│ CONDIÇÕES  Pagamento em 5 dias úteis. Atraso: multa 2%…   │
│ PAGAMENTO  Banco Inter 077 · Ag 0001 · CC 12345678-9      │
│            PIX financeiro@agcaritas.com.br                 │
├───────────────────────────────────────────────────────────┤
│ AGÊNCIA CÁRITAS · DOCUMENTO 202507-0042            01/01  │  ← rodapé em toda página
└───────────────────────────────────────────────────────────┘
```

Modos `detailed` (agrupado por projeto, subtarefas indentadas com ↳) e `summary` (agrupado por serviço).

**Proposta — layout industrial**: mesma paleta, capa forte com número da proposta em display serifado gigante, faixa lateral com metadados verticalizados, seções numeradas (01/02/03…), blocos de diagnóstico e plano de execução em cards de papel off-white com régua superior, tabela de itens com totalizador dominante, bloco de assinatura/aprovação online destacado. Página pública `/p/:token` compartilha componentes visuais com o PDF (mesmo cabeçalho, mesmas tabelas), então o cliente vê o mesmo peso visual online e no download.

## 7. Ordem de execução

1. **Migração de banco**: `invoices`, `invoice_items`, evolução de `charges` (nature, competence_month, paid_date, invoice_id), campos novos em `projects` e `proposals`, GRANTs e RLS.
2. **Faturamento**: tela nova `/finance/billing` com os três passos, respeitando `billed` e naturezas.
3. **PDF de Fatura** com identidade industrial + preview blob + download.
4. **Propostas**: campos novos + editor rico dos blocos + PDF industrial + página pública `/p/:token` refeita com o mesmo peso visual + aprovação online → cria Projeto.
5. **Projetos**: fecha os campos que faltam (`billing_model`, verbas, plataformas, flags), aplica regra `task.due_date ≤ project.due_date`, expõe abas condicionais pelas flags.
6. **Helpers financeiros**: `financial-monthly-metrics.ts` + refactor das telas que ainda calculam solto.

## Detalhes técnicos (para quem for ler o código depois)

- Todas as tabelas em `public` seguem o padrão do projeto: GRANT `authenticated` + `service_role`, RLS por `organization_id` via `has_role` / policy simples.
- `public_token` da proposta é UUID v4, com policy SELECT anônimo `USING (public_token = current_setting('request.jwt.claim.token', true)::uuid OR true)` filtrada por WHERE no client — na prática o front-end busca `.eq('public_token', token)` e a policy só libera essa linha.
- PDFs em `src/lib/pdf/invoice.ts` e `src/lib/pdf/proposal.ts`, com um `pdf-theme.ts` central para paleta e tipografia — trocar acento em um arquivo muda os dois documentos.
- `charges` continua sendo a tabela financeira única (contas a receber e a pagar); `invoices` só agrega itens e vira 1..N charges.
- Nada de edge functions: tudo em `createServerFn` ou direto no client via RLS. PDF é gerado no browser (jsPDF) para preview instantâneo; upload para storage é opcional (posso deixar como Passo 8 se quiser histórico versionado).

Se aprovar, começo pela migração de banco + módulo de Faturamento (passos 1 e 2 acima) — é o que trava a operação hoje. Propostas e PDFs entram na sequência.
