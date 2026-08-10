/* ============================================================
   Prazos relativos das etapas.

   Cada etapa de um tipo de tarefa pode definir quantos dias antes
   da entrega (deadline) ela deve começar e terminar. A partir da
   data de entrega da tarefa, calculamos a janela real da etapa e
   avisamos quando ela está fora do prazo.
   ============================================================ */

export type StageOffsets = {
  id: string;
  name: string;
  color?: string | null;
  start_offset_days: number | null;
  end_offset_days: number | null;
};

export type StageWindow = {
  stageId: string;
  name: string;
  color: string;
  /** Data (YYYY-MM-DD) em que a etapa deve começar. */
  start: string | null;
  /** Data (YYYY-MM-DD) em que a etapa deve terminar. */
  end: string | null;
};

const DAY = 86_400_000;

export function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shift(ymd: string, days: number): string {
  const t = new Date(`${ymd}T12:00:00`).getTime() - days * DAY;
  return new Date(t).toISOString().slice(0, 10);
}

export function fmtBr(ymd: string | null): string {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/** Janela de cada etapa, calculada a partir da data de entrega da tarefa. */
export function computeStageWindows(dueDate: string | null | undefined, stages: StageOffsets[]): StageWindow[] {
  return stages.map(s => ({
    stageId: s.id,
    name: s.name,
    color: s.color || "#2F6BEF",
    start: dueDate && s.start_offset_days != null ? shift(dueDate, s.start_offset_days) : null,
    end: dueDate && s.end_offset_days != null ? shift(dueDate, s.end_offset_days) : null,
  }));
}

export type StageAlert = { level: "late" | "warn" | "ok"; message: string } | null;

/**
 * Avisa se a etapa está fora do prazo.
 * `position`: -1 concluída, 0 etapa atual, 1 ainda não iniciada.
 */
export function stageAlert(w: StageWindow, position: -1 | 0 | 1, today = todayYmd()): StageAlert {
  if (!w.start && !w.end) return null;
  if (position === -1) return null;
  if (position === 0) {
    if (w.end && today > w.end) return { level: "late", message: `Atrasada — deveria terminar em ${fmtBr(w.end)}` };
    if (w.end && today === w.end) return { level: "warn", message: `Termina hoje (${fmtBr(w.end)})` };
    if (w.start && today < w.start) return { level: "warn", message: `Adiantada — só começa em ${fmtBr(w.start)}` };
    return { level: "ok", message: `No prazo — até ${fmtBr(w.end ?? w.start)}` };
  }
  if (w.start && today > w.start) {
    return { level: "late", message: `Deveria ter começado em ${fmtBr(w.start)}` };
  }
  return null;
}
