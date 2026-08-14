# Briefings múltiplos + Financeiro completo

Três frentes: prévia/autosalvamento do briefing, vários briefings por projeto e um módulo financeiro no nível de um ERP de gestão (estilo Conta Azul).

## 1. Briefing com prévia e salvamento automático

A janela de briefing já tem a prévia lateral do documento. O que muda:

- **Rascunho automático**: cada alteração é gravada (debounce de ~800 ms) e também ao fechar a janela, clicar fora ou trocar de aba. Nada se perde; o botão "Salvar" passa a ser apenas a confirmação/finalização.
- **Indicador de estado** no rodapé: "Salvando…", "Salvo às 14:32", com barra de progresso de preenchimento já existente.
- Prévia continua espelhando em tempo real o que está sendo digitado, agora incluindo o nome do briefing e o modelo escolhido.

## 2. Vários briefings por projeto

Hoje o briefing é único (gravado na linha do projeto). Passa a existir uma lista:

- Nova tabela `project_briefings`: projeto, título, modelo usado, respostas, status (rascunho/concluído), autor, datas.
- Na aba **Estratégia** do projeto, o card de Briefing vira uma lista: "Briefing de marca", "Briefing de campanha eleitoral", "Briefing de lançamento"… com status, progresso e data.
- Ações: novo briefing (escolhendo qualquer modelo cadastrado em Configurações), duplicar, renomear, excluir e abrir.
- **Salvar como modelo**: qualquer briefing preenchido pode virar um modelo reutilizável em Configurações.
- O briefing existente de cada projeto é migrado para a nova lista, sem perda de dados.
- O documento consolidado da estratégia passa a incluir os briefings marcados como concluídos.

## 3. Financeiro completo (nível Conta Azul)

Estrutura nova de dados (mantendo o que já existe de faturas, cobranças e custos):

- **Contas bancárias / caixas**: saldo inicial, saldo atual, tipo (banco, caixa, cartão).
- **Plano de contas** hierárquico (receitas, custos diretos, despesas fixas/variáveis, impostos, pessoas), ampliando as categorias atuais.
- **Contas a pagar e a receber**: vencimento, valor, parcelas, fornecedor/cliente, projeto (centro de custo), anexo de comprovante, status (previsto, vencido, pago/recebido, parcial).
- **Baixas e conciliação**: registrar pagamento/recebimento em uma conta bancária, com data efetiva e valor real; extrato por conta com saldo corrido.
- **Recorrências**: geração automática de lançamentos mensais (aluguel, salários, assinaturas, contratos).

Telas do módulo Financeiro (abas laterais):

1. **Visão geral** — saldo consolidado, a receber/a pagar dos próximos 30 dias, inadimplência, resultado do mês.
2. **A receber** e **A pagar** — listas com filtros por período, status, cliente/fornecedor e projeto; baixa em lote.
3. **Extrato / Contas** — movimentações por conta bancária com saldo acumulado e conciliação.
4. **Fluxo de caixa** — realizado x previsto por mês, projeção de saldo, alerta de saldo negativo.
5. **DRE** — receita bruta, deduções, custos diretos, despesas, resultado operacional e líquido por período (já existe, será ligado ao novo plano de contas).
6. **Análise inteligente** — rentabilidade por projeto, cliente e tipo de serviço, custo de mão de obra x preço praticado, sugestão de preço, reserva de emergência e meta de lucro (evolução do que já existe).
7. **Relatórios** — exportação CSV/PDF por período e por centro de custo.

Integrações: faturas emitidas geram contas a receber automaticamente; custos de projeto e folha do RH geram contas a pagar; a baixa reflete no fluxo de caixa e no DRE.

## Detalhes técnicos

- Migrações criam `project_briefings`, `financial_accounts`, `financial_transactions` (a pagar/receber com baixas), `financial_account_entries` (extrato) e ampliam `finance_categories` com hierarquia e natureza contábil; todas com RLS por organização e GRANTs.
- Autosave do briefing via mutation com debounce e React Query otimista.
- Cálculos financeiros centralizados em `src/lib/finance-analytics.ts` (extensão), reaproveitando a estética atual do módulo.

## Ordem de entrega

1. Briefing: autosave + prévia (rápido).
2. Briefings múltiplos por projeto + modelos.
3. Financeiro: base de dados e A pagar/A receber/Extrato.
4. Financeiro: fluxo de caixa, DRE ligado ao plano de contas, análise e relatórios.
