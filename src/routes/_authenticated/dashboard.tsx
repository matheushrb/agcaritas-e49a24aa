import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Calendar, ClipboardList, Users, MoreHorizontal, ChevronLeft,
  ChevronRight, Paperclip, MessageCircle, Trash2, Pencil, Check,
  FolderKanban, Bell, Sparkles, TrendingUp, TrendingDown, Wallet,
  Activity, BarChart3, Target, FolderOpen, CheckCircle2, CalendarClock,
  CheckSquare,
} from "lucide-react";

type StatTone = "success" | "destructive" | "primary" | "accent" | "warning" | "info";

function StatCard({
  label, value, hint, icon: Icon, tone = "primary", delta,
}: {
  label: string; value: string; hint?: string; icon: any; tone?: StatTone;
  delta?: { value: string; direction: "up" | "down" | "flat" };
}) {
  const toneClasses: Record<StatTone, string> = {
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/20 text-accent-foreground",
    warning: "bg-warning/15 text-warning",
    info: "bg-info/15 text-info",
  };
  return (
    <Card className="card-surface p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          {label}
        </span>
        <span className={`grid h-8 w-8 place-items-center rounded-xl ${toneClasses[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-display text-2xl md:text-3xl font-bold leading-none">{value}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate">{hint}</span>
        {delta && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              delta.direction === "down"
                ? "bg-destructive/10 text-destructive"
                : "bg-success/10 text-success"
            }`}
          >
            {delta.direction === "down" ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <TrendingUp className="h-3 w-3" />
            )}
            {delta.value}
          </span>
        )}
      </div>
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase mb-3">
      {children}
    </p>
  );
}

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · Caritas Agência" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

const profileQuery = {
  queryKey: ["profile"],
  queryFn: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("full_name, display_name, role_title, organization_id")
      .eq("id", userRes.user.id)
      .maybeSingle();
    return { user: userRes.user, profile: data };
  },
};

const dashboardQuery = {
  queryKey: ["dashboard"],
  queryFn: async () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

    const [tasksRes, notifsRes, eventsRes, proposalsRes, projectsRes, allTasksRes] = await Promise.all([
      supabase.from("tasks").select("*").order("due_date", { ascending: true }).limit(6),
      supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(5),
      supabase.from("calendar_events").select("*").gte("starts_at", start).lt("starts_at", end).order("starts_at"),
      supabase.from("proposals").select("id, status, total_value"),
      supabase.from("projects").select("id, status"),
      supabase.from("tasks").select("id, status, due_date, updated_at"),
    ]);

    return {
      tasks: tasksRes.data ?? [],
      notifications: notifsRes.data ?? [],
      events: eventsRes.data ?? [],
      proposals: proposalsRes.data ?? [],
      projects: projectsRes.data ?? [],
      allTasks: allTasksRes.data ?? [],
    };
  },
};

