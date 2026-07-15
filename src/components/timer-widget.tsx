import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Timer as TimerIcon, Play, Pause, Square } from "lucide-react";
import { useTimer, formatHMS } from "@/contexts/timer-context";
import { Button } from "@/components/ui/button";

export function TimerWidget() {
  const t = useTimer();
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!t.running) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [t.running]);
  // trigger re-render on tick
  void tick;

  if (!t.taskId) return null;
  const label = t.taskTitle.length > 22 ? t.taskTitle.slice(0, 22) + "…" : t.taskTitle;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl border border-border bg-background shadow-[var(--shadow-elevated)] px-3 py-2">
      <TimerIcon className="h-4 w-4 text-primary" />
      <button
        onClick={() => navigate({ to: "/tasks" })}
        className="text-sm font-medium hover:underline"
        title="Ver tarefa"
      >
        {label}
      </button>
      <span className="font-mono text-sm tabular-nums text-muted-foreground min-w-[68px] text-right">
        {formatHMS(t.currentSeconds())}
      </span>
      {t.running ? (
        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={t.pauseTimer} title="Pausar">
          <Pause className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" onClick={t.resumeTimer} title="Continuar">
          <Play className="h-3.5 w-3.5" />
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 rounded-full text-red-500 hover:text-red-600"
        onClick={() => t.stopTimer()}
        title="Parar e salvar"
      >
        <Square className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
