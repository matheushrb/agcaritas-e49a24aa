import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CalendarBlock = {
  id: string;
  user_id: string;
  kind: "ferias" | "folga" | "bloqueio" | "feriado";
  start_date: string; // YYYY-MM-DD
  end_date: string;
  reason: string | null;
  all_day: boolean;
};

export const BLOCK_META: Record<CalendarBlock["kind"], { label: string; color: string; dot: string }> = {
  ferias:   { label: "Férias",   color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",   dot: "bg-amber-500" },
  folga:    { label: "Folga",    color: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",           dot: "bg-sky-500" },
  bloqueio: { label: "Bloqueio", color: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",       dot: "bg-rose-500" },
  feriado:  { label: "Feriado",  color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" },
};

export function useCalendarBlocks() {
  return useQuery<CalendarBlock[]>({
    queryKey: ["calendar-blocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_blocks" as any)
        .select("id,user_id,kind,start_date,end_date,reason,all_day")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown) as CalendarBlock[];
    },
  });
}

/** Retorna true se a data ISO (YYYY-MM-DD ou full ISO) está dentro de algum bloqueio. */
export function isBlockedOn(blocks: CalendarBlock[] | undefined, userId: string | null | undefined, dateISO: string | null | undefined): CalendarBlock | null {
  if (!blocks || !userId || !dateISO) return null;
  const d = dateISO.slice(0, 10);
  return blocks.find(b => b.user_id === userId && d >= b.start_date && d <= b.end_date) ?? null;
}

/** Retorna o conjunto de user_ids bloqueados numa data específica. */
export function blockedUserIdsOn(blocks: CalendarBlock[] | undefined, dateISO: string | null | undefined): Map<string, CalendarBlock> {
  const m = new Map<string, CalendarBlock>();
  if (!blocks || !dateISO) return m;
  const d = dateISO.slice(0, 10);
  for (const b of blocks) {
    if (d >= b.start_date && d <= b.end_date) m.set(b.user_id, b);
  }
  return m;
}
