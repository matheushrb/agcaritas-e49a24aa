import jsPDF from "jspdf";
import QRCode from "qrcode";
import {
  PDF_COLORS, PDF_LAYOUT, setColor, brl, formatDate,
  drawIndustrialHeader, drawIndustrialFooter, drawSectionLabel,
} from "./theme";
import { registerLiberationFonts } from "./fonts";

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
  logo_url?: string | null;
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
    const qr = QRCode.create(payload, { errorCorrectionLevel: "M" }) as unknown as {
      modules: { size: number; data: ArrayLike<boolean | number>; get?: (row: number, col: number) => boolean };
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


async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    if (url.startsWith("data:")) return url;
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: false });
  registerLiberationFonts(doc);
  const { marginX, pageW, pageH } = PDF_LAYOUT;
  const contentW = pageW - marginX * 2;

  const logoDataUrl = data.agency?.logo_url ? await loadImageAsDataUrl(data.agency.logo_url) : null;

  const subtotal = data.lines.reduce((a, l) => a + Number(l.amount || 0), 0);
  const total = subtotal - Number(data.discount ?? 0) + Number(data.taxes ?? 0);

  /* ============================================================
     CARD PRINCIPAL — sóbrio, azul apenas nos destaques.
     Fundo branco, borda azul-clara, título/número em azul do sistema.
     ============================================================ */
  const cardX = marginX;
  const cardW = contentW;
  const cardY = 14;                       // topo do card
  const headerH = 12;                     // faixa do topo
  const bodyPadX = 9;
  const bodyPadY = 7;
  const innerX = cardX + bodyPadX;
  const innerW = cardW - bodyPadX * 2;

  // --- moldura do card ---
  setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.5);
  doc.roundedRect(cardX, cardY, cardW, pageH - cardY - 22, 3, 3);

  // --- header sóbrio com destaque azul ---
  setColor(doc, PDF_COLORS.white, "fill");
  doc.roundedRect(cardX, cardY, cardW, headerH, 3, 3, "F");
  // borda inferior do header em azul claro
  setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.3);
  doc.line(cardX + 3, cardY + headerH, cardX + cardW - 3, cardY + headerH);

  // logo mini (se houver)
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "PNG", cardX + 6, cardY + 2, 8, 8); } catch { /* ignore */ }
  }
  // título do header em azul (destaque)
  setColor(doc, PDF_COLORS.graphite, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(9);
  const titleTxt = data.is_preview ? "PRÉVIA DA FATURA" : "FATURA";
  doc.text(titleTxt, cardX + (logoDataUrl ? 18 : 8), cardY + 8, { charSpace: 0.8 });
  // número à direita em azul (destaque)
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(11);
  doc.text(data.number, cardX + cardW - 8, cardY + 8, { align: "right" });

  /* ---------- Bloco topo: Emitida em / Vencimento / Valor total ---------- */
  let y = cardY + headerH + bodyPadY + 2;

  const col3W = innerW / 3;
  const smallLabel = (x: number, label: string, align: "left" | "right" = "left") => {
    setColor(doc, PDF_COLORS.muted, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(6.6);
    doc.text(label.toUpperCase(), x, y, { charSpace: 0.6, align });
  };
  smallLabel(innerX, "Emitida em");
  smallLabel(innerX + col3W, "Vencimento");
  smallLabel(innerX + innerW - 1, "Valor total", "right");

  setColor(doc, PDF_COLORS.black, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(11);
  doc.text(formatDate(data.issue_date), innerX, y + 5.5);
  doc.text(formatDate(data.due_date ?? null), innerX + col3W, y + 5.5);
  // valor total destacado (accent)
  setColor(doc, PDF_COLORS.graphite, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(14);
  doc.text(brl(total), innerX + innerW, y + 6, { align: "right" });

  y += 11;
  setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.2);
  doc.line(innerX, y, innerX + innerW, y);
  y += 5;

  /* ---------- Bloco Faturado para / Emitido por ---------- */
  const halfW = (innerW - 6) / 2;
  const drawParty = (
    x: number,
    header: string,
    title: string,
    rows: Array<{ label: string; value: string | null | undefined }>,
  ) => {
    let cy = y;
    setColor(doc, PDF_COLORS.graphite, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(6.6);
    doc.text(header.toUpperCase(), x, cy, { charSpace: 0.6 });
    cy += 4;

    setColor(doc, PDF_COLORS.black, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(10);
    const titleLines = doc.splitTextToSize(title, halfW - 2);
    doc.text(titleLines, x, cy);
    cy += titleLines.length * 4 + 1;

    const clean = rows.filter(r => r.value && String(r.value).trim().length);
    setColor(doc, PDF_COLORS.muted, "text");
    doc.setFont("LiberationSans", "normal"); doc.setFontSize(7.8);
    for (const r of clean) {
      const wrapped = doc.splitTextToSize(`${r.label}: ${r.value}`, halfW - 2);
      doc.text(wrapped, x, cy);
      cy += wrapped.length * 3.4 + 0.6;
    }
    return cy - y;
  };

  const c = data.client;
  const a = data.agency ?? {};
  const clientH = drawParty(
    innerX,
    "Faturado para",
    c.legal_name || c.company || c.name,
    [
      { label: "CNPJ/CPF", value: c.document },
      { label: "IE", value: c.state_registration },
      { label: "E-mail", value: c.email },
      { label: "Telefone", value: c.phone },
      { label: "Endereço", value: c.address },
    ],
  );
  const agencyH = drawParty(
    innerX + halfW + 6,
    "Emitido por",
    a.legal_name || a.name || "Caritas Agência",
    [
      { label: "CNPJ", value: a.document },
      { label: "E-mail", value: a.email },
      { label: "Telefone", value: a.phone },
      { label: "Endereço", value: a.address },
      { label: "Site", value: a.website },
    ],
  );
  y += Math.max(clientH, agencyH) + 2;
  setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.2);
  doc.line(innerX, y, innerX + innerW, y);
  y += 5;

  /* ---------- Itens ---------- */
  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(6.6);
  doc.text(`ITENS (${data.lines.length})`, innerX, y, { charSpace: 0.6 });
  y += 3;

  // tabela: bordas arredondadas simuladas com clip retângulo
  const tableX = innerX;
  const tableW = innerW;
  const dateColW = 26;
  const totalColW = 26;
  const descColW = tableW - dateColW - totalColW;
  const rowPadX = 4;

  // Header row (fundo cinza claro azulado)
  const headerRowY = y;
  const headerRowH = 6.5;
  setColor(doc, PDF_COLORS.paper, "fill");
  doc.rect(tableX, headerRowY, tableW, headerRowH, "F");
  setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.2);
  doc.rect(tableX, headerRowY, tableW, headerRowH);

  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(6.6);
  doc.text("DESCRIÇÃO", tableX + rowPadX, headerRowY + 4.2, { charSpace: 0.6 });
  doc.text("DATA", tableX + descColW + rowPadX, headerRowY + 4.2, { charSpace: 0.6 });
  doc.text("TOTAL", tableX + tableW - rowPadX, headerRowY + 4.2, { align: "right", charSpace: 0.6 });
  y = headerRowY + headerRowH;

  // Linhas
  let zebra = false;
  for (const line of data.lines) {
    // Quebra de página se necessário
    if (y > pageH - 90) {
      drawIndustrialFooter(doc, { pageLabel: `Página ${doc.getCurrentPageInfo().pageNumber}` });
      doc.addPage();
      y = 20;
    }

    const indent = line.is_child ? rowPadX + 4 : rowPadX;
    const descMaxW = descColW - indent - 2;
    const titleText = line.is_child ? `» ${line.title}` : line.title;
    const titleLines = doc.splitTextToSize(titleText, descMaxW);
    const detailLines = line.detail ? doc.splitTextToSize(line.detail, descMaxW) : [];
    const rowH = Math.max(7, titleLines.length * 4 + detailLines.length * 3.4 + 3);

    if (zebra) {
      setColor(doc, PDF_COLORS.paper, "fill");
      doc.rect(tableX, y, tableW, rowH, "F");
    }
    zebra = !zebra;

    setColor(doc, line.is_child ? PDF_COLORS.muted : PDF_COLORS.black, "text");
    doc.setFont("LiberationSans", line.is_child ? "normal" : "bold"); doc.setFontSize(8.6);
    doc.text(titleLines, tableX + indent, y + 4);

    if (detailLines.length) {
      setColor(doc, PDF_COLORS.muted, "text");
      doc.setFont("LiberationSans", "normal"); doc.setFontSize(7.4);
      doc.text(detailLines, tableX + indent, y + 4 + titleLines.length * 4);
    }

    // Data
    setColor(doc, PDF_COLORS.black, "text");
    doc.setFont("LiberationSans", "normal"); doc.setFontSize(8.2);
    doc.text(
      line.reference_date ? formatDate(line.reference_date) : "—",
      tableX + descColW + rowPadX,
      y + 4,
    );

    // Total
    setColor(doc, PDF_COLORS.black, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(8.8);
    doc.text(brl(line.amount), tableX + tableW - rowPadX, y + 4, { align: "right" });

    // divisória fina
    setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.1);
    doc.line(tableX, y + rowH, tableX + tableW, y + rowH);

    y += rowH;
  }

  // Espaço pequeno entre a última linha de itens e o Total a pagar
  y += 2;

  // Linha "Total a pagar" com tint azul-clarissimo
  const totalRowH = 9;
  setColor(doc, PDF_COLORS.paper, "fill");
  doc.rect(tableX, y, tableW, totalRowH, "F");
  setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.2);
  doc.rect(tableX, y, tableW, totalRowH);
  setColor(doc, PDF_COLORS.black, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(8);
  doc.text("TOTAL A PAGAR", tableX + descColW - rowPadX, y + 5.8, { align: "right", charSpace: 0.6 });
  setColor(doc, PDF_COLORS.graphite, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(10.5);
  doc.text(brl(total), tableX + tableW - rowPadX, y + 6, { align: "right" });
  // Aproxima o bloco inferior do QR/condições
  y += totalRowH + 3;

  // Bordas externas da tabela (contorno cinza)
  // (opcional) já desenhadas linha a linha

  /* ---------- Bloco inferior: Condições/Observações  |  QR ---------- */
  if (y + 60 > pageH - 22) {
    drawIndustrialFooter(doc, { pageLabel: `Página ${doc.getCurrentPageInfo().pageNumber}` });
    doc.addPage();
    y = 20;
  }

  const qrBoxW = 52;
  const qrBoxH = 62;
  const gapCol = 6;
  const leftW = innerW - qrBoxW - gapCol;
  const leftX = innerX;
  const qrBoxX = innerX + innerW - qrBoxW;
  const qrBoxY = y;

  // --- Coluna esquerda ---
  let ly = y;
  setColor(doc, PDF_COLORS.graphite, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(6.6);
  doc.text("CONDIÇÕES DE PAGAMENTO", leftX, ly, { charSpace: 0.6 });
  ly += 4;
  setColor(doc, PDF_COLORS.black, "text");
  doc.setFont("LiberationSans", "normal"); doc.setFontSize(8);
  const terms = doc.splitTextToSize(data.payment_terms || DEFAULT_PAYMENT_TERMS, leftW);
  doc.text(terms, leftX, ly);
  ly += terms.length * 3.6 + 4;

  setColor(doc, PDF_COLORS.graphite, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(6.6);
  doc.text("OBSERVAÇÕES LEGAIS", leftX, ly, { charSpace: 0.6 });
  ly += 4;
  setColor(doc, PDF_COLORS.black, "text");
  doc.setFont("LiberationSans", "normal"); doc.setFontSize(7.6);
  const legal = doc.splitTextToSize(data.notes || DEFAULT_LEGAL_NOTES, leftW);
  doc.text(legal, leftX, ly);
  ly += legal.length * 3.4;

  // --- Caixa QR (borda tracejada) ---
  setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.4);
  if (doc.setLineDashPattern) doc.setLineDashPattern([1.2, 1.2], 0);
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 2, 2);
  if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);

  setColor(doc, PDF_COLORS.graphite, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(6.6);
  doc.text("PAGAMENTO", qrBoxX + qrBoxW / 2, qrBoxY + 5, { align: "center", charSpace: 0.6 });

  const qrSize = 34;
  const qrX = qrBoxX + (qrBoxW - qrSize) / 2;
  const qrY = qrBoxY + 8;
  const paymentPayload = data.payment_link?.trim();
  if (paymentPayload) {
    const drewVectorQR = drawQRCodeVector(doc, paymentPayload, qrX, qrY, qrSize);
    if (!drewVectorQR) {
      const qrDataUrl = await makeQRCodeDataUrl(paymentPayload);
      if (qrDataUrl) doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
    }
    setColor(doc, PDF_COLORS.black, "text");
    doc.setFont("LiberationSans", "normal"); doc.setFontSize(5.8);
    const linkLines = doc.splitTextToSize(paymentPayload, qrBoxW - 6);
    doc.text(linkLines.slice(0, 3), qrBoxX + qrBoxW / 2, qrY + qrSize + 5, { align: "center" });
    if (/^https?:\/\//i.test(paymentPayload)) {
      doc.link(qrX, qrY, qrSize, qrSize, { url: paymentPayload });
    }
  } else {
    setColor(doc, PDF_COLORS.muted, "text");
    doc.setFont("LiberationSans", "italic"); doc.setFontSize(6.5);
    doc.text(
      "Anexe um link de\npagamento para gerar\no QR Code.",
      qrBoxX + qrBoxW / 2,
      qrBoxY + qrBoxH / 2,
      { align: "center" },
    );
  }

  y = Math.max(ly, qrBoxY + qrBoxH) + 4;

  if (data.payment_instructions) {
    if (y > pageH - 30) { doc.addPage(); y = 20; }
    setColor(doc, PDF_COLORS.graphite, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(6.6);
    doc.text("INSTRUÇÕES EXTRAS", innerX, y, { charSpace: 0.6 });
    y += 4;
    setColor(doc, PDF_COLORS.black, "text");
    doc.setFont("LiberationSans", "normal"); doc.setFontSize(8);
    const wrapped = doc.splitTextToSize(data.payment_instructions, innerW);
    doc.text(wrapped, innerX, y);
  }

  drawIndustrialFooter(doc, {
    pageLabel: `Página ${doc.getCurrentPageInfo().pageNumber}`,
    note: "Fatura emitida por Caritas Agência · pagamento no vencimento · NF emitida após confirmação",
  });

  return doc;
}

