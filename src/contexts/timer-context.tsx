import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type TimerState = {
  taskId: string | null;
  taskTitle: string;
  startedAt: number | null; // ms epoch quando running
  accumulated: number;       // segundos acumulados antes de start atual
  running: boolean;
};

type TimerCtx = TimerState & {
  currentSeconds: () => number;
  startTimer: (taskId: string, taskTitle: string) => Promise<void>;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => Promise<number>;
};

const STORAGE_KEY = "pixie_timer";

const empty: TimerState = { taskId: null, taskTitle: "", startedAt: null, accumulated: 0, running: false };
const Ctx = createContext<TimerCtx | null>(null);

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState>(empty);

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const currentSeconds = useCallback(() => {
    if (state.running && state.startedAt) {
      return state.accumulated + Math.floor((Date.now() - state.startedAt) / 1000);
    }
    return state.accumulated;
  }, [state]);

  const startTimer = useCallback(async (taskId: string, taskTitle: string) => {
    setState((s) => {
      // Se existir outra task rodando, pausa e reinicia com nova
      if (s.taskId && s.taskId !== taskId) {
        // Persistir tempo da antiga (fire-and-forget)
        const total = s.running && s.startedAt
          ? s.accumulated + Math.floor((Date.now() - s.startedAt) / 1000)
          : s.accumulated;
        if (total > 0) {
          persistEntry(s.taskId, total).catch(() => {});
        }
      }
      return {
        taskId, taskTitle,
        startedAt: Date.now(),
        accumulated: s.taskId === taskId ? s.accumulated : 0,
        running: true,
      };
    });
  }, []);

  const pauseTimer = useCallback(() => {
    setState((s) => {
      if (!s.running || !s.startedAt) return s;
      const acc = s.accumulated + Math.floor((Date.now() - s.startedAt) / 1000);
      return { ...s, running: false, accumulated: acc, startedAt: null };
    });
  }, []);

  const resumeTimer = useCallback(() => {
    setState((s) => {
      if (s.running || !s.taskId) return s;
      return { ...s, running: true, startedAt: Date.now() };
    });
  }, []);

  const stopTimer = useCallback(async () => {
    const total = state.running && state.startedAt
      ? state.accumulated + Math.floor((Date.now() - state.startedAt) / 1000)
      : state.accumulated;
    const taskId = state.taskId;
    if (taskId && total > 0) {
      try {
        await persistEntry(taskId, total);
        toast.success(`Tempo salvo: ${formatHMS(total)}`);
      } catch (e) {
        toast.error("Erro ao salvar tempo");
      }
    }
    setState(empty);
    return total;
  }, [state]);

  return (
    <Ctx.Provider value={{ ...state, currentSeconds, startTimer, pauseTimer, resumeTimer, stopTimer }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTimer() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTimer must be used within TimerProvider");
  return c;
}

export function formatHMS(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function persistEntry(taskId: string, seconds: number) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return;
  const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", userRes.user.id).maybeSingle();
  if (!profile?.organization_id) return;
  const ended = new Date();
  const started = new Date(ended.getTime() - seconds * 1000);
  await supabase.from("time_entries" as any).insert({
    organization_id: profile.organization_id,
    task_id: taskId,
    user_id: userRes.user.id,
    duration_seconds: seconds,
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
  });
}
