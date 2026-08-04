import { generateInvoicePDF } from "@/lib/pdf/invoice-pdf";
import fs from "fs";

const logo = "data:image/jpeg;base64," + fs.readFileSync("/tmp/caritas-logo-pdf.jpg").toString("base64");

const item = (t: string, d: string, s: string, v: number, child = false, group?: string) => ({
  title: t, reference_date: d, service: s, amount: v, is_child: child, group: group ?? null,
});

const g1 = "Pergunte ao Catequista 2026.04 | ABRIL";
const g2 = "Manual Católico 04.MARÇO";

async function main() {
  const doc = await generateInvoicePDF({
    number: "202605139",
    competence: "Abr 2026",
    issue_date: "2026-05-12",
    due_date: "2026-06-12",
    client: {
      name: "LAIZA ROSA R N DAS MERCES",
      legal_name: "LAIZA ROSA R N DAS MERCES",
      document: "37.098.624/0001-01",
    },
    agency: {
      name: "Agência Caritas",
      legal_name: "Agência Caritas",
      document: "35.627.997/0001-99",
      address: "PARQUE BRASILIA 2A ETAPA\nANAPOLIS, GO, 75093-783",
      phone: "(62) 98200-4528",
      email: "caritasagencia@gmail.com",
      logo_url: logo,
    },
    lines: [
      ...[68, 69, 70, 71, 72].flatMap((n, i) => [
        item(`0${n} - Pergunte ao Catequista`, `2026-04-0${i + 2}`, "Live Youtube", 95, false, g1),
        item(`Upload — 0${n} - Pergunte ao Catequista`, `2026-04-0${i + 2}`, "Upload em Portus", 15, true, g1),
      ]),
      item("A mulher deve ser submissa ao homem? | MNC 007", "2026-04-28", "Live Youtube", 95, false, g2),
      item("Upload — A mulher deve ser submissa ao homem? | MNC 007", "2026-04-28", "Upload em Portus", 15, true, g2),
      item("Por que o Papa é contra a guerra no Irã? | MNC 006", "2026-04-14", "Live Youtube", 95, false, g2),
      item("Upload — Por que o Papa é contra a guerra no Irã? | MNC 006", "2026-04-14", "Upload em Portus", 15, true, g2),
      item("Transmissão Aula Zoom", "2026-04-12", "Live Youtube", 575, false, "Lançamento Portus"),
      item("Organização e montagem de estúdio — Parcela 1/3", "2026-05-01", "Parcela 1/3", 158.33, false, "Organização e montagem de estúdio"),
    ],
    pix_code:
      "00020126580014BR.GOV.BCB.PIX0136b4f8c3b0-0d7e-4bd9-a2b0-2d214e7b9c6e520400053039865802BR5925AGENCIA CARITAS6009SAO PAULO62070503***6304A1B2",
    payment_method: "Pix",
    status_label: "Pendente",
  });

  fs.writeFileSync("/tmp/invoice-test.pdf", Buffer.from(doc.output("arraybuffer")));
  console.log("ok");
}

main();
