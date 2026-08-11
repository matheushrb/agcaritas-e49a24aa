import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { LucideIcon } from "lucide-react";
import "@/strategy-win.css";

export function ToolWindow({
  open, onClose, icon: Icon, title, subtitle, headerRight, footer, children, size = "wide",
}: {
  open: boolean;
  onClose: () => void;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  size?: "wide" | "full";
}) {
  const width = size === "full" ? "w-[97vw] max-w-[1480px]" : "w-[94vw] max-w-[1120px]";
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className={`${width} h-[92vh] p-0 gap-0 overflow-hidden flex flex-col`}>
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{subtitle ?? title}</DialogDescription>
        <div className="swin">
          <header className="swin-head">
            <span className="swin-ico"><Icon /></span>
            <div className="min-w-0">
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <div className="swin-head-right">{headerRight}</div>
          </header>
          {children}
          {footer && <div className="swin-foot">{footer}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WinField({
  label, hint, span, children,
}: { label: string; hint?: string; span?: boolean; children: ReactNode }) {
  return (
    <div className={`swin-f${span ? " span2" : ""}`}>
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
