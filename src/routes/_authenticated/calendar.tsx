import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: CalendarPage,
});

type EventKind = "meeting" | "delivery" | "internal" | "holiday" | "task";
type Ev = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  kind: EventKind | string;
};

const KIND_META: Record<string, { label: string; color: string }> = {
  meeting:  { label: "Reunião",   color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  delivery: { label: "Entrega",   color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  internal: { label: "Interno",   color: "bg-purple-500/15 text-purple-600 dark:text-purple-400" },
  holiday:  { label: "Feriado",   color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  task:     { label: "Tarefa",    color: "bg-slate-500/15 text-slate-600 dark:text-slate-400" },
};

function toISO(d: Date) { return d.toISOString(); }
function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function gridStart(d: Date) { const s = startOfMonth(d); s.setDate(s.getDate() - s.getDay()); return s; }
function gridEnd(d: Date) { const e = endOfMonth(d); e.setDate(e.getDate() + (6 - e.getDay())); return e; }

function CalendarPage() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(new Date());
  const [newOpen, setNewOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(ymd(new Date()));

  const from = gridStart(cursor);
  const to = gridEnd(cursor);

  const { data: events = [] } = useQuery<Ev[]>({
    queryKey: ["calendar", cursor.getFullYear(), cursor.getMonth()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("id,title,description,starts_at,ends_at,kind")
        .gte("starts_at", toISO(from))
        .lte("starts_at", toISO(to))
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as Ev[];
    },
  });

  const byDay = useMemo(() => {
    const acc: Record<string, Ev[]> = {};
    for (const e of events) {
      const k = e.starts_at.slice(0, 10);
      (acc[k] ??= []).push(e);
    }
    return acc;
  }, [events]);

  const days: Date[] = [];
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) days.push(new Date(d));

  const create = useMutation({
    mutationFn: async (input: { title: string; description: string; starts_at: string; ends_at: string | null; kind: EventKind }) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("calendar_events").insert({
        organization_id: profile.organization_id,
        owner_id: user.user?.id,
        title: input.title,
        description: input.description || null,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        kind: input.kind,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["calendar"] }); toast.success("Evento criado"); setNewOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const dayEvents = byDay[selectedDate] ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><CalendarIcon className="size-6" />Agenda</h1>
          <p className="text-sm text-muted-foreground">Reuniões, entregas e compromissos da equipe.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="size-4 mr-1" />Novo evento</Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft className="size-4" /></Button>
        <div className="font-medium capitalize min-w-[180px] text-center">{monthLabel}</div>
        <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight className="size-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => { setCursor(new Date()); setSelectedDate(ymd(new Date())); }}>Hoje</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <Card className="p-3">
          <div className="grid grid-cols-7 text-xs text-muted-foreground mb-2">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => <div key={d} className="p-1 text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map(d => {
              const k = ymd(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const evs = byDay[k] ?? [];
              return (
                <button
                  key={k}
                  onClick={() => setSelectedDate(k)}
                  className={cn(
                    "h-24 border rounded p-1 text-left flex flex-col hover:bg-muted/50 transition",
                    !inMonth && "opacity-40",
                    selectedDate === k && "border-primary ring-1 ring-primary",
                  )}
                >
                  <span className="text-xs font-medium">{d.getDate()}</span>
                  <div className="flex-1 space-y-0.5 mt-1 overflow-hidden">
                    {evs.slice(0, 3).map(e => (
                      <div key={e.id} className={cn("text-[10px] truncate rounded px-1", KIND_META[e.kind]?.color ?? "bg-muted")}>
                        {e.title}
                      </div>
                    ))}
                    {evs.length > 3 && <div className="text-[10px] text-muted-foreground">+{evs.length - 3}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-medium mb-3">{new Date(selectedDate).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</h3>
          {dayEvents.length === 0 && <p className="text-sm text-muted-foreground">Nenhum evento neste dia.</p>}
          <div className="space-y-2">
            {dayEvents.map(e => (
              <div key={e.id} className="border rounded p-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{e.title}</span>
                  <Badge className={KIND_META[e.kind]?.color ?? ""}>{KIND_META[e.kind]?.label ?? e.kind}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(e.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  {e.ends_at && ` – ${new Date(e.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                </div>
                {e.description && <p className="text-xs mt-1">{e.description}</p>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <NewEventDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultDate={selectedDate}
        onCreate={(v) => create.mutate(v)}
      />
    </div>
  );
}

function NewEventDialog({ open, onOpenChange, defaultDate, onCreate }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate: string;
  onCreate: (v: { title: string; description: string; starts_at: string; ends_at: string | null; kind: EventKind }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [kind, setKind] = useState<EventKind>("meeting");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo evento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
          <Select value={kind} onValueChange={(v) => setKind(v as EventKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(KIND_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea placeholder="Descrição (opcional)" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onCreate({
            title, description,
            starts_at: new Date(`${date}T${startTime}:00`).toISOString(),
            ends_at: endTime ? new Date(`${date}T${endTime}:00`).toISOString() : null,
            kind,
          })} disabled={!title}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
