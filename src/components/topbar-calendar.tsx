import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TopbarCalendar() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(iso(today));

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);

  const { data: events = [] } = useQuery({
    queryKey: ["topbar-calendar", iso(monthStart)],
    queryFn: async () => {
      const { data } = await supabase
        .from("calendar_events")
        .select("id,title,starts_at,ends_at,kind,description")
        .gte("starts_at", monthStart.toISOString())
        .lt("starts_at", monthEnd.toISOString())
        .order("starts_at");
      return data ?? [];
    },
  });

  const byDay = useMemo(() => {
    const acc: Record<string, any[]> = {};
    for (const e of events as any[]) {
      const key = iso(new Date(e.starts_at));
      (acc[key] ||= []).push(e);
    }
    return acc;
  }, [events]);

  const cells = useMemo(() => {
    const offset = (monthStart.getDay() + 6) % 7;
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const prevDays = new Date(cursor.getFullYear(), cursor.getMonth(), 0).getDate();
    const list: { n: number; muted: boolean; key: string | null }[] = [];
    for (let i = offset - 1; i >= 0; i--) list.push({ n: prevDays - i, muted: true, key: null });
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({ n: d, muted: false, key: iso(new Date(cursor.getFullYear(), cursor.getMonth(), d)) });
    }
    let tail = 1;
    while (list.length % 7 !== 0) list.push({ n: tail++, muted: true, key: null });
    return list;
  }, [cursor, monthStart]);

  const dayEvents = byDay[selected] ?? [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="cv-icon-button" title="Calendário">
          <Calendar className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-3">
        <div className="cv-rail-head" style={{ marginBottom: 10 }}>
          <h2 style={{ textTransform: "capitalize", fontSize: 13, fontWeight: 600, margin: 0 }}>
            {`${new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(cursor)} ${cursor.getFullYear()}`}
          </h2>
          <div>
            <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="cv-week">
          {["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"].map(d => <span key={d}>{d}</span>)}
        </div>
        <div className="cv-days">
          {cells.map((c, i) => {
            const isToday = c.key === iso(today);
            const isSelected = c.key === selected;
            const has = c.key ? (byDay[c.key]?.length ?? 0) > 0 : false;
            return (
              <span
                key={i}
                onClick={() => c.key && setSelected(c.key)}
                className={c.muted ? "muted" : isSelected ? "selected" : isToday ? "today" : ""}
                style={{
                  cursor: c.muted ? "default" : "pointer",
                  position: "relative",
                  fontWeight: isToday && !isSelected ? 700 : undefined,
                }}
              >
                {c.n}
                {has && (
                  <em style={{
                    position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)",
                    width: 4, height: 4, borderRadius: 999,
                    background: isSelected ? "#fff" : "var(--primary)",
                  }} />
                )}
              </span>
            );
          })}
        </div>

        <div style={{ marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 8, display: "grid", gap: 6 }}>
          {dayEvents.length === 0 && (
            <span style={{ fontSize: 12, color: "var(--muted)" }}>Sem compromissos neste dia.</span>
          )}
          {dayEvents.map((e: any) => (
            <div key={e.id} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <strong style={{ fontSize: 11, color: "var(--primary)", minWidth: 38 }}>
                {new Date(e.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </strong>
              <span style={{ fontSize: 12 }}>{e.title}</span>
            </div>
          ))}
          <Link to="/calendar" className="cv-link" style={{ fontSize: 12, marginTop: 2 }}>
            Abrir agenda <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
