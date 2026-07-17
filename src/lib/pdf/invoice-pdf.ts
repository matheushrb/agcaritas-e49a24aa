import jsPDF from "jspdf";
import {
  PDF_COLORS, PDF_LAYOUT, setColor, brl, formatDate,
  drawIndustrialHeader, drawIndustrialFooter, drawSectionLabel, drawKV,
} from "./theme";

export interface InvoiceLine {
  title: string;
  detail?: string;
  qty?: number;
  unit_price?: number;
  amount: number;
  is_child?: boolean; // entregável faturado dentro de uma tarefa-pai
}

export interface InvoicePDFData {
  number: string;             // "202601-0004"
  competence?: string;        // "01/2026"
  issue_date: string | Date;
  due_date?: string | Date | null;
  client: {
    name: string;
    company?: string | null;
    document?: string | null; // CNPJ/CPF
    email?: string | null;
    address?: string | null;
  };
  agency?: {
    name?: string; document?: string; email?: string; address?: string;
  };
  lines: InvoiceLine[];
  discount?: number;
  taxes?: number;
  notes?: string;
  payment_instructions?: string;
}

export function generateInvoicePDF(data: InvoicePDFData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const { marginX, pageW, pageH } = PDF_LAYOUT;

  drawIndustrialHeader(doc, {
    documentKind: "FATURA",
    documentNumber: data.number,
    competence: data.competence ? `Competência ${data.competence}` : undefined,
  });

  // Bloco de metadados: emissão / vencimento / valor
  const subtotal = data.lines.reduce((a, l) => a + Number(l.amount || 0), 0);
  const total = subtotal - Number(data.discount ?? 0) + Number(data.taxes ?? 0);

  let y = 48;
  drawSectionLabel(doc, y, "Emissão e vencimento"); y += 8;

  const colW = (pageW - marginX * 2) / 3;
  drawKV(doc, marginX, y, "Emitida em", formatDate(data.issue_date), colW);
  drawKV(doc, marginX + colW, y, "Vence em", formatDate(data.due_date ?? null), colW);
  // Valor total em destaque
  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.text("VALOR TOTAL", marginX + colW * 2, y, { charSpace: 0.4 });
  setColor(doc, PDF_COLORS.ink, "text");
  doc.setFont("helvetica", "bold"); doc.setFontSize(18);
  doc.text(brl(total), marginX + colW * 2, y + 7);

  y += 22;

  // Faturado para / Emitido por
  drawSectionLabel(doc, y, "Faturado para"); y += 8;
  setColor(doc, PDF_COLORS.ink, "text");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(data.client.company || data.client.name, marginX, y);
  y += 5;
  setColor(doc, PDF_COLORS.graphite, "text");
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  const clientLines = [
    data.client.company ? data.client.name : null,
    data.client.document ? `CNPJ/CPF ${data.client.document}` : null,
    data.client.email ?? null,
    data.client.address ?? null,
  ].filter(Boolean) as string[];
  clientLines.forEach((line, i) => doc.text(line, marginX, y + i * 4.5));
  y += clientLines.length * 4.5 + 6;

  // Itens
  drawSectionLabel(doc, y, "Itens desta fatura"); y += 8;

  // Cabeçalho da tabela
  const tableY = y;
  const colDesc = marginX;
  const colQty = pageW - marginX - 90;
  const colUnit = pageW - marginX - 55;
  const colTotal = pageW - marginX;

  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  doc.text("DESCRIÇÃO", colDesc, tableY, { charSpace: 0.4 });
  doc.text("QTD", colQty, tableY, { align: "right", charSpace: 0.4 });
  doc.text("UNIT.", colUnit, tableY, { align: "right", charSpace: 0.4 });
  doc.text("TOTAL", colTotal, tableY, { align: "right", charSpace: 0.4 });

  setColor(doc, PDF_COLORS.ink, "draw");
  doc.setLineWidth(0.3);
  doc.line(marginX, tableY + 2, pageW - marginX, tableY + 2);

  y = tableY + 8;

  for (const line of data.lines) {
    // page break
    if (y > pageH - 60) {
      drawIndustrialFooter(doc, { pageLabel: `Página ${doc.getCurrentPageInfo().pageNumber}` });
      doc.addPage();
      drawIndustrialHeader(doc, { documentKind: "FATURA", documentNumber: data.number });
      y = 48;
    }

    setColor(doc, PDF_COLORS.ink, "text");
    doc.setFont("helvetica", line.is_child ? "normal" : "bold"); doc.setFontSize(9.5);
    const indent = line.is_child ? 4 : 0;
    if (line.is_child) {
      // marcador de sub-item
      setColor(doc, PDF_COLORS.muted, "text");
      doc.text("↳", colDesc, y);
      setColor(doc, PDF_COLORS.graphite, "text");
    }
    const titleLines = doc.splitTextToSize(line.title, colQty - colDesc - indent - 4);
    doc.text(titleLines, colDesc + indent, y);

    if (line.detail) {
      setColor(doc, PDF_COLORS.muted, "text");
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      const detailLines = doc.splitTextToSize(line.detail, colQty - colDesc - indent - 4);
      doc.text(detailLines, colDesc + indent, y + titleLines.length * 4.2);
    }

    setColor(doc, PDF_COLORS.ink, "text");
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    doc.text(String(line.qty ?? "—"), colQty, y, { align: "right" });
    doc.text(line.unit_price != null ? brl(line.unit_price) : "—", colUnit, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(brl(line.amount), colTotal, y, { align: "right" });

    const usedHeight = titleLines.length * 4.2 + (line.detail ? 4 : 0) + 3;
    y += Math.max(7, usedHeight);

    // hairline
    setColor(doc, PDF_COLORS.hairline, "draw");
    doc.setLineWidth(0.1);
    doc.line(marginX, y - 2, pageW - marginX, y - 2);
  }

  y += 4;

  // Totais
  const totalsX = pageW - marginX - 70;
  const drawTotalRow = (label: string, value: string, opts: { bold?: boolean; size?: number } = {}) => {
    setColor(doc, opts.bold ? PDF_COLORS.ink : PDF_COLORS.muted, "text");
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 9);
    doc.text(label.toUpperCase(), totalsX, y, { charSpace: opts.bold ? 0 : 0.4 });
    setColor(doc, PDF_COLORS.ink, "text");
    doc.setFont("helvetica", "bold"); doc.setFontSize(opts.size ?? 9);
    doc.text(value, colTotal, y, { align: "right" });
    y += (opts.size ?? 9) * 0.6;
  };

  drawTotalRow("Subtotal", brl(subtotal));
  if (data.discount) drawTotalRow("Desconto", `- ${brl(data.discount)}`);
  if (data.taxes) drawTotalRow("Impostos", brl(data.taxes));
  y += 2;
  setColor(doc, PDF_COLORS.ink, "draw");
  doc.setLineWidth(0.4);
  doc.line(totalsX, y - 3, colTotal, y - 3);
  y += 3;
  drawTotalRow("Total a pagar", brl(total), { bold: true, size: 13 });
  y += 8;

  // Instruções de pagamento
  if (data.payment_instructions) {
    if (y > pageH - 50) { doc.addPage(); y = 48; }
    drawSectionLabel(doc, y, "Instruções de pagamento"); y += 7;
    setColor(doc, PDF_COLORS.graphite, "text");
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const wrapped = doc.splitTextToSize(data.payment_instructions, pageW - marginX * 2);
    doc.text(wrapped, marginX, y);
    y += wrapped.length * 4.5 + 4;
  }

  // Notas
  if (data.notes) {
    if (y > pageH - 40) { doc.addPage(); y = 48; }
    drawSectionLabel(doc, y, "Observações"); y += 7;
    setColor(doc, PDF_COLORS.graphite, "text");
    doc.setFont("helvetica", "italic"); doc.setFontSize(8.5);
    const wrapped = doc.splitTextToSize(data.notes, pageW - marginX * 2);
    doc.text(wrapped, marginX, y);
  }

  drawIndustrialFooter(doc, {
    pageLabel: `Página ${doc.getCurrentPageInfo().pageNumber}`,
    note: "Fatura emitida por Caritas Agência · pagamento no vencimento",
  });

  return doc;
}
