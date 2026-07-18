import { generateInvoicePDF } from "@/lib/pdf/invoice-pdf";
import fs from "fs";

async function main() {
  const doc = await generateInvoicePDF({
    number: "202507-0001",
    issue_date: "2025-07-18",
    due_date: "2025-07-25",
    client: {
      name: "Matheus Bunds",
      company: "Santa Carona",
      legal_name: "Santa Carona Produções Artísticas LTDA",
      document: "12.345.678/0001-90",
      email: "financeiro@santacarona.com",
      phone: "(11) 98765-4321",
      address: "Rua das Flores, 123 - São Paulo/SP",
    },
    agency: {
      name: "Caritas Agência",
      legal_name: "Caritas Agência de Marketing LTDA",
      document: "98.765.432/0001-10",
      email: "financeiro@caritas.ag",
      phone: "(11) 91234-5678",
      address: "Av. Paulista, 1000 - São Paulo/SP",
      website: "www.caritas.ag",
      logo_url: null,
    },
    lines: [
      {
        title: "Produção de conteúdo - Campanha Julho",
        detail: "Pack com 15 peças para redes sociais",
        qty: 1,
        unit_price: 4500,
        amount: 4500,
        reference_date: "2025-07-18",
      },
      {
        title: "Gestão de tráfego pago",
        detail: "Meta Ads e Google Ads - 30 dias",
        qty: 1,
        unit_price: 2800,
        amount: 2800,
        reference_date: "2025-07-18",
      },
      {
        title: "Entregáveis adicionais",
        is_child: true,
        amount: 1200,
        reference_date: "2025-07-20",
      },
    ],
    payment_terms: "Pagamento em 5 dias úteis via PIX ou link.",
    notes: "NF emitida após confirmação do pagamento.",
    payment_link: "https://pagamento.caritas.ag/inv_2025070001",
  });

  const out = "/tmp/invoice-test.pdf";
  fs.writeFileSync(out, doc.output());
  console.log("PDF gerado:", out);
}

main();