function DashboardContent() {
  const { data: me } = useSuspenseQuery(profileQuery);
  const { data } = useSuspenseQuery(dashboardQuery);
  const profile = me?.profile as any;
  const displayName =
    profile?.display_name?.trim() ||
    profile?.full_name?.trim().split(" ")[0] ||
    me?.user?.user_metadata?.full_name?.split(" ")[0] ||
    me?.user?.email?.split("@")[0] ||
    "por aí";
  const firstName = displayName;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
      {/* Header greeting + 3 inline quick actions */}
      <section className="lg:col-span-8 space-y-5">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">
              Olá, {firstName}!<br />
              Quais são seus planos para hoje?
            </h1>
            <p className="mt-3 text-sm text-muted-foreground max-w-md">
              O ERP da Caritas Agência: organize leads, propostas, projetos e faturamento em um único painel.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <InlineActionButton title="Organizar" icon={FolderKanban} />
            <InlineActionButton title="Sincronizar" icon={TrendingUp} />
            <InlineActionButton title="Colaborar" icon={Users} />
          </div>
        </div>
      </section>







      {/* Right column: Calendar + agenda */}
      <section className="lg:col-span-4 lg:row-span-2">
        <MiniCalendar events={data.events} />
      </section>

      {/* Notifications */}
      <section className="lg:col-span-4">
        <Card className="card-surface p-5 h-full">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold">Notificações</h3>
            <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Trash2 className="h-3.5 w-3.5" /> Limpar
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {data.notifications.length === 0 && (
              <EmptyRow icon={Bell} label="Sem notificações no momento." />
            )}
            {data.notifications.map(n => (
              <div key={n.id} className="group flex items-start gap-3 rounded-2xl bg-muted/40 p-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  {n.body && <p className="text-xs text-muted-foreground truncate">{n.body}</p>}
                </div>
                <div className="flex opacity-0 group-hover:opacity-100 transition">
                  <button className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Assignments */}
      <section className="lg:col-span-4">
        <Card className="card-surface p-5 h-full">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold">Atribuições</h3>
            <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          </div>
          {(() => {
            const priority = data.tasks.find(t => t.priority === "high") ?? data.tasks[0];
            if (!priority) return <EmptyRow icon={ClipboardList} label="Nenhuma atribuição em destaque." />;
            return (
              <div className="mt-4 rounded-2xl bg-muted/40 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary font-medium uppercase">{priority.platform ?? "Geral"}</span>
                  <span>{priority.delivery_type ?? "Entrega"}</span>
                </div>
                <p className="font-display font-semibold">{priority.title}</p>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-success/20 px-2.5 py-0.5 text-xs font-medium text-success-foreground">
                    {priority.priority === "high" ? "Alta" : priority.priority === "medium" ? "Média" : "Baixa"}
                  </span>
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    RL
                  </div>
                </div>
              </div>
            );
          })()}
          <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary">
            <Plus className="h-4 w-4" /> Adicionar atribuição
          </button>
        </Card>
      </section>

      {/* Today tasks */}
      <section className="lg:col-span-8">
        <Card className="card-surface p-5 h-full">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <h3 className="font-display font-semibold">Tarefas de hoje</h3>
              <div className="flex -space-x-1">
                <Avatar initials="AB" />
                <Avatar initials="CD" />
                <Avatar initials="EF" />
                <div className="grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold border-2 border-card">+3</div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <button className="p-1.5 rounded-lg hover:bg-muted"><ClipboardList className="h-4 w-4" /></button>
              <button className="p-1.5 rounded-lg hover:bg-muted"><Pencil className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {data.tasks.length === 0 && <EmptyRow icon={ClipboardList} label="Nenhuma tarefa para hoje ainda." />}
            {data.tasks.map(t => (
              <div key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-muted/40 p-3 md:p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-medium truncate">{t.title}</p>
                    <span className="text-xs text-muted-foreground">Duração {t.estimated_hours ?? "—"}h</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={t.progress ?? 0} className="h-1.5 max-w-[220px]" />
                    <span className="text-xs text-muted-foreground">{t.progress ?? 0}%</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{t.comments_count ?? 0}</span>
                  <span className="flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" />{t.attachments_count ?? 0}</span>
                  <span className="hidden md:inline">{t.due_date ? new Date(t.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* KPIs */}
      <section className="lg:col-span-4">
        <div className="grid grid-cols-2 gap-3 h-full">
          <KpiRing label="PROPOSTAS" percent={proposalsRate(data.proposals)} note="taxa de conversão" tone="success" />
          <KpiRing label="FATURAMENTO" percent={65} note="da meta do mês" tone="destructive" />
        </div>
      </section>


      {/* Next meeting */}
      <section className="lg:col-span-8">
        <Card className="card-surface p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold">Próxima reunião</h3>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                {upcomingText(data.events)}
              </div>
            </div>
            <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-center">
            <div>
              <p className="text-sm">
                {data.events[0]?.description ?? "Nenhuma reunião agendada. Adicione um evento pela agenda."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-full">Remarcar</Button>
              <Button className="rounded-full gap-2"><Check className="h-4 w-4" /> Confirmar</Button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

function InlineActionButton({ title, icon: Icon }: { title: string; icon: any }) {
  return (
    <button
      type="button"
      className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-primary/50 hover:bg-primary/5"
    >
      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {title}
    </button>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <div className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold border-2 border-card">
      {initials}
    </div>
  );
}

function EmptyRow({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
      <Icon className="h-4 w-4" /> {label}
    </div>
  );
}

function MiniCalendar({ events }: { events: any[] }) {
  const now = new Date();
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const days = weekAround(now);
  return (
    <Card className="card-surface p-5 h-full">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold capitalize">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <button className="grid h-7 w-7 place-items-center rounded-full border border-border hover:bg-muted"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <button className="grid h-7 w-7 place-items-center rounded-full border border-border hover:bg-muted"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-7 gap-1 text-center">
        {days.map(d => (
          <div key={d.toISOString()} className="text-[10px] uppercase text-muted-foreground">
            {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "").slice(0, 3)}
          </div>
        ))}
        {days.map(d => {
          const isToday = d.toDateString() === now.toDateString();
          return (
            <div key={d.toISOString() + "n"} className="py-1">
              <div className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-medium ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 space-y-3">
        {events.length === 0 && <EmptyRow icon={Calendar} label="Nenhum compromisso hoje." />}
        {events.map(ev => (
          <div key={ev.id} className="rounded-2xl border-l-2 border-primary bg-muted/40 pl-3 py-2">
            <p className="text-xs text-muted-foreground">
              {new Date(ev.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              {ev.ends_at && ` – ${new Date(ev.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
            </p>
            <p className="text-sm font-medium">{ev.title}</p>
            {ev.description && <p className="text-xs text-muted-foreground">{ev.description}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}

function KpiRing({ label, percent, note, tone }: { label: string; percent: number; note: string; tone: "success" | "destructive" }) {
  const color = tone === "success" ? "var(--success)" : "var(--destructive)";
  return (
    <Card className="card-surface p-4">
      <div
        className="grid h-14 w-14 place-items-center rounded-full text-xs font-bold"
        style={{ background: `conic-gradient(${color} ${percent * 3.6}deg, var(--muted) 0deg)` }}
      >
        <div className="grid h-11 w-11 place-items-center rounded-full bg-card">{percent}%</div>
      </div>
      <p className="mt-3 text-[10px] tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className="text-xs">{note}</p>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-40 w-full rounded-4xl" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-64 rounded-4xl" />
        <Skeleton className="h-64 rounded-4xl" />
        <Skeleton className="h-64 rounded-4xl" />
      </div>
    </div>
  );
}

function weekAround(date: Date): Date[] {
  const start = new Date(date);
  start.setDate(date.getDate() - 3);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function proposalsRate(proposals: { status: string }[]): number {
  if (!proposals.length) return 0;
  const approved = proposals.filter(p => p.status === "approved").length;
  return Math.round((approved / proposals.length) * 100);
}

function pipelineValue(proposals: { status: string; total_value: number | null }[]): number {
  return proposals
    .filter(p => p.status !== "approved" && p.status !== "rejected")
    .reduce((sum, p) => sum + (Number(p.total_value) || 0), 0);
}

function activeProjects(projects: { status: string }[]): number {
  return projects.filter(p => p.status !== "completed" && p.status !== "archived" && p.status !== "cancelled").length;
}

function openTasks(tasks: { status: string }[]): number {
  return tasks.filter(t => t.status !== "done" && t.status !== "completed" && t.status !== "cancelled").length;
}

function completedToday(tasks: { status: string; updated_at: string }[]): number {
  const today = new Date().toDateString();
  return tasks.filter(t => t.status === "done" && new Date(t.updated_at).toDateString() === today).length;
}

function dueSoon(tasks: { status: string; due_date: string | null }[]): number {
  const now = new Date();
  const in7 = new Date();
  in7.setDate(now.getDate() + 7);
  return tasks.filter(t => {
    if (!t.due_date) return false;
    if (t.status === "done" || t.status === "completed") return false;
    const d = new Date(t.due_date);
    return d >= now && d <= in7;
  }).length;
}


function upcomingText(events: any[]) {
  if (!events.length) return "Sem reuniões";
  const e = events[0];
  return `${new Date(e.starts_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })} · ${new Date(e.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}
