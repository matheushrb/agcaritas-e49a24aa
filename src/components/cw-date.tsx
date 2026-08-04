import * as React from "react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const toDate = (v?: string | null) =>
  v ? parse(v, "yyyy-MM-dd", new Date()) : undefined;
const toStr = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : "");

const popoverCls =
  "w-auto p-0 pointer-events-auto z-[9999] rounded-[14px] border border-border bg-popover shadow-lg";

/** Campo de data única com calendário estilizado. */
export function CwDate({
  value, onChange, placeholder = "Selecionar", className, min, max, compact,
}: {
  value?: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  min?: string | null;
  max?: string | null;
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const d = toDate(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("cw-datebtn", compact && "is-compact", className)}>
          {!compact && <CalendarDays size={14} className="cw-datebtn-ico" />}
          <span className={cn(!d && "cw-datebtn-ph")}>
            {d ? format(d, "dd MMM yyyy", { locale: ptBR }) : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={popoverCls}>
        <Calendar
          mode="single"
          locale={ptBR}
          selected={d}
          defaultMonth={d}
          disabled={[
            ...(min ? [{ before: toDate(min)! }] : []),
            ...(max ? [{ after: toDate(max)! }] : []),
          ]}
          onSelect={(dd) => { onChange(toStr(dd)); setOpen(false); }}
          className="p-3 pointer-events-auto"
        />
        {value && (
          <div className="flex justify-end border-t border-border p-2">
            <button type="button" className="cw-datebtn-clear"
              onClick={() => { onChange(""); setOpen(false); }}>
              <X size={12} /> Limpar
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Campo único de período (início → prazo). */
export function CwDateRange({
  start, end, onChange, className,
}: {
  start?: string | null;
  end?: string | null;
  onChange: (start: string, end: string) => void;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const from = toDate(start);
  const to = toDate(end);
  const label = from && to
    ? `${format(from, "dd MMM", { locale: ptBR })} → ${format(to, "dd MMM yyyy", { locale: ptBR })}`
    : from
      ? `${format(from, "dd MMM yyyy", { locale: ptBR })} → …`
      : to
        ? `… → ${format(to, "dd MMM yyyy", { locale: ptBR })}`
        : "Definir período";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("cw-datebtn", className)}>
          <CalendarDays size={14} className="cw-datebtn-ico" />
          <span className={cn(!from && !to && "cw-datebtn-ph")}>{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={popoverCls}>
        <Calendar
          mode="range"
          numberOfMonths={2}
          locale={ptBR}
          defaultMonth={from ?? to}
          selected={{ from, to }}
          onSelect={(r) => onChange(toStr(r?.from), toStr(r?.to))}
          className="p-3 pointer-events-auto"
        />
        <div className="flex items-center justify-between border-t border-border p-2">
          <button type="button" className="cw-datebtn-clear" onClick={() => onChange("", "")}>
            <X size={12} /> Limpar
          </button>
          <button type="button" className="cw-datebtn-ok" onClick={() => setOpen(false)}>Pronto</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
