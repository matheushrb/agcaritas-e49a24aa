import jsPDF from "jspdf";
import QRCode from "qrcode";
import {
  PDF_COLORS, PDF_LAYOUT, setColor, brl, formatDate,
  drawIndustrialHeader, drawIndustrialFooter, drawSectionLabel,
} from "./theme";

export interface InvoiceLine {
  title: string;
  detail?: string;
  qty?: number;
  unit_price?: number;
  amount: number;
  is_child?: boolean;              // entregável faturado dentro de uma tarefa-pai
  reference_date?: string | Date | null; // Data usada como referência do item
  reference_label?: string;        // "Prazo" | "Transmissão" | "Gravação" | "Entregue em"
}

export interface InvoicePartyClient {
  name: string;
  company?: string | null;
  legal_name?: string | null;
  document?: string | null;
  state_registration?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
}

export interface InvoicePartyAgency {
  name?: string | null;
  legal_name?: string | null;
  document?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  bank_info?: string | null;
}

export interface InvoicePDFData {
  number: string;             // "202601-0004"
  competence?: string;
  issue_date: string | Date;
  due_date?: string | Date | null;
  client: InvoicePartyClient;
  agency?: InvoicePartyAgency;
  lines: InvoiceLine[];
  discount?: number;
  taxes?: number;
  notes?: string;
  payment_terms?: string;
  payment_link?: string;
  payment_instructions?: string;
  is_preview?: boolean;
}

export const DEFAULT_PAYMENT_TERMS =
  "Prazo de pagamento: até 5 (cinco) dias úteis a contar da data de emissão desta fatura. " +
  "Pagamentos podem ser efetuados via PIX, transferência bancária ou pelo link/QR Code de pagamento ao lado.";

export const DEFAULT_LEGAL_NOTES =
  "Após a confirmação do pagamento, a Nota Fiscal correspondente será emitida e encaminhada pelos canais de comunicação previamente acordados entre as partes. " +
  "O não pagamento até a data de vencimento acarretará multa de 2% (dois por cento) sobre o valor total, acrescida de juros de mora de 1% (um por cento) ao mês, calculados pro rata die, além de correção monetária. " +
  "Dúvidas sobre esta fatura devem ser encaminhadas ao setor financeiro da Caritas Agência em até 3 (três) dias úteis a contar do recebimento.";

async function makeQRCodeDataUrl(text: string): Promise<string | null> {
  try {
    const url = await QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 400,
      color: { dark: "#1E3A8A", light: "#ffffff" },
    });
    return url;
  } catch (e) {
    console.error("[invoice-pdf] QR generation failed", e);
    return null;
  }
}

function drawQRCodeVector(doc: jsPDF, text: string, x: number, y: number, size: number): boolean {
  const payload = text.trim();
  if (!payload) return false;

  try {
    const qr = QRCode.create(payload, { errorCorrectionLevel: "M" }) as {
      modules: { size: number; data: boolean[]; get?: (row: number, col: number) => boolean };
    };
    const moduleCount = qr.modules.size;
    const quietZone = 4;
    const cell = size / (moduleCount + quietZone * 2);

    setColor(doc, PDF_COLORS.white, "fill");
    doc.rect(x, y, size, size, "F");
    setColor(doc, PDF_COLORS.graphite, "fill");

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        const isDark = qr.modules.get
          ? qr.modules.get(row, col)
          : qr.modules.data[row * moduleCount + col];
        if (!isDark) continue;
        doc.rect(
          x + (col + quietZone) * cell,
          y + (row + quietZone) * cell,
          Math.ceil(cell * 1000) / 1000,
          Math.ceil(cell * 1000) / 1000,
          "F",
        );
      }
    }

    return true;
  } catch (e) {
    console.error("[invoice-pdf] QR vector generation failed", e);
    return false;
  }
}


