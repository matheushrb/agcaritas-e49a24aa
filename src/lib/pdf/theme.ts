/**
 * Sistema de design tipográfico/industrial para PDFs (faturas e propostas).
 * Paleta sóbria: preto/cinza base, azul do sistema apenas para destaques.
 */
import type { jsPDF } from "jspdf";

// Paleta industrial (RGB)
export const PDF_COLORS = {
  ink:       [29, 78, 216] as [number, number, number],   // #1D4ED8 - azul do sistema (blue-700)
  graphite:  [37, 99, 235] as [number, number, number],   // #2563EB - azul primário (blue-600)
  muted:     [100, 116, 139] as [number, number, number], // #64748B - azul acinzentado
  hairline:  [219, 234, 254] as [number, number, number], // #DBEAFE - azul claro (linhas)
  paper:     [239, 246, 255] as [number, number, number], // #EFF6FF - azul-gelo
  accent:    [59, 130, 246] as [number, number, number],  // #3B82F6 - azul acento (blue-500)
  black:     [0, 0, 0] as [number, number, number],
  white:     [255, 255, 255] as [number, number, number],
};


// Layout (mm) - A4 portrait
export const PDF_LAYOUT = {
  pageW: 210,
  pageH: 297,
  marginX: 18,
  marginY: 18,
  gutter: 6,
};

export const setColor = (doc: jsPDF, rgb: [number, number, number], kind: "fill" | "text" | "draw" = "text") => {
  if (kind === "fill") doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  else if (kind === "draw") doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  else doc.setTextColor(rgb[0], rgb[1], rgb[2]);
};

export const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

export const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(`${d}T12:00:00`)
    : typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

/**
 * Cabeçalho industrial: barra grafite estreita + wordmark + slug do documento.
 */
export function drawIndustrialHeader(doc: jsPDF, opts: {
  documentKind: string;   // "FATURA" | "PROPOSTA COMERCIAL"
  documentNumber: string; // "PRO-0007" | "202601-0004"
  competence?: string;    // "Competência 01/2026"
  logoDataUrl?: string | null; // opcional: logo da agência (dataURL)
}) {
  const { marginX, pageW } = PDF_LAYOUT;

  // Barra superior fina
  setColor(doc, PDF_COLORS.ink, "fill");
  doc.rect(0, 0, pageW, 4, "F");

  // Slot da LOGO (14x14mm) — usa a imagem se fornecida, senão desenha placeholder
  const logoSize = 14;
  const logoX = marginX;
  const logoY = 12;
  if (opts.logoDataUrl) {
    try {
      doc.addImage(opts.logoDataUrl, "PNG", logoX, logoY, logoSize, logoSize);
    } catch {
      // ignora e desenha placeholder abaixo
    }
  } else {
    setColor(doc, PDF_COLORS.hairline, "draw"); doc.setLineWidth(0.3);
    doc.rect(logoX, logoY, logoSize, logoSize);
    setColor(doc, PDF_COLORS.muted, "text");
    doc.setFont("LiberationSans", "bold"); doc.setFontSize(6);
    doc.text("LOGO", logoX + logoSize / 2, logoY + logoSize / 2 + 1, { align: "center", charSpace: 0.4 });
  }

  // Wordmark (deslocado para a direita da logo)
  const textX = logoX + logoSize + 5;
  setColor(doc, PDF_COLORS.ink, "text");
  doc.setFont("LiberationSans", "bold");
  doc.setFontSize(16);
  doc.text("CARITAS", textX, 20);
  doc.setFont("LiberationSans", "normal");
  doc.setFontSize(8);
  setColor(doc, PDF_COLORS.muted, "text");
  doc.text("AGÊNCIA · GESTÃO CRIATIVA", textX, 25);

  // Bloco à direita: tipo de documento + número
  const rightX = pageW - marginX;
  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("LiberationSans", "bold");
  doc.setFontSize(7.5);
  doc.text(opts.documentKind, rightX, 18, { align: "right" });

  setColor(doc, PDF_COLORS.ink, "text");
  doc.setFont("LiberationSans", "bold");
  doc.setFontSize(22);
  doc.text(opts.documentNumber, rightX, 27, { align: "right" });

  if (opts.competence) {
    setColor(doc, PDF_COLORS.muted, "text");
    doc.setFont("LiberationSans", "normal");
    doc.setFontSize(8);
    doc.text(opts.competence, rightX, 32, { align: "right" });
  }

  // Linha divisória
  setColor(doc, PDF_COLORS.hairline, "draw");
  doc.setLineWidth(0.2);
  doc.line(marginX, 38, pageW - marginX, 38);
}

/**
 * Rodapé com paginação e nota fiscal (opcional).
 */
export function drawIndustrialFooter(doc: jsPDF, opts: { pageLabel?: string; note?: string } = {}) {
  const { marginX, pageW, pageH } = PDF_LAYOUT;
  setColor(doc, PDF_COLORS.hairline, "draw");
  doc.setLineWidth(0.2);
  doc.line(marginX, pageH - 16, pageW - marginX, pageH - 16);

  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("LiberationSans", "normal");
  doc.setFontSize(7.5);
  doc.text(opts.note ?? "Documento gerado eletronicamente por Caritas Agência.", marginX, pageH - 10);
  if (opts.pageLabel) doc.text(opts.pageLabel, pageW - marginX, pageH - 10, { align: "right" });
}

/**
 * Rótulo de seção estilo editorial (SMALL CAPS + letter-spacing).
 */
export function drawSectionLabel(doc: jsPDF, y: number, label: string, maxX?: number) {
  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("LiberationSans", "bold");
  doc.setFontSize(7.5);
  doc.text(label.toUpperCase(), PDF_LAYOUT.marginX, y, { charSpace: 0.6 });
  setColor(doc, PDF_COLORS.hairline, "draw");
  doc.setLineWidth(0.15);
  const endX = maxX ?? (PDF_LAYOUT.pageW - PDF_LAYOUT.marginX);
  doc.line(PDF_LAYOUT.marginX, y + 1.5, endX, y + 1.5);
}

/**
 * Bloco chave/valor em duas colunas.
 */
export function drawKV(doc: jsPDF, x: number, y: number, key: string, value: string, width = 60) {
  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("LiberationSans", "normal");
  doc.setFontSize(7.5);
  doc.text(key.toUpperCase(), x, y, { charSpace: 0.4 });
  setColor(doc, PDF_COLORS.ink, "text");
  doc.setFont("LiberationSans", "bold");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(value || "—", width);
  doc.text(lines, x, y + 5);
  return y + 5 + lines.length * 4;
}
