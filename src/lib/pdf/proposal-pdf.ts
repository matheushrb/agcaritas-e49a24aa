import jsPDF from "jspdf";
import {
  PDF_COLORS, PDF_LAYOUT, setColor, brl, formatDate,
  drawIndustrialHeader, drawIndustrialFooter, drawSectionLabel,
} from "./theme";
import { registerLiberationFonts } from "./fonts";

export interface ProposalItem {
  title: string;
  description?: string;
  qty?: number;
  unit_price?: number;
  amount?: number;
}

export interface ProposalPDFData {
  number: string;
  issue_date: string | Date;
  valid_until?: string | Date | null;
  client: { name: string; company?: string | null; email?: string | null };
  billing_model_label?: string;
  headline?: string;    // ex: "Parceria Estratégica de Marketing Digital"
  intro?: string;       // parágrafo de abertura
  scope: ProposalItem[];
  deliverables?: string[]; // lista de entregas macro
  investment_note?: string;
  next_steps?: string;
  public_url?: string;  // link para aprovação online
}

export function generateProposalPDF(data: ProposalPDFData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  registerLiberationFonts(doc);
  const { marginX, pageW, pageH } = PDF_LAYOUT;

  // === CAPA ===
  drawIndustrialHeader(doc, {
    documentKind: "PROPOSTA COMERCIAL",
    documentNumber: data.number,
  });

  let y = 60;

  // Título editorial
  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(8);
  doc.text("PREPARADO PARA", marginX, y, { charSpace: 0.6 });
  y += 6;
  setColor(doc, PDF_COLORS.ink, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(24);
  doc.text(data.client.company || data.client.name, marginX, y, { maxWidth: pageW - marginX * 2 });
  y += 10;
  if (data.client.company && data.client.name) {
    setColor(doc, PDF_COLORS.graphite, "text");
    doc.setFont("LiberationSans", "normal"); doc.setFontSize(11);
    doc.text(`A/C ${data.client.name}`, marginX, y);
    y += 8;
  }

  // Headline
  if (data.headline) {
    y += 6;
    setColor(doc, PDF_COLORS.ink, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(32);
    const hl = doc.splitTextToSize(data.headline, pageW - marginX * 2);
    doc.text(hl, marginX, y);
    y += hl.length * 12;
  }

  y += 10;

  // Divisor duplo industrial
  setColor(doc, PDF_COLORS.ink, "draw");
  doc.setLineWidth(0.8);
  doc.line(marginX, y, pageW - marginX, y);
  doc.setLineWidth(0.15);
  doc.line(marginX, y + 1.5, pageW - marginX, y + 1.5);
  y += 10;

  // Metadados de capa
  const colW = (pageW - marginX * 2) / 3;
  const metas = [
    { label: "EMITIDA EM", value: formatDate(data.issue_date) },
    { label: "VALIDADE",   value: data.valid_until ? formatDate(data.valid_until) : "—" },
    { label: "MODELO",     value: data.billing_model_label ?? "—" },
  ];
  metas.forEach((m, i) => {
    setColor(doc, PDF_COLORS.muted, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(7.5);
    doc.text(m.label, marginX + colW * i, y, { charSpace: 0.6 });
    setColor(doc, PDF_COLORS.ink, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(12);
    doc.text(m.value, marginX + colW * i, y + 6);
  });

  drawIndustrialFooter(doc, { pageLabel: "Capa · Página 1" });

  // === PÁGINA 2: INTRO + ESCOPO ===
  doc.addPage();
  drawIndustrialHeader(doc, { documentKind: "PROPOSTA COMERCIAL", documentNumber: data.number });
  y = 48;

  if (data.intro) {
    drawSectionLabel(doc, y, "Contexto"); y += 8;
    setColor(doc, PDF_COLORS.graphite, "text");
    doc.setFont("LiberationSans", "normal"); doc.setFontSize(10.5);
    const wrapped = doc.splitTextToSize(data.intro, pageW - marginX * 2);
    doc.text(wrapped, marginX, y, { lineHeightFactor: 1.5 });
    y += wrapped.length * 5.5 + 8;
  }

  if (data.deliverables?.length) {
    drawSectionLabel(doc, y, "O que entregamos"); y += 8;
    setColor(doc, PDF_COLORS.ink, "text");
    doc.setFont("LiberationSans", "normal"); doc.setFontSize(10);
    data.deliverables.forEach((d, i) => {
      const idx = String(i + 1).padStart(2, "0");
      setColor(doc, PDF_COLORS.muted, "text");
      doc.setFont("LiberationSans", "bold"); doc.setFontSize(9);
      doc.text(idx, marginX, y);
      setColor(doc, PDF_COLORS.ink, "text");
      doc.setFont("LiberationSans", "normal"); doc.setFontSize(10);
      const lines = doc.splitTextToSize(d, pageW - marginX * 2 - 10);
      doc.text(lines, marginX + 8, y);
      y += Math.max(6, lines.length * 4.6) + 2;
      if (y > pageH - 40) {
        drawIndustrialFooter(doc);
        doc.addPage();
        drawIndustrialHeader(doc, { documentKind: "PROPOSTA COMERCIAL", documentNumber: data.number });
        y = 48;
      }
    });
    y += 6;
  }

  // === ESCOPO / INVESTIMENTO ===
  if (y > pageH - 90) {
    drawIndustrialFooter(doc);
    doc.addPage();
    drawIndustrialHeader(doc, { documentKind: "PROPOSTA COMERCIAL", documentNumber: data.number });
    y = 48;
  }

  drawSectionLabel(doc, y, "Escopo e investimento"); y += 8;

  const colDesc = marginX;
  const colTotal = pageW - marginX;

  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(7.5);
  doc.text("ITEM", colDesc, y, { charSpace: 0.4 });
  doc.text("INVESTIMENTO", colTotal, y, { align: "right", charSpace: 0.4 });
  setColor(doc, PDF_COLORS.ink, "draw");
  doc.setLineWidth(0.3);
  doc.line(marginX, y + 2, pageW - marginX, y + 2);
  y += 8;

  let subtotal = 0;
  for (const item of data.scope) {
    const amount = Number(item.amount ?? (item.qty ?? 1) * (item.unit_price ?? 0));
    subtotal += amount;

    setColor(doc, PDF_COLORS.ink, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(10.5);
    const titleLines = doc.splitTextToSize(item.title, pageW - marginX * 2 - 40);
    doc.text(titleLines, colDesc, y);
    let itemH = titleLines.length * 4.8;

    if (item.description) {
      setColor(doc, PDF_COLORS.graphite, "text");
      doc.setFont("LiberationSans", "normal"); doc.setFontSize(9);
      const descLines = doc.splitTextToSize(item.description, pageW - marginX * 2 - 40);
      doc.text(descLines, colDesc, y + itemH + 1);
      itemH += descLines.length * 4 + 2;
    }

    setColor(doc, PDF_COLORS.ink, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(11);
    doc.text(brl(amount), colTotal, y, { align: "right" });

    y += Math.max(10, itemH) + 3;
    setColor(doc, PDF_COLORS.hairline, "draw");
    doc.setLineWidth(0.1);
    doc.line(marginX, y - 1, pageW - marginX, y - 1);
    y += 2;

    if (y > pageH - 60) {
      drawIndustrialFooter(doc);
      doc.addPage();
      drawIndustrialHeader(doc, { documentKind: "PROPOSTA COMERCIAL", documentNumber: data.number });
      y = 48;
    }
  }

  y += 4;
  // Total destacado
  setColor(doc, PDF_COLORS.ink, "fill");
  doc.rect(marginX, y, pageW - marginX * 2, 18, "F");
  setColor(doc, PDF_COLORS.white, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(9);
  doc.text("INVESTIMENTO TOTAL", marginX + 5, y + 7, { charSpace: 0.6 });
  doc.setFontSize(18);
  doc.text(brl(subtotal), pageW - marginX - 5, y + 12, { align: "right" });
  if (data.billing_model_label) {
    doc.setFont("LiberationSans", "normal"); doc.setFontSize(8);
    setColor(doc, [200, 205, 215], "text");
    doc.text(data.billing_model_label, marginX + 5, y + 13);
  }
  y += 26;

  if (data.investment_note) {
    setColor(doc, PDF_COLORS.muted, "text");
    doc.setFont("LiberationSans", "italic"); doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(data.investment_note, pageW - marginX * 2);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 4.5 + 6;
  }

  // Próximos passos + link de aprovação
  if (y > pageH - 60) {
    drawIndustrialFooter(doc);
    doc.addPage();
    drawIndustrialHeader(doc, { documentKind: "PROPOSTA COMERCIAL", documentNumber: data.number });
    y = 48;
  }

  drawSectionLabel(doc, y, "Próximos passos"); y += 8;
  setColor(doc, PDF_COLORS.graphite, "text");
  doc.setFont("LiberationSans", "normal"); doc.setFontSize(10);
  const steps = data.next_steps ||
    "Aprovando esta proposta, iniciamos o alinhamento de kickoff em até 3 dias úteis, com abertura formal do projeto e cronograma detalhado.";
  const stepLines = doc.splitTextToSize(steps, pageW - marginX * 2);
  doc.text(stepLines, marginX, y, { lineHeightFactor: 1.5 });
  y += stepLines.length * 5.5 + 8;

  if (data.public_url) {
    setColor(doc, PDF_COLORS.accent, "fill");
    doc.rect(marginX, y, pageW - marginX * 2, 16, "F");
    setColor(doc, PDF_COLORS.white, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(10);
    doc.text("APROVAR ONLINE", marginX + 5, y + 6, { charSpace: 0.6 });
    doc.setFont("LiberationSans", "normal"); doc.setFontSize(9);
    doc.textWithLink(data.public_url, marginX + 5, y + 12, { url: data.public_url });
  }

  drawIndustrialFooter(doc, {
    pageLabel: `Página ${doc.getCurrentPageInfo().pageNumber}`,
    note: "Proposta válida conforme data indicada · Caritas Agência",
  });

  return doc;
}