export async function generateInvoicePDF(data: InvoicePDFData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const { marginX, pageW, pageH } = PDF_LAYOUT;
  const contentW = pageW - marginX * 2;

  drawIndustrialHeader(doc, {
    documentKind: data.is_preview ? "FATURA · PRÉVIA" : "FATURA",
    documentNumber: data.number,
    competence: data.competence ? `Competência ${data.competence}` : undefined,
  });

  const subtotal = data.lines.reduce((a, l) => a + Number(l.amount || 0), 0);
  const total = subtotal - Number(data.discount ?? 0) + Number(data.taxes ?? 0);

  /* ---------- Bloco resumo: 3 colunas com moldura industrial ---------- */
  let y = 46;
  const boxH = 24;
  setColor(doc, PDF_COLORS.ink, "draw"); doc.setLineWidth(0.4);
  doc.rect(marginX, y, contentW, boxH);
  // linhas divisórias verticais
  const colW = contentW / 3;
  setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.15);
  doc.line(marginX + colW,     y + 3, marginX + colW,     y + boxH - 3);
  doc.line(marginX + colW * 2, y + 3, marginX + colW * 2, y + boxH - 3);

  const cellTitle = (x: number, label: string) => {
    setColor(doc, PDF_COLORS.muted, "text");
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.8);
    doc.text(label, x + 4, y + 6, { charSpace: 0.6 });
  };
  cellTitle(marginX,             "EMITIDA EM");
  cellTitle(marginX + colW,      "VENCIMENTO");
  cellTitle(marginX + colW * 2,  "VALOR TOTAL");

  setColor(doc, PDF_COLORS.ink, "text");
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(formatDate(data.issue_date), marginX + 4, y + 15);
  doc.text(formatDate(data.due_date ?? null), marginX + colW + 4, y + 15);
  doc.setFontSize(18);
  doc.text(brl(total), marginX + colW * 2 + 4, y + 16);

  // texto pequeno abaixo dos totais
  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  doc.text(`${data.lines.length} item(ns) · Fatura nº ${data.number}`, marginX + 4, y + 21);
  if (data.competence) doc.text(`Competência ${data.competence}`, marginX + colW + 4, y + 21);

  y += boxH + 8;

  /* ---------- Faturado para | Emitido por ---------- */
  drawSectionLabel(doc, y, "Faturado para  ·  Emitido por"); y += 7;
  const halfW = (contentW - 6) / 2;

  const drawParty = (
    x: number,
    title: string,
    subtitle: string | null,
    rows: Array<{ label: string; value: string | null | undefined }>,
  ) => {
    setColor(doc, PDF_COLORS.ink, "text");
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    const titleLines = doc.splitTextToSize(title, halfW - 2);
    doc.text(titleLines, x, y);
    let cy = y + titleLines.length * 4.5;
    if (subtitle) {
      setColor(doc, PDF_COLORS.muted, "text");
      doc.setFont("helvetica", "italic"); doc.setFontSize(8);
      const subLines = doc.splitTextToSize(subtitle, halfW - 2);
      doc.text(subLines, x, cy + 1);
      cy += subLines.length * 3.6 + 1;
    }
    cy += 2;
    const clean = rows.filter(r => r.value && String(r.value).trim().length);
    for (const r of clean) {
      setColor(doc, PDF_COLORS.muted, "text");
      doc.setFont("helvetica", "bold"); doc.setFontSize(6.6);
      doc.text(r.label.toUpperCase(), x, cy, { charSpace: 0.6 });
      setColor(doc, PDF_COLORS.ink, "text");
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.4);
      const wrapped = doc.splitTextToSize(String(r.value), halfW - 2);
      doc.text(wrapped, x, cy + 3.2);
      cy += 3.2 + wrapped.length * 3.6 + 2;
    }
    return cy - y;
  };

  const c = data.client;
  const contactValue = c.contact_name
    ? `${c.contact_name}${c.contact_role ? ` — ${c.contact_role}` : ""}`
    : null;
  const clientHeight = drawParty(
    marginX,
    c.legal_name || c.company || c.name,
    c.legal_name && c.name && c.name !== c.legal_name ? c.name : (c.company && c.company !== c.name ? c.name : null),
    [
      { label: "CNPJ / CPF", value: c.document },
      { label: "Inscrição estadual", value: c.state_registration },
      { label: "E-mail", value: c.email },
      { label: "Telefone", value: c.phone },
      { label: "Endereço", value: c.address },
      { label: "Contato", value: contactValue },
    ],
  );

  const a = data.agency ?? {};
  const agencyHeight = drawParty(
    marginX + halfW + 6,
    a.legal_name || a.name || "Caritas Agência",
    a.legal_name && a.name && a.name !== a.legal_name ? a.name : null,
    [
      { label: "CNPJ", value: a.document },
      { label: "E-mail financeiro", value: a.email },
      { label: "Telefone", value: a.phone },
      { label: "Endereço", value: a.address },
      { label: "Site", value: a.website },
      { label: "Dados bancários", value: a.bank_info },
    ],
  );
  y += Math.max(clientHeight, agencyHeight) + 4;

  /* ---------- Itens ---------- */
  drawSectionLabel(doc, y, "Itens desta fatura"); y += 7;

  const colDesc  = marginX;
  const colDate  = pageW - marginX - 46;
  const colTotal = pageW - marginX;

  // header table
  setColor(doc, PDF_COLORS.ink, "fill");
  doc.rect(marginX, y - 4, contentW, 6, "F");
  setColor(doc, PDF_COLORS.white, "text");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  doc.text("DESCRIÇÃO",  colDesc + 2, y, { charSpace: 0.6 });
  doc.text("DATA", colDate,     y, { charSpace: 0.6 });
  doc.text("TOTAL",      colTotal - 2, y, { align: "right", charSpace: 0.6 });
  y += 6;

  let zebra = false;
  for (const line of data.lines) {
    if (y > pageH - 90) {
      drawIndustrialFooter(doc, { pageLabel: `Página ${doc.getCurrentPageInfo().pageNumber}` });
      doc.addPage();
      drawIndustrialHeader(doc, { documentKind: "FATURA", documentNumber: data.number });
      y = 48;
    }

    const indent = line.is_child ? 6 : 2;
    const descMaxW = colDate - colDesc - indent - 4;
    const titleLines = doc.splitTextToSize(line.title, descMaxW);
    const detailLines = line.detail
      ? doc.splitTextToSize(line.detail, descMaxW)
      : [];
    const rowH = Math.max(9, titleLines.length * 4 + detailLines.length * 3.6 + 4);

    if (zebra) {
      setColor(doc, PDF_COLORS.paper, "fill");
      doc.rect(marginX, y - 4, contentW, rowH, "F");
    }
    zebra = !zebra;

    if (line.is_child) {
      setColor(doc, PDF_COLORS.muted, "text");
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.text("↳", colDesc + 2, y);
    }

    setColor(doc, PDF_COLORS.ink, "text");
    doc.setFont("helvetica", line.is_child ? "normal" : "bold"); doc.setFontSize(9.2);
    doc.text(titleLines, colDesc + indent, y);

    if (detailLines.length) {
      setColor(doc, PDF_COLORS.muted, "text");
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.8);
      doc.text(detailLines, colDesc + indent, y + titleLines.length * 4);
    }

    // Data de referência
    if (line.reference_date) {
      setColor(doc, PDF_COLORS.muted, "text");
      doc.setFont("helvetica", "bold"); doc.setFontSize(6.4);
      doc.text("DATA", colDate, y, { charSpace: 0.4 });
      setColor(doc, PDF_COLORS.ink, "text");
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.6);
      doc.text(formatDate(line.reference_date), colDate, y + 3.6);
    } else {
      setColor(doc, PDF_COLORS.muted, "text");
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.6);
      doc.text("—", colDate, y);
    }

    setColor(doc, PDF_COLORS.ink, "text");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.4);
    doc.text(brl(line.amount), colTotal - 2, y, { align: "right" });

    y += rowH;
    setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.1);
    doc.line(marginX, y - 2, pageW - marginX, y - 2);
  }


  y += 3;

  /* ---------- Totais (direita) ---------- */
  const totalsX = pageW - marginX - 78;
  const drawTotalRow = (label: string, value: string, opts: { bold?: boolean; size?: number } = {}) => {
    setColor(doc, opts.bold ? PDF_COLORS.ink : PDF_COLORS.muted, "text");
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 8.5);
    doc.text(label.toUpperCase(), totalsX, y, { charSpace: opts.bold ? 0 : 0.4 });
    setColor(doc, PDF_COLORS.ink, "text");
    doc.setFont("helvetica", "bold"); doc.setFontSize(opts.size ?? 8.5);
    doc.text(value, colTotal - 2, y, { align: "right" });
    y += (opts.size ?? 8.5) * 0.65;
  };
  drawTotalRow("Subtotal", brl(subtotal));
  if (data.discount) drawTotalRow("Desconto", `- ${brl(data.discount)}`);
  if (data.taxes) drawTotalRow("Impostos", brl(data.taxes));
  y += 2;
  setColor(doc, PDF_COLORS.ink, "draw"); doc.setLineWidth(0.4);
  doc.line(totalsX, y - 3, colTotal, y - 3);
  y += 3;
  drawTotalRow("Total a pagar", brl(total), { bold: true, size: 13 });
  y += 6;

  /* ---------- Faixa inferior: Condições/Observações | QR ---------- */
  const bottomBlockY = Math.max(y, pageH - 90);
  if (bottomBlockY + 65 > pageH - 20) {
    drawIndustrialFooter(doc, { pageLabel: `Página ${doc.getCurrentPageInfo().pageNumber}` });
    doc.addPage();
    drawIndustrialHeader(doc, { documentKind: "FATURA", documentNumber: data.number });
    y = 48;
  } else {
    y = bottomBlockY;
  }

  // Left column: payment terms + legal notes
  const qrSize = 42;
  const leftW  = contentW - qrSize - 10;
  const leftX  = marginX;
  const rightX = pageW - marginX - qrSize;

  // Left content
  let ly = y;
  drawSectionLabel(doc, ly, "Condições de pagamento"); ly += 6;
  setColor(doc, PDF_COLORS.ink, "text");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  const terms = doc.splitTextToSize(data.payment_terms || DEFAULT_PAYMENT_TERMS, leftW);
  doc.text(terms, leftX, ly);
  ly += terms.length * 3.8 + 4;

  drawSectionLabel(doc, ly, "Observações legais"); ly += 6;
  setColor(doc, PDF_COLORS.graphite, "text");
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.8);
  const legal = doc.splitTextToSize(data.notes || DEFAULT_LEGAL_NOTES, leftW);
  doc.text(legal, leftX, ly);
  ly += legal.length * 3.5;

  // Right column: QR / link box
  const qrBoxY = y;
  setColor(doc, PDF_COLORS.ink, "draw"); doc.setLineWidth(0.4);
  doc.rect(rightX - 3, qrBoxY - 3, qrSize + 6, qrSize + 24);
  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.8);
  doc.text("PAGAMENTO", rightX, qrBoxY + 1, { charSpace: 0.6 });

  const paymentPayload = data.payment_link?.trim();
  if (paymentPayload) {
    const drewVectorQR = drawQRCodeVector(doc, paymentPayload, rightX, qrBoxY + 4, qrSize);
    if (!drewVectorQR) {
      const qrDataUrl = await makeQRCodeDataUrl(paymentPayload);
      if (qrDataUrl) doc.addImage(qrDataUrl, "PNG", rightX, qrBoxY + 4, qrSize, qrSize);
    }
    setColor(doc, PDF_COLORS.muted, "text");
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.4);
    doc.text("Aponte a câmera ou copie:", rightX, qrBoxY + qrSize + 9);
    setColor(doc, PDF_COLORS.accent, "text");
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.4);
    const linkLines = doc.splitTextToSize(paymentPayload, qrSize);
    doc.text(linkLines.slice(0, 2), rightX, qrBoxY + qrSize + 13);
    // clickable link overlay
    if (/^https?:\/\//i.test(paymentPayload)) {
      doc.link(rightX, qrBoxY + 4, qrSize, qrSize, { url: paymentPayload });
    }
  } else {
    setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.2);
    doc.rect(rightX, qrBoxY + 3, qrSize, qrSize);
    setColor(doc, PDF_COLORS.muted, "text");
    doc.setFont("helvetica", "italic"); doc.setFontSize(6.5);
    doc.text("QR Code disponível\nquando o link de\npagamento for anexado.",
      rightX + qrSize / 2, qrBoxY + qrSize / 2 - 2, { align: "center" });
  }

  // Extra payment instructions (optional, below both columns)
  y = Math.max(ly, qrBoxY + qrSize + 24) + 4;
  if (data.payment_instructions) {
    if (y > pageH - 30) { doc.addPage(); y = 48; }
    drawSectionLabel(doc, y, "Instruções extras"); y += 6;
    setColor(doc, PDF_COLORS.graphite, "text");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    const wrapped = doc.splitTextToSize(data.payment_instructions, contentW);
    doc.text(wrapped, marginX, y);
  }

  drawIndustrialFooter(doc, {
    pageLabel: `Página ${doc.getCurrentPageInfo().pageNumber}`,
    note: "Fatura emitida por Caritas Agência · pagamento no vencimento · NF emitida após confirmação",
  });

  return doc;
}
