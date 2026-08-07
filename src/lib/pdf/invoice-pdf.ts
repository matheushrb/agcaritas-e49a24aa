import jsPDF from "jspdf";
import QRCode from "qrcode";
import { PDF_LAYOUT, brl, formatDate } from "./theme";
import { registerLiberationFonts } from "./fonts";
import caritasLogo from "@/assets/caritas-logo-pdf.jpg.asset.json";

/* ---------------------------------------------------------------- paleta */
const C = {
  deep: [22, 59, 140] as [number, number, number],      // #163B8C
  cobalt: [23, 105, 246] as [number, number, number],   // #1769F6
  body: [64, 84, 118] as [number, number, number],      // texto secundário
  soft: [122, 139, 166] as [number, number, number],    // texto terciário
  bandLight: [238, 244, 255] as [number, number, number], // #EEF4FF
  bandGroup: [234, 241, 255] as [number, number, number],
  border: [217, 231, 255] as [number, number, number],  // #D9E7FF
  hair: [230, 236, 245] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
  warnBg: [255, 243, 214] as [number, number, number],
  warnInk: [146, 96, 12] as [number, number, number],
};

const fill = (d: jsPDF, c: [number, number, number]) => d.setFillColor(c[0], c[1], c[2]);
const draw = (d: jsPDF, c: [number, number, number]) => d.setDrawColor(c[0], c[1], c[2]);
const ink = (d: jsPDF, c: [number, number, number]) => d.setTextColor(c[0], c[1], c[2]);

/* ---------------------------------------------------------------- tipos */
export interface InvoiceLine {
  title: string;
  detail?: string;
  qty?: number;
  unit_price?: number;
  amount: number;
  is_child?: boolean;
  reference_date?: string | Date | null;
  reference_label?: string;
  group?: string | null;
  service?: string | null;
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
  number: string;
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
  pix_code?: string;
  payment_method?: string;
  status_label?: string;
  payment_instructions?: string;
  is_preview?: boolean;
}

export const DEFAULT_PAYMENT_TERMS =
  "Escaneie o QR Code ao lado com o app do seu banco ou copie e cole o código Pix abaixo.";

export const DEFAULT_LEGAL_NOTES =
  "Este QR Code e o código Pix correspondem ao valor desta fatura. Caso precise de alguma correção, " +
  "desconsidere esta cobrança; enviaremos uma nova fatura.";

/* ------------------------------------------------------------- utilidades */
const shortDate = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const full = formatDate(d);
  if (full === "-") return "";
  const [dd, mm, yyyy] = full.split("/");
  return `${dd}/${mm}/${(yyyy ?? "").slice(2)}`;
};

