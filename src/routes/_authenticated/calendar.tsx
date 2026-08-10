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
import { Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, MapPin, Video, Users as UsersIcon, Lock, Trash2, Palmtree } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { useCalendarBlocks, BLOCK_META, type CalendarBlock } from "@/lib/calendar-blocks";
import { EVENT_KIND_LIST, eventKindMeta } from "@/lib/event-kinds";

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
};

const KIND_META: Record<string, { label: string; color: string; dot: string; icon: any }> = Object.fromEntries(
  EVENT_KIND_LIST.map(([k, m]) => [k, { label: m.label, color: `${m.soft} border`, dot: m.dot, icon: m.icon }]),
);

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
  const [blockOpen, setBlockOpen] = useState(false);

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

  const { data: blocks = [] } = useCalendarBlocks();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null)); }, []);

  // Bloqueios do usuário atual indexados por dia (para pintar o calendário)
  const myBlocksByDay = useMemo(() => {
    const m = new Map<string, CalendarBlock>();
    for (const b of blocks) {
      if (currentUserId && b.user_id !== currentUserId) continue;
      const start = new Date(`${b.start_date}T12:00:00`);
      const end = new Date(`${b.end_date}T12:00:00`);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        m.set(ymd(d), b);
      }
    }
    return m;
  }, [blocks, currentUserId]);

  /* Janelas de etapa das tarefas (prazo relativo à entrega) viram eventos virtuais. */
  const { data: stageEvents = [] } = useQuery<Ev[]>({
    queryKey: ["calendar-stage-windows", toISO(from), toISO(to)],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select("id,title,stage_started_on,stage_due_on,current_stage_id")
        .not("stage_due_on", "is", null)
        .gte("stage_due_on", ymd(from))
        .lte("stage_due_on", ymd(to));
      if (error) throw error;
      return ((data ?? []) as any[]).map(t => ({
        id: `stage-${t.id}`,
        title: `Etapa: ${t.title}`,
        description: t.stage_started_on ? `Começa em ${t.stage_started_on}` : null,
        starts_at: `${t.stage_due_on}T09:00:00`,
        ends_at: null,
        kind: "task",
      })) as Ev[];
    },
  });

  const byDay = useMemo(() => {
    const acc: Record<string, Ev[]> = {};
    for (const e of [...events, ...stageEvents]) {
      const k = e.starts_at.slice(0, 10);
      (acc[k] ??= []).push(e);
    }
    return acc;
  }, [events, stageEvents]);

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
      const composedDescription = input.location
        ? `${input.description ? input.description + "\n\n" : ""}📍 ${input.location}`
        : input.description;
      const { error } = await supabase.from("calendar_events").insert({
        organization_id: profile.organization_id,
        owner_id: user.user?.id,
        title: input.title,
        description: composedDescription || null,
        starts_at: input.starts_at,
        ends_at: input.ends_at,
        kind: input.kind,
      });
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
          <Button variant="outline" onClick={() => setBlockOpen(true)}><Lock className="size-4 mr-1" />Bloquear datas</Button>
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
              const block = myBlocksByDay.get(k);
              return (
                <button
                  key={k}
                  onClick={() => setSelectedDate(k)}
                  onDoubleClick={() => openNew(k)}
                  className={cn(
                    "group relative border rounded-xl p-2 text-left flex flex-col hover:bg-muted/50 transition overflow-hidden",
                    view === "month" ? "h-24" : "h-40",
                    !inRange && "opacity-40",
                    selectedDate === k && "border-primary ring-1 ring-primary",
                    isToday && "bg-primary/5",
                    block && "bg-muted/70 border-dashed",
                  )}
                  title={block ? `${BLOCK_META[block.kind].label}${block.reason ? " · " + block.reason : ""}` : undefined}
                >
                  {block && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-25"
                      style={{ backgroundImage: "repeating-linear-gradient(45deg, currentColor 0 1px, transparent 1px 8px)" }}
                    />
                  )}
                  <div className="flex items-center justify-between relative">
                    <span className={cn("text-xs font-medium", isToday && "text-primary")}>{d.getDate()}</span>
                    {block ? (
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium border", BLOCK_META[block.kind].color)}>
                        {block.kind === "ferias" ? <Palmtree className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                        {BLOCK_META[block.kind].label}
                      </span>
                    ) : (
                      <span
                        role="button"
                        onClick={(e) => { e.stopPropagation(); openNew(k); }}
                        className="opacity-0 group-hover:opacity-100 transition grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"
                        title="Novo compromisso"
                      >
                        <Plus className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 space-y-0.5 mt-1 overflow-hidden relative">
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
                {e.description && <p className="text-xs mt-1 whitespace-pre-line">{e.description}</p>}
              </div>
            ))}
          </div>

          <div className="mt-5 pt-4 border-t">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Meus bloqueios
              </h4>
              <Button size="sm" variant="ghost" onClick={() => setBlockOpen(true)}><Plus className="h-4 w-4" /></Button>
            </div>
            {blocks.filter(b => b.user_id === currentUserId).length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum bloqueio. Marque férias, folgas ou dias trancados para que ninguém te atribua tarefas nessas datas.</p>
            )}
            <div className="space-y-1.5">
              {blocks.filter(b => b.user_id === currentUserId).map(b => (
                <div key={b.id} className={cn("rounded-lg border px-2.5 py-1.5 flex items-center gap-2 text-xs", BLOCK_META[b.kind].color)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", BLOCK_META[b.kind].dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      {BLOCK_META[b.kind].label} · {new Date(`${b.start_date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      {b.start_date !== b.end_date && ` – ${new Date(`${b.end_date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`}
                    </div>
                    {b.reason && <div className="text-[10px] opacity-80 truncate">{b.reason}</div>}
                  </div>
                  <button
                    onClick={async () => {
                      const { error } = await supabase.from("calendar_blocks" as any).delete().eq("id", b.id);
                      if (error) return toast.error(error.message);
                      qc.invalidateQueries({ queryKey: ["calendar-blocks"] });
                      toast.success("Bloqueio removido");
                    }}
                    className="opacity-60 hover:opacity-100"
                  ><Trash2 className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <NewEventDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        defaultDate={dialogDate}
        onCreate={(v) => create.mutate(v)}
      />

      <NewBlockDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        defaultDate={selectedDate}
        onCreated={() => qc.invalidateQueries({ queryKey: ["calendar-blocks"] })}
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
          <DialogField label="Tipo de compromisso" hint="Define a cor e onde ele aparece no dashboard.">
            <div className="grid grid-cols-2 gap-2">
              {EVENT_KIND_LIST.map(([k, m]) => {
                const Icon = m.icon;
                const active = kind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold transition",
                      active ? m.solid + " shadow-sm" : m.soft + " hover:brightness-105",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          </DialogField>
          <div className="rounded-lg border p-3 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Prévia</div>
            <Badge className={cn("border", eventKindMeta(kind).solid)}>{eventKindMeta(kind).label}</Badge>
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

function NewBlockDialog({ open, onOpenChange, defaultDate, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultDate: string;
  onCreated: () => void;
}) {
  const [kind, setKind] = useState<CalendarBlock["kind"]>("ferias");
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setStartDate(defaultDate); setEndDate(defaultDate); setReason(""); setKind("ferias"); }
  }, [open, defaultDate]);

  const submit = async () => {
    if (endDate < startDate) { toast.error("Data final deve ser maior ou igual à inicial"); return; }
    setSaving(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      const { data: userRes } = await supabase.auth.getUser();
      if (!profile?.organization_id || !userRes.user) throw new Error("Sessão inválida");
      const { error } = await supabase.from("calendar_blocks" as any).insert({
        organization_id: profile.organization_id,
        user_id: userRes.user.id,
        kind, start_date: startDate, end_date: endDate,
        reason: reason || null, all_day: true,
      });
      if (error) throw error;
      toast.success("Agenda trancada nessas datas");
      onCreated();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <EntityDialog
      open={open} onOpenChange={onOpenChange}
      icon={Lock} tone="amber"
      eyebrow="Agenda"
      title="Bloquear datas na agenda"
      subtitle="Ninguém poderá te atribuir tarefas, projetos ou reuniões nesse período."
      main={
        <>
          <DialogField label="Tipo">
            <Select value={kind} onValueChange={(v) => setKind(v as CalendarBlock["kind"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(BLOCK_META) as CalendarBlock["kind"][]).map(k => (
                  <SelectItem key={k} value={k}>{BLOCK_META[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DialogField>
          <div className="grid grid-cols-2 gap-3">
            <DialogField label="De"><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></DialogField>
            <DialogField label="Até"><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></DialogField>
          </div>
          <DialogField label="Motivo (opcional)">
            <Textarea rows={3} placeholder="Ex.: viagem em família, curso, etc." value={reason} onChange={e => setReason(e.target.value)} />
          </DialogField>
          <div className={cn("rounded-lg border p-3 text-xs flex items-center gap-2", BLOCK_META[kind].color)}>
            <Lock className="h-3.5 w-3.5" />
            Durante esse período seu nome aparecerá como <b>indisponível</b> no seletor de responsável e nos convites de reunião.
          </div>
        </>
      }
      footer={
        <>
          <DialogCancelButton onClick={() => onOpenChange(false)} />
          <Button className="rounded-full" onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : "Bloquear datas"}
          </Button>
        </>
      }
    />
  );
}
