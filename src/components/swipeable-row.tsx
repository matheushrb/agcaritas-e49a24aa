import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SwipeAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning" | "destructive" | "muted";
  onClick: () => void;
};

/**
 * SwipeableRow — arraste para o lado para revelar ações.
 * Drag para a esquerda → ações à direita (primárias).
 * Drag para a direita → ações à esquerda (secundárias).
 */
export function SwipeableRow({
  children,
  leftActions = [],
  rightActions = [],
  className,
  onClick,
}: {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  className?: string;
  onClick?: () => void;
}) {
  const x = useMotionValue(0);
  const pointerRef = useRef<{ id: number; startX: number; startY: number; startValue: number; dragging: boolean } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const actionWidth = 74;
  const rightWidth = rightActions.length * actionWidth;
  const leftWidth = leftActions.length * actionWidth;

  const rightOpacity = useTransform(x, [0, -20, -rightWidth], [0, 0.4, 1]);
  const leftOpacity = useTransform(x, [0, 20, leftWidth], [0, 0.4, 1]);

  const snap = (to: number) => animate(x, to, { type: "spring", stiffness: 520, damping: 42 });

  const clamp = (value: number) => Math.max(-rightWidth, Math.min(leftWidth, value));

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startValue: x.get(),
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;

    if (!pointer.dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      pointer.dragging = true;
      setIsDragging(true);
    }

    if (!pointer.dragging) return;
    event.preventDefault();
    x.set(clamp(pointer.startValue + dx));
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.startX;
    const velocityOpen = Math.abs(dx) > 80;
    const value = x.get();

    if (value < -rightWidth * 0.28 || (velocityOpen && dx < 0)) snap(-rightWidth);
    else if (value > leftWidth * 0.28 || (velocityOpen && dx > 0)) snap(leftWidth);
    else snap(0);

    pointerRef.current = null;
    window.setTimeout(() => setIsDragging(false), 80);
  };

  return (
    <div className={cn("relative overflow-hidden rounded-2xl group", className)}>
      {/* Right actions layer */}
      {rightActions.length > 0 && (
        <motion.div
          style={{ opacity: rightOpacity }}
          className="absolute inset-y-0 right-0 flex items-stretch"
        >
          {rightActions.map(a => (
            <ActionButton key={a.id} action={a} width={actionWidth} onDone={() => snap(0)} />
          ))}
        </motion.div>
      )}
      {leftActions.length > 0 && (
        <motion.div
          style={{ opacity: leftOpacity }}
          className="absolute inset-y-0 left-0 flex items-stretch"
        >
          {leftActions.map(a => (
            <ActionButton key={a.id} action={a} width={actionWidth} onDone={() => snap(0)} />
          ))}
        </motion.div>
      )}

      <motion.div
        style={{ x }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClick={(e) => {
          if (isDragging || Math.abs(x.get()) >= 4) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (onClick) {
            e.preventDefault();
            onClick();
          }
        }}
        className="relative bg-card cursor-grab active:cursor-grabbing select-none touch-pan-y will-change-transform"
      >
        {children}
        {rightActions.length > 0 && (
          <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center opacity-0 transition-opacity group-hover:opacity-60">
            <span className="text-[10px] text-muted-foreground">arraste ←</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function ActionButton({ action, width, onDone }: { action: SwipeAction; width: number; onDone: () => void }) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary text-primary-foreground",
    success: "bg-success text-success-foreground",
    warning: "bg-warning text-warning-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    muted: "bg-muted text-muted-foreground",
  };
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); action.onClick(); onDone(); }}
      style={{ width }}
      className={cn(
        "flex flex-col items-center justify-center gap-1 text-[10px] font-medium",
        toneMap[action.tone ?? "primary"],
      )}
    >
      <Icon className="h-4 w-4" />
      {action.label}
    </button>
  );
}