const longDate = (d: string | Date | null | undefined) => {
  if (!d) return "-";
  const dt = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(`${d}T12:00:00`)
    : typeof d === "string" ? new Date(d) : d;
  const day = String(dt.getDate()).padStart(2, "0");
  const mon = dt.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${day}/${mon}/${dt.getFullYear()}`;
};

/** achata transparência sobre branco (jsPDF renderiza alpha como preto) */
async function flattenOnWhite(dataUrl: string): Promise<string> {
  if (typeof document === "undefined") return dataUrl;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.94);
  } catch {
    return dataUrl;
  }
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    if (url.startsWith("data:")) return await flattenOnWhite(url);
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    }).then((d) => (d ? flattenOnWhite(d) : null));
  } catch {
    return null;
  }
}

function drawQRCodeVector(doc: jsPDF, text: string, x: number, y: number, size: number): boolean {
  const payload = text.trim();
  if (!payload) return false;
  try {
    const qr = QRCode.create(payload, { errorCorrectionLevel: "M" }) as unknown as {
      modules: { size: number; data: ArrayLike<boolean | number>; get?: (r: number, c: number) => boolean };
    };
    const n = qr.modules.size;
    const quiet = 2;
    const cell = size / (n + quiet * 2);
    fill(doc, C.white);
    doc.rect(x, y, size, size, "F");
    fill(doc, C.black);
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const dark = qr.modules.get ? qr.modules.get(row, col) : qr.modules.data[row * n + col];
        if (!dark) continue;
        doc.rect(x + (col + quiet) * cell, y + (row + quiet) * cell, cell + 0.02, cell + 0.02, "F");
      }
    }
    return true;
  } catch {
    return false;
  }
}

/* pequeno ícone de calendário vetorial */
function calendarIcon(doc: jsPDF, x: number, y: number, s = 4.6) {
  draw(doc, C.cobalt);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y + 0.7, s, s - 0.5, 0.6, 0.6);
  doc.line(x, y + 2.1, x + s, y + 2.1);
  doc.line(x + 1.2, y + 0.7, x + 1.2, y);
  doc.line(x + s - 1.2, y + 0.7, x + s - 1.2, y);
}

/* --------------------------------------------------------------- gerador */
export async function generateInvoicePDF(data: InvoicePDFData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: false });
  registerLiberationFonts(doc);

  // A fonte embarcada não possui alguns glifos tipográficos: normaliza antes de desenhar.
  const sanitize = (v: string) =>
    v.replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'")
     .replace(/[\u201C\u201D]/g, '"').replace(/\u2026/g, "...");
  const rawText = doc.text.bind(doc);
  doc.text = ((txt: string | string[], ...rest: unknown[]) =>
    rawText(
      Array.isArray(txt) ? txt.map((t) => sanitize(String(t))) : sanitize(String(txt)),
      ...(rest as [number, number]),
    )) as typeof doc.text;

  const { pageW, pageH } = PDF_LAYOUT;
  const marginX = 15;
  const rightX = pageW - marginX;
  const contentW = pageW - marginX * 2;
  const footerTop = pageH - 20;

  const F = (style: "normal" | "bold" | "italic", size: number) => {
    doc.setFont("LiberationSans", style);
    doc.setFontSize(size);
  };

  const a = data.agency ?? {};
  const c = data.client;
  const agencyName = a.name || a.legal_name || "Agência Caritas";
  const agencyLine = [
    a.document ? `CNPJ: ${a.document}` : null,
    a.email,
    a.phone,
  ].filter(Boolean).join("  •  ");

  const logoDataUrl = await loadImageAsDataUrl(a.logo_url || caritasLogo.url);

  const subtotal = data.lines.reduce((s, l) => s + Number(l.amount || 0), 0);
  const total = subtotal - Number(data.discount ?? 0) + Number(data.taxes ?? 0);

  /* --------------------------------------------------- cabeçalho da página */
  const drawHeader = (): number => {
    let y = 14;
    if (logoDataUrl) {
      try {
        const fmt = /^data:image\/jpe?g/i.test(logoDataUrl) ? "JPEG" : "PNG";
        doc.addImage(logoDataUrl, fmt, marginX, y, 40, 11.2);
      } catch { /* ignore */ }
    } else {
      ink(doc, C.deep); F("bold", 19);
      doc.text("Caritas", marginX, y + 9);
    }
    ink(doc, C.deep); F("bold", 17);
    doc.text(`Fatura #${data.number}`, rightX, y + 8, { align: "right" });
    draw(doc, C.cobalt); doc.setLineWidth(0.9);
    const titleW = doc.getTextWidth(`Fatura #${data.number}`);
    doc.line(rightX - titleW, y + 11.4, rightX - titleW + 12, y + 11.4);

    if (data.is_preview) {
      ink(doc, C.soft); F("bold", 7);
      doc.text("PRÉVIA · AGUARDANDO EMISSÃO", rightX, y + 16.5, { align: "right", charSpace: 0.5 });
    }
    return y + 22;
  };

  /* -------------------------------------------------------------- rodapé */
  const drawFooters = () => {
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      draw(doc, C.cobalt); doc.setLineWidth(0.5);
      doc.line(marginX, footerTop, rightX, footerTop);
      ink(doc, C.body); F("bold", 7.4);
      doc.text(agencyName, marginX, footerTop + 4.6);
      ink(doc, C.soft); F("normal", 6.8);
      if (agencyLine) doc.text(agencyLine, marginX, footerTop + 8.4);
      ink(doc, C.deep); F("bold", 8);
      doc.text(`${p}/${pages}`, rightX, footerTop + 6.4, { align: "right" });
    }
  };

  /* ------------------------------------------------- blocos de identificação */
  let y = drawHeader();

  const colGap = 10;
  const colW = (contentW - colGap) / 2;
  const col2X = marginX + colW + colGap;

  const party = (x: number, label: string, title: string, rows: Array<string | null | undefined>) => {
    let cy = y;
    ink(doc, C.cobalt); F("bold", 7);
    doc.text(label, x, cy, { charSpace: 0.5 });
    draw(doc, C.cobalt); doc.setLineWidth(0.7);
    doc.line(x, cy + 1.7, x + 8, cy + 1.7);
    cy += 8;
    ink(doc, C.deep); F("bold", 10);
    const tl = doc.splitTextToSize(title, colW - 4);
    doc.text(tl, x, cy);
    cy += tl.length * 4.6 + 1.4;
    ink(doc, C.body); F("normal", 7.8);
    for (const r of rows.filter(v => v && String(v).trim().length)) {
      const wrapped = doc.splitTextToSize(String(r).replace(/\n/g, " · "), colW - 4);
      doc.text(wrapped, x, cy);
      cy += wrapped.length * 3.7 + 1.6;
    }
    return cy - y;
  };

  const hFrom = party(marginX, "EMITENTE", agencyName, [
    a.legal_name && a.legal_name !== agencyName ? `Razão social: ${a.legal_name}` : null,
    a.document ? `CNPJ: ${a.document}` : null,
    a.address,
    a.phone,
    a.email,
  ]);
  const clientTitle = (c.company || c.name || c.legal_name || "").trim();
  const hTo = party(col2X, "DESTINATÁRIO", clientTitle, [
    c.legal_name && c.legal_name.trim().toUpperCase() !== clientTitle.toUpperCase()
      ? `Razão social: ${c.legal_name}` : null,
    c.document ? `CNPJ: ${c.document}` : null,
    c.state_registration ? `IE: ${c.state_registration}` : null,
    c.address,
    c.phone,
    c.email,
  ]);
  const blockH = Math.max(hFrom, hTo);

  draw(doc, C.border); doc.setLineWidth(0.3);
  doc.line(col2X - colGap / 2, y - 2, col2X - colGap / 2, y + blockH - 1);
  y += blockH + 4;
  doc.line(marginX, y, rightX, y);
  y += 8;

  /* ------------------------------------------- data de emissão / competência */
  const infoBlock = (x: number, label: string, value: string) => {
    calendarIcon(doc, x, y - 3.4);
    ink(doc, C.cobalt); F("bold", 7);
    doc.text(label, x + 7, y - 1.2, { charSpace: 0.5 });
    ink(doc, C.deep); F("normal", 9.4);
    doc.text(value, x + 7, y + 4.2);
  };
  infoBlock(marginX, "DATA DE EMISSÃO", longDate(data.issue_date));
  infoBlock(col2X, "COMPETÊNCIA", data.competence || "-");
  y += 10;

  draw(doc, C.border); doc.setLineWidth(0.3);
  doc.line(marginX, y, rightX, y);
  y += 6;

  /* -------------------------------------------------------------- tabela */
  const dateX = marginX + contentW * 0.575;
  const svcX = marginX + contentW * 0.70;
  const itemW = dateX - marginX - 6;

  const tableHead = () => {
    fill(doc, C.bandLight);
    doc.rect(marginX, y, contentW, 8, "F");
    ink(doc, C.deep); F("bold", 7.8);
    doc.text("Item", marginX + 3, y + 5.2);
    doc.text("Data", dateX, y + 5.2);
    doc.text("Serviço", svcX, y + 5.2);
    doc.text("Valor unitário", rightX - 3, y + 5.2, { align: "right" });
    y += 8;
    draw(doc, C.border); doc.setLineWidth(0.3);
    doc.line(marginX, y, rightX, y);
    y += 1.5;
  };

  const nextPage = (withHead = true) => {
    doc.addPage();
    y = drawHeader();
    if (withHead) tableHead();
  };

  tableHead();

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
      if (y + 18 > footerTop - 6) nextPage();
      fill(doc, C.bandGroup);
      doc.rect(marginX, y, contentW, 8.4, "F");
      ink(doc, C.cobalt); F("bold", 8.8);
      doc.text(doc.splitTextToSize(group.name, contentW * 0.62)[0], marginX + 3, y + 5.6);
      doc.text(brl(groupTotal), rightX - 3, y + 5.6, { align: "right" });
      y += 8.4;
    }

    for (const line of group.lines) {
      const indent = line.is_child ? 9 : 3;
      const titleText = line.is_child ? `- ${line.title}` : line.title;
      const titleLines = doc.splitTextToSize(titleText, itemW - indent);
      const detailLines = line.detail ? doc.splitTextToSize(line.detail, itemW - indent) : [];
      const rowH = Math.max(8.4, titleLines.length * 3.9 + detailLines.length * 3.3 + 4.6);

      if (y + rowH > footerTop - 6) nextPage();

      ink(doc, C.deep); F("normal", 8.2);
      doc.text(titleLines, marginX + indent, y + 5);

      if (detailLines.length) {
        ink(doc, C.soft); F("normal", 7);
        doc.text(detailLines, marginX + indent, y + 5 + titleLines.length * 3.9);
      }

      ink(doc, C.soft); F("normal", 7.8);
      const dt = shortDate(line.reference_date);
      if (dt) doc.text(dt, dateX, y + 5);
      const svc = (line.service || line.reference_label || "").trim();
      if (svc) {
        ink(doc, C.body);
        doc.text(doc.splitTextToSize(svc, rightX - svcX - 24)[0], svcX, y + 5);
      }

      ink(doc, C.deep); F("normal", 8.2);
      doc.text(brl(line.amount), rightX - 3, y + 5, { align: "right" });

      y += rowH;
      draw(doc, C.hair); doc.setLineWidth(0.2);
      doc.line(marginX + (line.is_child ? 9 : 0), y, rightX, y);
    }
    y += 3.5;
  }

  /* --------------------------------------------------------- total + Pix */
  const pixCardH = 46;
  const needed = 13 + 5 + pixCardH + 18;
  if (y + needed > footerTop - 6) nextPage(false);

  y += 3;
  fill(doc, C.bandLight);
  doc.rect(marginX, y, contentW, 13, "F");
  ink(doc, C.deep); F("bold", 12);
  doc.text("Total", marginX + 4, y + 8.6);
  doc.text(brl(total), rightX - 4, y + 8.6, { align: "right" });
  y += 13 + 6;

  /* card de pagamento */
  const cardY = y;
  draw(doc, C.border); doc.setLineWidth(0.4);
  doc.roundedRect(marginX, cardY, contentW, pixCardH, 2.5, 2.5);

  const zoneA = marginX + 5;
  const zoneAW = contentW * 0.46;
  const qrSize = 30;
  const qrX = marginX + contentW * 0.53;
  const qrY = cardY + (pixCardH - qrSize) / 2;
  const metaX = marginX + contentW * 0.76;

  // zona A — instruções + copia e cola
  ink(doc, C.deep); F("bold", 9.4);
  doc.text("Pagamento via Pix", zoneA + 6.5, cardY + 8);
  draw(doc, C.cobalt); doc.setLineWidth(0.4);
  doc.circle(zoneA + 2.6, cardY + 6.6, 2.2);

  ink(doc, C.body); F("normal", 7.6);
  const instr = doc.splitTextToSize(data.payment_terms || DEFAULT_PAYMENT_TERMS, zoneAW - 4);
  doc.text(instr.slice(0, 2), zoneA, cardY + 13.6);

  const pixPayload = (data.pix_code || data.payment_link || "").trim();
  const boxY = cardY + 20;
  const boxH = 15;
  draw(doc, C.border); doc.setLineWidth(0.35);
  if (doc.setLineDashPattern) doc.setLineDashPattern([1.1, 1.1], 0);
  doc.roundedRect(zoneA - 1, boxY, zoneAW, boxH, 1.6, 1.6);
  if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
  ink(doc, C.soft); F("normal", 6.2);
  doc.text(pixPayload ? "Código Pix (Copia e Cola)" : "Código Pix", zoneA + 1.4, boxY + 4);
  ink(doc, C.deep); F("normal", 6);
  const codeLines = doc.splitTextToSize(pixPayload || "Não informado", zoneAW - 5);
  doc.text(codeLines.slice(0, 3), zoneA + 1.4, boxY + 7.6);

  // aviso obrigatório
  const warnY = boxY + boxH + 1.6;
  fill(doc, C.bandLight);
  doc.roundedRect(zoneA - 1, warnY, zoneAW, 7.4, 1.4, 1.4, "F");
  ink(doc, C.body); F("normal", 5.6);
  const warn = doc.splitTextToSize(data.notes || DEFAULT_LEGAL_NOTES, zoneAW - 4);
  doc.text(warn.slice(0, 3), zoneA + 1.4, warnY + 2.8);

  // zona B — QR
  draw(doc, C.border); doc.setLineWidth(0.4);
  doc.roundedRect(qrX - 2.5, qrY - 2.5, qrSize + 5, qrSize + 5, 2, 2);
  if (pixPayload) {
    if (!drawQRCodeVector(doc, pixPayload, qrX, qrY, qrSize)) {
      const url = await QRCode.toDataURL(pixPayload, { errorCorrectionLevel: "M", margin: 1, width: 400 });
      doc.addImage(url, "PNG", qrX, qrY, qrSize, qrSize);
    }
    if (/^https?:\/\//i.test(pixPayload)) doc.link(qrX, qrY, qrSize, qrSize, { url: pixPayload });
  } else {
    ink(doc, C.soft); F("italic", 6.4);
    doc.text("QR Code indisponível", qrX + qrSize / 2, qrY + qrSize / 2, { align: "center" });
  }

  // zona C — metadados
  draw(doc, C.border); doc.setLineWidth(0.3);
  doc.line(metaX - 5, cardY + 5, metaX - 5, cardY + pixCardH - 5);

  const meta = (label: string, value: string, my: number, badge = false) => {
    ink(doc, C.soft); F("normal", 6.6);
    doc.text(label, metaX, my);
    if (badge) {
      const w = doc.getTextWidth(value) + 6;
      fill(doc, C.warnBg);
      doc.roundedRect(metaX - 1, my + 1.6, w, 5.6, 2.8, 2.8, "F");
      ink(doc, C.warnInk); F("bold", 7.2);
      doc.text(value, metaX + 2, my + 5.5);
    } else {
      ink(doc, C.deep); F("bold", 8.6);
      doc.text(value, metaX, my + 5.4);
    }
  };
  meta("Vencimento", data.due_date ? formatDate(data.due_date) : "-", cardY + 8);
  meta("Forma de pagamento", data.payment_method || "Pix", cardY + 21);
  

  y = cardY + pixCardH + 7;

  /* ------------------------------------------------ mensagem institucional */
  if (y + 16 > footerTop - 4) nextPage(false);
  draw(doc, C.cobalt); doc.setLineWidth(0.5);
  doc.line(marginX, y, rightX, y);
  y += 6;
  ink(doc, C.deep); F("bold", 8.6);
  doc.text("Obrigado por confiar em nosso trabalho!", marginX + 2, y);
  ink(doc, C.body); F("normal", 7.6);
  doc.text("Em caso de dúvidas, entre em contato conosco.", marginX + 2, y + 4.8);
  y += 10;

  if (data.payment_instructions) {
    if (y + 14 > footerTop - 4) nextPage(false);
    ink(doc, C.cobalt); F("bold", 6.8);
    doc.text("INSTRUÇÕES EXTRAS", marginX, y, { charSpace: 0.5 });
    ink(doc, C.body); F("normal", 7.6);
    doc.text(doc.splitTextToSize(data.payment_instructions, contentW), marginX, y + 4.6);
  }

  drawFooters();
  return doc;
}
