## O que vou construir

Um fluxo de **Faturas** (invoices) que agrupa vários itens em um único documento — podendo misturar projetos e clientes livremente, como você pediu.

### O que é "item faturável"

Para não confundir, vou padronizar em 2 tipos de item que aparecem na tela de faturamento:

1. **Cobranças pendentes** — cada vez que você clica hoje em "Faturar tarefa" o sistema cria uma *charge*. Hoje ela já vira lançamento solto. Passará a ficar em estado **"pendente de fatura"** até ser incluída em uma fatura.
2. **Tarefas prontas para faturar** — tarefas com faturamento ativado e etapa/status concluído que ainda não geraram cobrança. Selecionar a tarefa aqui gera a charge e já joga na fatura.

Verbas fixas do projeto (entrada, parcelas de fee) ficam para uma segunda leva — não estão no escopo agora.

### Telas

**1. `/invoices` — Central de Faturamento**
- Lista de faturas emitidas (nº, cliente, valor, status: rascunho / emitida / paga / cancelada, vencimento).
- Botão **"Nova fatura"** abre um wizard:
  - Passo 1 — Filtrar por cliente (opcional) e projeto (opcional). Deixando em branco, lista tudo pendente de todos.
  - Passo 2 — Grid com checkboxes de todos os itens pendentes (cobranças + tarefas prontas). Você marca o que entra. Total soma em tempo real.
  - Passo 3 — Dados da fatura (cliente pagador, emissão, vencimento, observações, condição de pagamento) e confirmação.
- Ao confirmar: cria `invoice` + `invoice_items`, marca cada charge como `invoice_id = X`, tarefas selecionadas viram charge nova já vinculada.
- Detalhe da fatura: PDF (via jspdf, mesmo padrão dos outros docs), marcar como paga, cancelar, reenviar.

**2. Atalho no Projeto — botão "Faturar"**
- Dentro do projeto abre o mesmo wizard já filtrado naquele projeto.
- Você ainda pode desmarcar itens ou adicionar itens de outros projetos do mesmo cliente antes de emitir.

**3. Ajuste na Tarefa**
- O botão hoje chamado "Faturar tarefa" muda para **"Marcar como faturável / Gerar cobrança"**: cria a charge em estado *pendente de fatura* (não some do financeiro, mas fica claro que ainda não tem NF/fatura).
- Nada quebra retroativo: charges existentes ficam como "avulsas" e podem ser anexadas a uma fatura depois.

### Banco de dados

Uso as tabelas que já existem (`invoices`, `invoice_items`, `charges`) e adiciono:
- `charges.invoice_id` (FK opcional para `invoices`) + índice.
- `charges.status` ganha o valor `pending_invoice` como padrão quando gerada por tarefa.
- `invoices.status` passa a controlar `draft | issued | paid | canceled`.

Numeração de fatura já existe (`assign_invoice_number`).

### Regras

- Fatura pode ter itens de projetos e clientes diferentes (livre, como pedido).
- Se misturar clientes, o campo "cliente pagador" da fatura é obrigatório e escolhido manualmente — os itens mantêm o cliente original para relatório.
- Cancelar fatura devolve as charges para `pending_invoice`.
- Marcar como paga escreve `paid_at` e propaga para as charges (`status = paid`).

### Fora de escopo agora
- Verbas/parcelas fixas do projeto na fatura.
- Envio por e-mail automático da fatura.
- Integração com emissor de NF-e.

Se estiver ok, sigo implementando.