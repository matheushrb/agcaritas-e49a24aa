import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useRef, type ReactNode } from "react";
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
  const ref = useRef<HTMLDivElement>(null);

  const rightWidth = rightActions.length * 68;
  const leftWidth = leftActions.length * 68;

  const rightOpacity = useTransform(x, [0, -20, -rightWidth], [0, 0.4, 1]);
  const leftOpacity = useTransform(x, [0, 20, leftWidth], [0, 0.4, 1]);

  const snap = (to: number) => animate(x, to, { type: "spring", stiffness: 500, damping: 40 });

  return (
    <div className={cn("relative overflow-hidden rounded-2xl", className)}>
      {/* Right actions layer */}
      {rightActions.length > 0 && (
        <motion.div
          style={{ opacity: rightOpacity }}
          className="absolute inset-y-0 right-0 flex items-stretch"
        >
          {rightActions.map(a => (
            <ActionButton key={a.id} action={a} onDone={() => snap(0)} />
          ))}
        </motion.div>
      )}
      {leftActions.length > 0 && (
        <motion.div
          style={{ opacity: leftOpacity }}
          className="absolute inset-y-0 left-0 flex items-stretch"
        >
          {leftActions.map(a => (
            <ActionButton key={a.id} action={a} onDone={() => snap(0)} />
          ))}
        </motion.div>
      )}

      <motion.div
        ref={ref}
        drag="x"
        dragConstraints={{ left: -rightWidth, right: leftWidth }}
        dragElastic={0.08}
        style={{ x }}
        onDragEnd={(_, info) => {
          const v = x.get();
          if (v < -rightWidth / 2 || info.velocity.x < -400) snap(-rightWidth);
          else if (v > leftWidth / 2 || info.velocity.x > 400) snap(leftWidth);
          else snap(0);
        }}
        onClick={(e) => {
          if (Math.abs(x.get()) < 4 && onClick) {
            e.preventDefault();
            onClick();
          }
        }}
        className="relative bg-card cursor-grab active:cursor-grabbing"
      >
        {children}
      </motion.div>
    </div>
  );
}

function ActionButton({ action, onDone }: { action: SwipeAction; onDone: () => void }) {
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
      className={cn(
        "w-[68px] flex flex-col items-center justify-center gap-1 text-[10px] font-medium",
        toneMap[action.tone ?? "primary"],
      )}
    >
      <Icon className="h-4 w-4" />
      {action.label}
    </button>
  );
}
