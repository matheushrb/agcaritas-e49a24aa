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
    emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    amber:   "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    red:     "bg-red-500/12 text-red-600 dark:text-red-400",
    blue:    "bg-blue-500/12 text-blue-600 dark:text-blue-400",
    purple:  "bg-purple-500/12 text-purple-600 dark:text-purple-400",
    slate:   "bg-slate-500/12 text-slate-600 dark:text-slate-300",
    pink:    "bg-pink-500/12 text-pink-600 dark:text-pink-400",
  };
  const width = size === "lg" ? "sm:max-w-[960px]" : "sm:max-w-[720px]";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 rounded-3xl overflow-hidden flex flex-col",
          "w-[calc(100vw-2rem)] max-h-[85vh]",
          width,
        )}
      >
        {/* Header — superfície neutra, cor apenas no ícone (padrão Caritas) */}
        <div className="relative px-6 pt-5 pb-4 bg-background border-b border-border">
          <div className="flex items-start gap-3">
            <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", toneMap[tone])}>
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              {eyebrow && <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">{eyebrow}</div>}
              <DialogTitle className="text-[17px] font-semibold text-foreground leading-tight">{title}</DialogTitle>
              {subtitle && <p className="text-[12.5px] text-muted-foreground mt-0.5">{subtitle}</p>}
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

/** Estilos padrão de abas dentro dos diálogos (mesma linguagem do resto do sistema). */
export const dialogTabsListClass = "cv-dtabs";
export const dialogTabClass = "cv-dtab";

