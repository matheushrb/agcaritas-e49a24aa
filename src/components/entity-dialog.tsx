import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * EntityDialog — shared visual shell for "new record" modals across the app.
 *
 * Layout: rounded 2xl, colored header strip (module icon + title),
 * split body: main column (title/description/etc) + right sidebar (properties).
 * Footer sticky bottom.
 *
 * Keeps modals visually consistent with the ClickUp-style task modal,
 * while staying compact enough for creation forms.
 */
export function EntityDialog({
  open, onOpenChange,
  icon: Icon, tone = "slate", eyebrow, title, subtitle,
  main, sidebar, footer,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  icon: LucideIcon;
  tone?: "emerald" | "amber" | "red" | "blue" | "purple" | "slate" | "pink";
  eyebrow?: string;
  title: string;
  subtitle?: string;
  main: ReactNode;
  sidebar?: ReactNode;
  footer: ReactNode;
  size?: "md" | "lg";
}) {
  const toneMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-b border-emerald-500/20",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-b border-amber-500/20",
    red:     "bg-red-500/10 text-red-600 dark:text-red-400 border-b border-red-500/20",
    blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-b border-blue-500/20",
    purple:  "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-b border-purple-500/20",
    slate:   "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-b border-slate-500/20",
    pink:    "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-b border-pink-500/20",
  };
  const width = size === "lg" ? "max-w-[960px]" : "max-w-[760px]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 rounded-3xl overflow-hidden flex flex-col",
          "w-[calc(100vw-2rem)] sm:max-w-[760px] max-h-[85vh]",
          width,
        )}
      >
        {/* Header */}
        <div className={cn("relative px-6 pt-6 pb-5 bg-gradient-to-b", toneMap[tone])}>
          <div className="flex items-start gap-3">
            <div className={cn("size-10 rounded-xl bg-background/80 backdrop-blur flex items-center justify-center shadow-sm")}>
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              {eyebrow && <div className="text-[11px] uppercase tracking-wider font-medium opacity-70">{eyebrow}</div>}
              <DialogTitle className="text-lg font-semibold text-foreground leading-tight">{title}</DialogTitle>
              {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className={cn("flex-1 min-h-0 overflow-auto grid", sidebar ? "grid-cols-1 lg:grid-cols-[1fr_260px]" : "grid-cols-1")}>
          <div className="p-6 space-y-4">{main}</div>
          {sidebar && (
            <aside className="border-t lg:border-t-0 lg:border-l bg-muted/30 p-6 space-y-4">
              <div className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Propriedades</div>
              {sidebar}
            </aside>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex items-center justify-end gap-2 bg-background">
          {footer}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DialogField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DialogCancelButton({ onClick }: { onClick: () => void }) {
  return <Button variant="ghost" className="rounded-full" onClick={onClick}>Cancelar</Button>;
}
