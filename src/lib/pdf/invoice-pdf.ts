import jsPDF from "jspdf";
import QRCode from "qrcode";
import { PDF_COLORS, PDF_LAYOUT, setColor, brl, formatDate } from "./theme";
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
  group?: string | null;           // Projeto (agrupador da tabela)
  service?: string | null;         // Coluna "Serviço"
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
  number: string;             // "202605140"
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
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 400,
      color: { dark: "#000000", light: "#ffffff" },
    });
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
    setColor(doc, PDF_COLORS.black, "fill");

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

const shortDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const full = formatDate(d);
  if (full === "—") return full;
  const [dd, mm, yyyy] = full.split("/");
  return `${dd}/${mm}/${(yyyy ?? "").slice(2)}`;
};

const longDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(`${d}T12:00:00`)
    : typeof d === "string" ? new Date(d) : d;
  const day = String(dt.getDate()).padStart(2, "0");
  const mon = dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${day}/${mon}/${dt.getFullYear()}`;
};

export async function generateInvoicePDF(data: InvoicePDFData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: false });
  registerLiberationFonts(doc);
  const { marginX, pageW, pageH } = PDF_LAYOUT;
  const contentW = pageW - marginX * 2;
  const footerY = pageH - 16;

  const logoDataUrl = data.agency?.logo_url ? await loadImageAsDataUrl(data.agency.logo_url) : null;

  const subtotal = data.lines.reduce((a, l) => a + Number(l.amount || 0), 0);
  const total = subtotal - Number(data.discount ?? 0) + Number(data.taxes ?? 0);

  const a = data.agency ?? {};
  const c = data.client;
  const agencyName = a.legal_name || a.name || "Agência Caritas";

  /* ------------------------------ Rodapé -------------------------------- */
  const drawFooter = () => {
    setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.2);
    doc.line(marginX, footerY, pageW - marginX, footerY);
    setColor(doc, PDF_COLORS.graphite, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(7.5);
    doc.text(agencyName, marginX, footerY + 5);
    setColor(doc, PDF_COLORS.muted, "text");
    doc.setFont("LiberationSans", "normal"); doc.setFontSize(7.5);
    doc.text(String(doc.getCurrentPageInfo().pageNumber), pageW - marginX, footerY + 5, { align: "right" });
  };

  const newPage = () => {
    drawFooter();
    doc.addPage();
    return 24;
  };

  /* ------------------------------ Cabeçalho ------------------------------ */
  let y = 18;
  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, "PNG", marginX, y, 42, 14); } catch { /* ignore */ }
  } else {
    setColor(doc, PDF_COLORS.graphite, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(20);
    doc.text("Caritas", marginX, y + 10);
    setColor(doc, PDF_COLORS.muted, "text");
    doc.setFont("LiberationSans", "normal"); doc.setFontSize(6.5);
    doc.text("A G Ê N C I A", marginX + 1, y + 14, { charSpace: 0.4 });
  }
  y += 26;

  setColor(doc, PDF_COLORS.graphite, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(20);
  doc.text(`Fatura #${data.number}`, marginX, y);
  if (data.is_preview) {
    setColor(doc, PDF_COLORS.muted, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(8);
    doc.text("PRÉVIA · AGUARDANDO EMISSÃO", pageW - marginX, y - 1, { align: "right", charSpace: 0.6 });
  }
  y += 10;

  /* ------------------------------ De / Para ------------------------------ */
  const colW = (contentW - 10) / 2;
  const drawParty = (x: number, header: string, title: string, rows: Array<string | null | undefined>) => {
    let cy = y;
    setColor(doc, PDF_COLORS.black, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(8);
    doc.text(header, x, cy);
    cy += 5.5;
    setColor(doc, PDF_COLORS.black, "text");
    doc.setFont("LiberationSans", "normal"); doc.setFontSize(10);
    const titleLines = doc.splitTextToSize(title, colW);
    doc.text(titleLines, x, cy);
    cy += titleLines.length * 4.4 + 1.4;
    setColor(doc, PDF_COLORS.muted, "text");
    doc.setFont("LiberationSans", "normal"); doc.setFontSize(7.6);
    for (const r of rows.filter(v => v && String(v).trim().length)) {
      const wrapped = doc.splitTextToSize(String(r), colW);
      doc.text(wrapped, x, cy);
      cy += wrapped.length * 3.4 + 0.8;
    }
    return cy - y;
  };

  const fromH = drawParty(marginX, "De:", agencyName, [
    a.document ? `CNPJ: ${a.document}` : null,
    a.address,
    a.phone,
    a.email,
    a.website,
  ]);
  const toH = drawParty(marginX + colW + 10, "Para:", c.legal_name || c.company || c.name, [
    c.document ? `CNPJ/CPF: ${c.document}` : null,
    c.state_registration ? `IE: ${c.state_registration}` : null,
    c.address,
    c.phone,
    c.email,
  ]);
  y += Math.max(fromH, toH) + 4;

  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("LiberationSans", "normal"); doc.setFontSize(8.4);
  doc.text(`Data: ${longDate(data.issue_date)}`, marginX, y);
  if (data.competence) doc.text(`Competência: ${data.competence}`, marginX + colW * 0.75, y);
  if (data.due_date) doc.text(`Vencimento: ${formatDate(data.due_date)}`, pageW - marginX, y, { align: "right" });
  y += 8;

  /* -------------------------------- Tabela ------------------------------- */
  const dateColX = marginX + contentW * 0.52;
  const svcColX = marginX + contentW * 0.68;
  const rightX = pageW - marginX;
  const descW = dateColX - marginX - 4;

  const drawTableHead = () => {
    setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.2);
    doc.line(marginX, y, rightX, y);
    y += 5;
    setColor(doc, PDF_COLORS.black, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(7.6);
    doc.text("Item", marginX, y);
    doc.text("Data", dateColX, y);
    doc.text("Serviço", svcColX, y);
    doc.text("Valor", rightX, y, { align: "right" });
    y += 3;
    setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.2);
    doc.line(marginX, y, rightX, y);
    y += 4;
  };
  drawTableHead();

  // agrupa por projeto preservando ordem
  const groups: Array<{ name: string | null; lines: InvoiceLine[] }> = [];
  for (const line of data.lines) {
    const g = line.group?.trim() || null;
    const last = groups[groups.length - 1];
    if (last && last.name === g) last.lines.push(line);
    else groups.push({ name: g, lines: [line] });
  }

  for (const group of groups) {
    const groupTotal = group.lines.reduce((s, l) => s + Number(l.amount || 0), 0);

    if (group.name) {
      if (y + 20 > footerY - 10) y = newPage();
      setColor(doc, PDF_COLORS.paper, "fill");
      doc.rect(marginX, y, contentW, 8, "F");
      setColor(doc, PDF_COLORS.graphite, "text");
      doc.setFont("LiberationSans", "bold"); doc.setFontSize(9);
      doc.text(doc.splitTextToSize(group.name, contentW * 0.6)[0], marginX + 3, y + 5.4);
      doc.text(brl(groupTotal), rightX - 3, y + 5.4, { align: "right" });
      y += 8;
    }

    for (const line of group.lines) {
      const indent = line.is_child ? 8 : 2;
      const titleText = line.is_child ? `— ${line.title}` : line.title;
      const titleLines = doc.splitTextToSize(titleText, descW - indent);
      const detailLines = line.detail ? doc.splitTextToSize(line.detail, descW - indent) : [];
      const rowH = Math.max(9, titleLines.length * 4 + detailLines.length * 3.4 + 5);

      if (y + rowH > footerY - 10) { y = newPage(); drawTableHead(); }

      setColor(doc, line.is_child ? PDF_COLORS.muted : PDF_COLORS.black, "text");
      doc.setFont("LiberationSans", "normal"); doc.setFontSize(8.6);
      doc.text(titleLines, marginX + indent, y + 5);

      if (detailLines.length) {
        setColor(doc, PDF_COLORS.muted, "text");
        doc.setFont("LiberationSans", "normal"); doc.setFontSize(7.2);
        doc.text(detailLines, marginX + indent, y + 5 + titleLines.length * 4);
      }

      setColor(doc, PDF_COLORS.muted, "text");
      doc.setFont("LiberationSans", "normal"); doc.setFontSize(8);
      doc.text(line.reference_date ? shortDate(line.reference_date) : "—", dateColX, y + 5);
      const svc = (line.service || line.reference_label || "").trim();
      if (svc) doc.text(doc.splitTextToSize(svc, rightX - svcColX - 22)[0], svcColX, y + 5);

      setColor(doc, PDF_COLORS.black, "text");
      doc.setFont("LiberationSans", line.is_child ? "normal" : "bold"); doc.setFontSize(8.6);
      doc.text(brl(line.amount), rightX, y + 5, { align: "right" });

      y += rowH;
      setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.1);
      doc.line(marginX + (line.is_child ? 6 : 0), y, rightX, y);
    }
    y += 5;
  }

  /* --------------------------------- Total -------------------------------- */
  if (y + 16 > footerY - 10) y = newPage();
  setColor(doc, PDF_COLORS.paper, "fill");
  doc.rect(marginX, y, contentW, 11, "F");
  setColor(doc, PDF_COLORS.graphite, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(11);
  doc.text("Total", marginX + 3, y + 7.3);
  doc.text(brl(total), rightX - 3, y + 7.3, { align: "right" });
  y += 18;

  /* ------------------- Condições / Observações  |  QR --------------------- */
  const qrBoxW = 52;
  const qrBoxH = 62;
  const gapCol = 8;
  const leftW = contentW - qrBoxW - gapCol;

  if (y + qrBoxH > footerY - 6) y = newPage();

  const qrBoxX = marginX + contentW - qrBoxW;
  const qrBoxY = y;

  let ly = y;
  setColor(doc, PDF_COLORS.graphite, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(6.8);
  doc.text("CONDIÇÕES DE PAGAMENTO", marginX, ly, { charSpace: 0.6 });
  ly += 4.5;
  setColor(doc, PDF_COLORS.black, "text");
  doc.setFont("LiberationSans", "normal"); doc.setFontSize(8);
  const terms = doc.splitTextToSize(data.payment_terms || DEFAULT_PAYMENT_TERMS, leftW);
  doc.text(terms, marginX, ly);
  ly += terms.length * 3.6 + 5;

  setColor(doc, PDF_COLORS.graphite, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(6.8);
  doc.text("OBSERVAÇÕES LEGAIS", marginX, ly, { charSpace: 0.6 });
  ly += 4.5;
  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("LiberationSans", "normal"); doc.setFontSize(7.4);
  const legal = doc.splitTextToSize(data.notes || DEFAULT_LEGAL_NOTES, leftW);
  doc.text(legal, marginX, ly);
  ly += legal.length * 3.3;

  setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.4);
  if (doc.setLineDashPattern) doc.setLineDashPattern([1.2, 1.2], 0);
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 2, 2);
  if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);

  setColor(doc, PDF_COLORS.graphite, "text");
  doc.setFont("LiberationSans", "bold"); doc.setFontSize(6.8);
  doc.text("PAGAMENTO", qrBoxX + qrBoxW / 2, qrBoxY + 5.5, { align: "center", charSpace: 0.6 });

  const qrSize = 34;
  const qrX = qrBoxX + (qrBoxW - qrSize) / 2;
  const qrY = qrBoxY + 9;
  const paymentPayload = data.payment_link?.trim();
  if (paymentPayload) {
    const drewVectorQR = drawQRCodeVector(doc, paymentPayload, qrX, qrY, qrSize);
    if (!drewVectorQR) {
      const qrDataUrl = await makeQRCodeDataUrl(paymentPayload);
      if (qrDataUrl) doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
    }
    setColor(doc, PDF_COLORS.muted, "text");
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

  y = Math.max(ly, qrBoxY + qrBoxH) + 5;

  if (data.payment_instructions) {
    if (y + 16 > footerY - 6) y = newPage();
    setColor(doc, PDF_COLORS.graphite, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(6.8);
    doc.text("INSTRUÇÕES EXTRAS", marginX, y, { charSpace: 0.6 });
    y += 4.5;
    setColor(doc, PDF_COLORS.black, "text");
    doc.setFont("LiberationSans", "normal"); doc.setFontSize(8);
    doc.text(doc.splitTextToSize(data.payment_instructions, contentW), marginX, y);
  }

  drawFooter();
  return doc;
}
