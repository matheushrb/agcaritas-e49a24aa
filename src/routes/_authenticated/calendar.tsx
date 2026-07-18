import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EntityDialog, DialogField, DialogCancelButton } from "@/components/entity-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, MapPin, Video, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { z } from "zod";

const searchSchema = z.object({
  d: z.string().optional(),
  new: z.union([z.literal(1), z.literal("1"), z.boolean()]).optional(),
  view: z.enum(["month", "week"]).optional(),
});

export const Route = createFileRoute("/_authenticated/calendar")({
  validateSearch: (s) => searchSchema.parse(s),
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
  location?: string | null;
};

const KIND_META: Record<string, { label: string; color: string; dot: string }> = {
  meeting:  { label: "Reunião",   color: "bg-blue-500/15 text-blue-600 dark:text-blue-400",       dot: "bg-blue-500" },
  delivery: { label: "Entrega",   color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
  internal: { label: "Interno",   color: "bg-purple-500/15 text-purple-600 dark:text-purple-400", dot: "bg-purple-500" },
  holiday:  { label: "Feriado",   color: "bg-amber-500/15 text-amber-600 dark:text-amber-400",    dot: "bg-amber-500" },
  task:     { label: "Tarefa",    color: "bg-slate-500/15 text-slate-600 dark:text-slate-400",    dot: "bg-slate-500" },
};

function toISO(d: Date) { return d.toISOString(); }
function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function gridStart(d: Date) { const s = startOfMonth(d); s.setDate(s.getDate() - s.getDay()); return s; }
function gridEnd(d: Date) { const e = endOfMonth(d); e.setDate(e.getDate() + (6 - e.getDay())); return e; }
function startOfWeek(d: Date) { const s = new Date(d); s.setDate(d.getDate() - d.getDay()); s.setHours(0,0,0,0); return s; }
function endOfWeek(d: Date) { const e = startOfWeek(d); e.setDate(e.getDate() + 6); e.setHours(23,59,59,999); return e; }

function CalendarPage() {
  const qc = useQueryClient();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [cursor, setCursor] = useState(search.d ? new Date(`${search.d}T12:00:00`) : new Date());
  const [selectedDate, setSelectedDate] = useState<string>(search.d ?? ymd(new Date()));
  const [view, setView] = useState<"month" | "week">(search.view ?? "month");
  const [newOpen, setNewOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState<string>(selectedDate);

  // Abre dialog automaticamente se ?new=1
  useEffect(() => {
    if (search.new) {
      setDialogDate(search.d ?? ymd(new Date()));
      setNewOpen(true);
      navigate({ search: (prev: z.infer<typeof searchSchema>) => ({ ...prev, new: undefined }), replace: true });
    }
  }, [search.new, search.d, navigate]);

  const from = view === "month" ? gridStart(cursor) : startOfWeek(cursor);
  const to   = view === "month" ? gridEnd(cursor)   : endOfWeek(cursor);

  const { data: events = [] } = useQuery<Ev[]>({
    queryKey: ["calendar", view, from.toISOString(), to.toISOString()],
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
    mutationFn: async (input: {
      title: string; description: string; location: string;
      starts_at: string; ends_at: string | null; kind: EventKind;
    }) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("calendar_events").insert({
        organization_id: profile.organization_id,
        owner_id: user.user?.id,
        title: input.title,
        description: input.description || null,
        location: input.location || null,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        kind: input.kind,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["calendar"] }); toast.success("Compromisso criado"); setNewOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rangeLabel = view === "month"
    ? cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : `${startOfWeek(cursor).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${endOfWeek(cursor).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  const dayEvents = byDay[selectedDate] ?? [];

  const shift = (n: number) => {
    if (view === "month") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
    else { const d = new Date(cursor); d.setDate(d.getDate() + n * 7); setCursor(d); }
  };

  const openNew = (dateISO: string) => {
    setDialogDate(dateISO);
    setSelectedDate(dateISO);
    setNewOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><CalendarIcon className="size-6" />Agenda</h1>
          <p className="text-sm text-muted-foreground">Reuniões, entregas e compromissos da equipe. Clique em qualquer dia para criar um novo.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-border bg-card p-1">
            <button
              onClick={() => setView("month")}
              className={cn("px-3 py-1 text-xs font-medium rounded-full", view === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >Mês</button>
            <button
              onClick={() => setView("week")}
              className={cn("px-3 py-1 text-xs font-medium rounded-full", view === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
            >Semana</button>
          </div>
          <Button onClick={() => openNew(selectedDate)}><Plus className="size-4 mr-1" />Novo compromisso</Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => shift(-1)}><ChevronLeft className="size-4" /></Button>
        <div className="font-medium capitalize min-w-[220px] text-center">{rangeLabel}</div>
        <Button variant="ghost" size="icon" onClick={() => shift(1)}><ChevronRight className="size-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => { setCursor(new Date()); setSelectedDate(ymd(new Date())); }}>Hoje</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <Card className="p-3">
          <div className={cn("grid text-xs text-muted-foreground mb-2", view === "month" ? "grid-cols-7" : "grid-cols-7")}>
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => <div key={d} className="p-1 text-center">{d}</div>)}
          </div>
          <div className={cn("grid gap-1", view === "month" ? "grid-cols-7" : "grid-cols-7")}>
            {days.map(d => {
              const k = ymd(d);
              const inRange = view === "week" ? true : d.getMonth() === cursor.getMonth();
              const evs = byDay[k] ?? [];
              const isToday = d.toDateString() === new Date().toDateString();
              return (
                <button
                  key={k}
                  onClick={() => setSelectedDate(k)}
                  onDoubleClick={() => openNew(k)}
                  className={cn(
                    "group relative border rounded-xl p-2 text-left flex flex-col hover:bg-muted/50 transition",
                    view === "month" ? "h-24" : "h-40",
                    !inRange && "opacity-40",
                    selectedDate === k && "border-primary ring-1 ring-primary",
                    isToday && "bg-primary/5",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("text-xs font-medium", isToday && "text-primary")}>{d.getDate()}</span>
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); openNew(k); }}
                      className="opacity-0 group-hover:opacity-100 transition grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"
                      title="Novo compromisso"
                    >
                      <Plus className="h-3 w-3" />
                    </span>
                  </div>
                  <div className="flex-1 space-y-0.5 mt-1 overflow-hidden">
                    {evs.slice(0, view === "month" ? 3 : 6).map(e => (
                      <div key={e.id} className={cn("text-[10px] truncate rounded px-1 flex items-center gap-1", KIND_META[e.kind]?.color ?? "bg-muted")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", KIND_META[e.kind]?.dot ?? "bg-slate-500")} />
                        <span className="truncate">{new Date(e.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} {e.title}</span>
                      </div>
                    ))}
                    {evs.length > (view === "month" ? 3 : 6) && (
                      <div className="text-[10px] text-muted-foreground">+{evs.length - (view === "month" ? 3 : 6)}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium capitalize">{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</h3>
            <Button size="sm" variant="ghost" onClick={() => openNew(selectedDate)}><Plus className="h-4 w-4" /></Button>
          </div>
          {dayEvents.length === 0 && <p className="text-sm text-muted-foreground">Nenhum compromisso. Clique em <b>+</b> para adicionar.</p>}
          <div className="space-y-2">
            {dayEvents.map(e => (
              <div key={e.id} className="border rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{e.title}</span>
                  <Badge className={KIND_META[e.kind]?.color ?? ""}>{KIND_META[e.kind]?.label ?? e.kind}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {new Date(e.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  {e.ends_at && ` – ${new Date(e.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                </div>
                {e.location && (
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {e.location}
                  </div>
                )}
                {e.description && <p className="text-xs mt-1">{e.description}</p>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <NewEventDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultDate={dialogDate}
        onCreate={(v) => create.mutate(v)}
      />
    </div>
  );
}

function NewEventDialog({ open, onOpenChange, defaultDate, onCreate }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate: string;
  onCreate: (v: { title: string; description: string; location: string; starts_at: string; ends_at: string | null; kind: EventKind }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [kind, setKind] = useState<EventKind>("meeting");
  const [allDay, setAllDay] = useState(false);
  const [guests, setGuests] = useState("");

  useEffect(() => { if (open) { setDate(defaultDate); setTitle(""); setDescription(""); setLocation(""); setGuests(""); } }, [open, defaultDate]);

  const kindColor = KIND_META[kind]?.color ?? "bg-muted";
  const durationMin = (() => {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    return Math.max(0, eh * 60 + em - (sh * 60 + sm));
  })();

  return (
    <EntityDialog
      open={open} onOpenChange={onOpenChange}
      icon={CalendarIcon} tone="blue"
      eyebrow="Agenda"
      title="Novo compromisso"
      subtitle="Reuniões, entregas, feriados e blocos internos."
      main={
        <>
          <DialogField label="Título">
            <Input placeholder="Ex.: Kickoff cliente Bella Estética" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          </DialogField>
          <div className="grid grid-cols-4 gap-3">
            <DialogField label="Data"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></DialogField>
            <DialogField label="Início">
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} disabled={allDay} />
            </DialogField>
            <DialogField label="Término">
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} disabled={allDay} />
            </DialogField>
            <DialogField label="Dia inteiro">
              <label className="flex items-center gap-2 h-9">
                <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="rounded" />
                <span className="text-xs text-muted-foreground">Sem horário</span>
              </label>
            </DialogField>
          </div>
          <DialogField label="Local ou link">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Endereço, Google Meet, Zoom…" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
          </DialogField>
          <DialogField label="Convidados" hint="Separe por vírgula (integração de e-mail em breve).">
            <div className="relative">
              <UsersIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="nome@dominio.com, outro@dominio.com" value={guests} onChange={e => setGuests(e.target.value)} />
            </div>
          </DialogField>
          <DialogField label="Descrição">
            <Textarea rows={3} placeholder="Pauta, links de reunião, materiais…" value={description} onChange={e => setDescription(e.target.value)} />
          </DialogField>
        </>
      }
      sidebar={
        <>
          <DialogField label="Tipo">
            <Select value={kind} onValueChange={(v) => setKind(v as EventKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_META).map(([k, m]) => <SelectItem key={k} value={k}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </DialogField>
          <div className="rounded-lg border p-3 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Prévia</div>
            <Badge className={kindColor}>{KIND_META[kind]?.label}</Badge>
            <div className="text-xs text-muted-foreground">
              {new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
              <br />{allDay ? "Dia inteiro" : `${startTime} – ${endTime} · ${durationMin} min`}
            </div>
            {location && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                {location.startsWith("http") ? <Video className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                <span className="truncate">{location}</span>
              </div>
            )}
          </div>
        </>
      }
      footer={
        <>
          <DialogCancelButton onClick={() => onOpenChange(false)} />
          <Button className="rounded-full" onClick={() => onCreate({
            title, description, location,
            starts_at: allDay
              ? new Date(`${date}T00:00:00`).toISOString()
              : new Date(`${date}T${startTime}:00`).toISOString(),
            ends_at: allDay
              ? new Date(`${date}T23:59:59`).toISOString()
              : new Date(`${date}T${endTime}:00`).toISOString(),
            kind,
          })} disabled={!title}>Criar compromisso</Button>
        </>
      }
    />
  );
}
