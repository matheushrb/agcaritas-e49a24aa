/**
 * Sistema de design tipográfico/industrial para PDFs (faturas e propostas).
 * Paleta densa, editorial, sem gradientes. Preto/grafite + acento sóbrio.
 */
import type { jsPDF } from "jspdf";

// Paleta industrial (RGB)
export const PDF_COLORS = {
  ink:       [17, 24, 39] as [number, number, number],    // #111827 - grafite quase preto
  graphite:  [55, 65, 81] as [number, number, number],    // #374151 - grafite médio
  muted:     [107, 114, 128] as [number, number, number], // #6B7280 - cinza
  hairline:  [209, 213, 219] as [number, number, number], // #D1D5DB - linhas
  paper:     [250, 250, 249] as [number, number, number], // #FAFAF9 - off-white
  accent:    [30, 58, 138] as [number, number, number],   // #1E3A8A - azul marinho industrial
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
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

/**
 * Cabeçalho industrial: barra grafite estreita + wordmark + slug do documento.
 */
export function drawIndustrialHeader(doc: jsPDF, opts: {
  documentKind: string;   // "FATURA" | "PROPOSTA COMERCIAL"
  documentNumber: string; // "PRO-0007" | "202601-0004"
  competence?: string;    // "Competência 01/2026"
}) {
  const { marginX, pageW } = PDF_LAYOUT;

  // Barra superior fina
  setColor(doc, PDF_COLORS.ink, "fill");
  doc.rect(0, 0, pageW, 4, "F");

  // Wordmark
  setColor(doc, PDF_COLORS.ink, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("CARITAS", marginX, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor(doc, PDF_COLORS.muted, "text");
  doc.text("AGÊNCIA · GESTÃO CRIATIVA", marginX, 25);

  // Bloco à direita: tipo de documento + número
  const rightX = pageW - marginX;
  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(opts.documentKind, rightX, 18, { align: "right" });

  setColor(doc, PDF_COLORS.ink, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(opts.documentNumber, rightX, 27, { align: "right" });

  if (opts.competence) {
    setColor(doc, PDF_COLORS.muted, "text");
    doc.setFont("helvetica", "normal");
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
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(opts.note ?? "Documento gerado eletronicamente por Caritas Agência.", marginX, pageH - 10);
  if (opts.pageLabel) doc.text(opts.pageLabel, pageW - marginX, pageH - 10, { align: "right" });
}

/**
 * Rótulo de seção estilo editorial (SMALL CAPS + letter-spacing).
 */
export function drawSectionLabel(doc: jsPDF, y: number, label: string) {
  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(label.toUpperCase(), PDF_LAYOUT.marginX, y, { charSpace: 0.6 });
  setColor(doc, PDF_COLORS.hairline, "draw");
  doc.setLineWidth(0.15);
  doc.line(PDF_LAYOUT.marginX, y + 1.5, PDF_LAYOUT.pageW - PDF_LAYOUT.marginX, y + 1.5);
}

/**
 * Bloco chave/valor em duas colunas.
 */
export function drawKV(doc: jsPDF, x: number, y: number, key: string, value: string, width = 60) {
  setColor(doc, PDF_COLORS.muted, "text");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(key.toUpperCase(), x, y, { charSpace: 0.4 });
  setColor(doc, PDF_COLORS.ink, "text");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(value || "—", width);
  doc.text(lines, x, y + 5);
  return y + 5 + lines.length * 4;
}
