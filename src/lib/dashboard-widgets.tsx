import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Plus, Calendar, ClipboardList, Users, Paperclip, MessageCircle, Trash2,
  Pencil, Check, FolderKanban, Bell, TrendingUp, TrendingDown, Wallet,
  Activity, BarChart3, Target, FolderOpen, CheckCircle2, CalendarClock,
  CheckSquare, ChevronLeft, ChevronRight, Sparkles, Cake, PieChart,
  Briefcase, Layers, HeartHandshake, Mail, MessagesSquare, Archive,
  Eye, UserPlus, UserMinus,
} from "lucide-react";
import type { JSX } from "react";
import { Link } from "@tanstack/react-router";
import { SwipeableRow, type SwipeAction } from "@/components/swipeable-row";
import { QuickCreateButton } from "@/components/quick-create-button";

export type WidgetCategory =
  | "Saudação"
  | "Tarefas"
  | "Projetos"
  | "Financeiro"
  | "RH / Equipe"
  | "Agenda"
  | "Comercial"
  | "Outros";

export interface DashboardCtx {
  data: {
    tasks: any[];
    notifications: any[];
    events: any[];
    proposals: any[];
    projects: any[];
    allTasks: any[];
  };
  firstName: string;
}

export interface WidgetDef {
  id: string;
  title: string;
  description: string;
  category: WidgetCategory;
  colSpan: 4 | 6 | 8 | 12;
  rowSpan?: 1 | 2;
  render: (ctx: DashboardCtx) => JSX.Element;
}

const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ---------- Helpers ----------

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

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        {children}
      </p>
      {action}
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

function Avatar({ initials }: { initials: string }) {
  return (
    <div className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold border-2 border-card">
      {initials}
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

// Categoriza notificações por tipo (chat interno, email externo, sistema)
function notificationChannel(n: any): { kind: "chat" | "email" | "system"; icon: any; tone: string } {
  const t = String(n.type ?? n.channel ?? "").toLowerCase();
  if (t.includes("chat") || t.includes("message") || t.includes("mensagem")) {
    return { kind: "chat", icon: MessagesSquare, tone: "bg-primary/10 text-primary" };
  }
  if (t.includes("email") || t.includes("mail")) {
    return { kind: "email", icon: Mail, tone: "bg-info/15 text-info" };
  }
  return { kind: "system", icon: Bell, tone: "bg-muted text-muted-foreground" };
}

// ---------- Widgets ----------

export const WIDGETS: WidgetDef[] = [
  {
    id: "greeting",
    title: "Saudação e resumo",
    description: "Boas-vindas, resumo do dia e botão Novo.",
    category: "Saudação",
    colSpan: 8,
    render: ({ firstName, data }) => {
      const open = openTasks(data.allTasks);
      const due = dueSoon(data.allTasks);
      const nextEv = data.events[0];
      return (
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">
              Olá, {firstName}!<br />
              Quais são seus planos para hoje?
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <CheckSquare className="h-4 w-4 text-primary" />
                <b className="text-foreground">{open}</b> tarefas abertas
              </span>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <CalendarClock className="h-4 w-4 text-warning" />
                <b className="text-foreground">{due}</b> vencem em 7 dias
              </span>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 text-info" />
                {nextEv
                  ? <>Próxima reunião <b className="text-foreground">{new Date(nextEv.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</b></>
                  : "Sem reuniões hoje"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <QuickCreateButton />
          </div>
        </div>
      );
    },
  },
  {
    id: "calendar",
    title: "Mini calendário",
    description: "Semana atual + compromissos de hoje.",
    category: "Agenda",
    colSpan: 4,
    rowSpan: 2,
    render: ({ data }) => {
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
              const iso = d.toISOString().slice(0, 10);
              return (
                <Link
                  to="/calendar"
                  search={{ d: iso, new: 1 } as any}
                  key={d.toISOString() + "n"}
                  className="py-1"
                  title={`Novo compromisso em ${d.toLocaleDateString("pt-BR")}`}
                >
                  <div className={`mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-medium transition-colors ${
                    isToday
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-primary/10 hover:text-primary"
                  }`}>
                    {d.getDate()}
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-4 space-y-3">
            {data.events.length === 0 && <EmptyRow icon={Calendar} label="Nenhum compromisso hoje." />}
            {data.events.map(ev => (
              <Link
                to="/calendar"
                search={{ d: ev.starts_at.slice(0, 10) } as any}
                key={ev.id}
                className="block rounded-2xl border-l-2 border-primary bg-muted/40 pl-3 py-2 hover:bg-muted"
              >
                <p className="text-xs text-muted-foreground">
                  {new Date(ev.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  {ev.ends_at && ` – ${new Date(ev.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                </p>
                <p className="text-sm font-medium">{ev.title}</p>
                {ev.description && <p className="text-xs text-muted-foreground line-clamp-1">{ev.description}</p>}
              </Link>
            ))}
          </div>
          <Link
            to="/calendar"
            search={{ new: 1 } as any}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Novo compromisso
          </Link>
        </Card>
      );
    },
  },
  {
    id: "kpi-rings",
    title: "Anéis de KPI",
    description: "Propostas e faturamento em porcentagem.",
    category: "Outros",
    colSpan: 4,
    render: ({ data }) => (
      <div className="grid grid-cols-2 gap-3 h-full">
        <KpiRing label="PROPOSTAS" percent={proposalsRate(data.proposals)} note="taxa de conversão" tone="success" />
        <KpiRing label="FATURAMENTO" percent={65} note="da meta do mês" tone="destructive" />
      </div>
    ),
  },
  // Trocado de lugar: "Próxima reunião" agora ocupa o slot de 4 colunas
  {
    id: "next-meeting",
    title: "Próximas reuniões",
    description: "Convites de reunião com confirmar/recusar por item.",
    category: "Agenda",
    colSpan: 4,
    render: ({ data }) => {
      const list = data.events.slice(0, 3);
      return (
        <Card className="card-surface p-5 h-full flex flex-col">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h3 className="font-display font-semibold">Próximas reuniões</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {list.length === 0 ? "Nenhuma reunião agendada." : `${list.length} convite${list.length > 1 ? "s" : ""} pendente${list.length > 1 ? "s" : ""}`}
              </p>
            </div>
            <Link to="/calendar" className="text-xs text-muted-foreground hover:text-foreground">Ver agenda</Link>
          </div>

          <div className="mt-4 flex-1 space-y-3">
            {list.length === 0 && (
              <EmptyRow icon={Calendar} label="Adicione um evento pela agenda." />
            )}
            {list.map(ev => (
              <div key={ev.id} className="rounded-2xl border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                  {new Date(ev.starts_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  {" · "}
                  {new Date(ev.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <p className="mt-1 text-sm font-medium line-clamp-1">{ev.title}</p>
                {ev.description && <p className="text-xs text-muted-foreground line-clamp-2">{ev.description}</p>}
                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="rounded-full gap-1 flex-1 h-8">
                    <Check className="h-3.5 w-3.5" /> Confirmar
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full flex-1 h-8">
                    Recusar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      );
    },
  },
  {
    id: "assignments",
    title: "Atribuições",
    description: "Tarefa de maior prioridade em destaque.",
    category: "Tarefas",
    colSpan: 4,
    render: ({ data }) => {
      const priority = data.tasks.find(t => t.priority === "high") ?? data.tasks[0];
      return (
        <Card className="card-surface p-5 h-full">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold">Atribuições</h3>
          </div>
          {!priority && <div className="mt-4"><EmptyRow icon={ClipboardList} label="Nenhuma atribuição em destaque." /></div>}
          {priority && (
            <SwipeableRow
              className="mt-4"
              rightActions={[
                { id: "assign",   label: "Atribuir",   icon: UserPlus,   tone: "primary",     onClick: () => {} },
                { id: "unassign", label: "Desatribuir", icon: UserMinus,  tone: "muted",       onClick: () => {} },
                { id: "open",     label: "Abrir",      icon: Eye,        tone: "success",     onClick: () => {} },
              ]}
            >
              <div className="rounded-2xl bg-muted/40 p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary font-medium uppercase">{priority.platform ?? "Geral"}</span>
                  <span>{priority.delivery_type ?? "Entrega"}</span>
                </div>
                <p className="font-display font-semibold text-sm">{priority.title}</p>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-success/20 px-2.5 py-0.5 text-[11px] font-medium text-success-foreground">
                    {priority.priority === "high" ? "Alta" : priority.priority === "medium" ? "Média" : "Baixa"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{priority.progress ?? 0}%</span>
                </div>
              </div>
            </SwipeableRow>
          )}
          <Link
            to="/tasks"
            search={{ new: 1 } as any}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-2.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar atribuição
          </Link>
        </Card>
      );
    },
  },
  {
    id: "tasks-today",
    title: "Tarefas de hoje",
    description: "Até 5 tarefas prioritárias de hoje.",
    category: "Tarefas",
    colSpan: 8,
    render: ({ data }) => (
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
          <Link to="/tasks" className="text-xs text-muted-foreground hover:text-foreground">Ver todas</Link>
        </div>
        <div className="mt-4 space-y-2">
          {data.tasks.length === 0 && <EmptyRow icon={ClipboardList} label="Nenhuma tarefa para hoje ainda." />}
          {data.tasks.slice(0, 5).map(t => (
            <SwipeableRow
              key={t.id}
              rightActions={[
                { id: "open",     label: "Abrir",       icon: Eye,        tone: "primary", onClick: () => {} },
                { id: "assign",   label: "Atribuir",    icon: UserPlus,   tone: "success", onClick: () => {} },
                { id: "unassign", label: "Sair",        icon: UserMinus,  tone: "muted",   onClick: () => {} },
              ]}
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-muted/40 px-3 py-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium truncate text-sm">{t.title}</p>
                    {t.priority === "high" && (
                      <span className="rounded-full bg-destructive/10 text-destructive text-[10px] font-medium px-1.5 py-0.5">
                        Alta
                      </span>
                    )}
                    {t.platform && (
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{t.platform}</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <Progress value={t.progress ?? 0} className="h-1 max-w-[180px]" />
                    <span className="text-[10px] text-muted-foreground shrink-0">{t.progress ?? 0}%</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">· {t.estimated_hours ?? "—"}h</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{t.comments_count ?? 0}</span>
                  <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />{t.attachments_count ?? 0}</span>
                  <span className="hidden md:inline">{t.due_date ? new Date(t.due_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}</span>
                </div>
              </div>
            </SwipeableRow>
          ))}
        </div>
      </Card>
    ),
  },
  // Notifications agora no slot largo (8 col), com categorias chat/email/sistema e ações por swipe
  {
    id: "notifications",
    title: "Notificações",
    description: "Chat interno, e-mails e alertas do sistema.",
    category: "Outros",
    colSpan: 8,
    render: ({ data }) => {
      const list = data.notifications;
      return (
        <Card className="card-surface p-5 h-full">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-display font-semibold">Notificações</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Chat interno, e-mails vinculados e alertas do sistema — arraste para ações rápidas.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[10px] font-medium px-2 py-1">
                <MessagesSquare className="h-3 w-3" /> Chat
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-info/15 text-info text-[10px] font-medium px-2 py-1">
                <Mail className="h-3 w-3" /> E-mail
              </span>
              <button className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                <Trash2 className="h-3.5 w-3.5" /> Limpar
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {list.length === 0 && (
              <EmptyRow icon={Bell} label="Sem notificações. Chat interno e integração de e-mail em breve." />
            )}
            {list.map((n: any) => {
              const ch = notificationChannel(n);
              const Icon = ch.icon;
              const actions: SwipeAction[] = [
                { id: "read",    label: "Ler",      icon: Check,   tone: "success",     onClick: () => {} },
                { id: "archive", label: "Arquivar", icon: Archive, tone: "muted",       onClick: () => {} },
                { id: "delete",  label: "Excluir",  icon: Trash2,  tone: "destructive", onClick: () => {} },
                { id: "open",    label: "Acessar",  icon: Eye,     tone: "primary",     onClick: () => {} },
              ];
              return (
                <SwipeableRow key={n.id} rightActions={actions}>
                  <div className="flex items-start gap-3 rounded-2xl bg-muted/40 px-3 py-2.5">
                    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${ch.tone}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {ch.kind === "chat" ? "Chat" : ch.kind === "email" ? "E-mail" : "Sistema"}
                        </span>
                      </div>
                      {n.body && <p className="text-xs text-muted-foreground line-clamp-1">{n.body}</p>}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {n.created_at ? new Date(n.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                </SwipeableRow>
              );
            })}
          </div>
        </Card>
      );
    },
  },
  {
    id: "finance",
    title: "Financeiro",
    description: "Faturamento, despesas, lucro, MRR, pipeline e conversão.",
    category: "Financeiro",
    colSpan: 12,
    render: ({ data }) => (
      <div>
        <SectionLabel action={<Link to="/finance" className="text-[11px] font-medium text-primary hover:underline">Ver módulo →</Link>}>
          Financeiro
        </SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <FinanceCard label="Faturamento"  value={BRL(0)} hint="vs mês anterior" icon={TrendingUp}   tone="success"     delta={{ value: "0%", direction: "up" }} />
          <FinanceCard label="Despesas"     value={BRL(0)} hint="vs mês anterior" icon={TrendingDown} tone="destructive" delta={{ value: "0%", direction: "up" }} />
          <FinanceCard label="Lucro Líquido" value={BRL(0)} hint="Margem 0%"       icon={Wallet}       tone="primary"     delta={{ value: "0%", direction: "up" }} />
          <FinanceCard label="MRR"          value={BRL(0)} hint="Recorrente mensal" icon={Activity}    tone="info" />
          <FinanceCard label="Pipeline"     value={BRL(pipelineValue(data.proposals))} hint={`${data.proposals.length} deals`} icon={BarChart3} tone="accent" />
          <FinanceCard label="Conversão"    value={`${proposalsRate(data.proposals)}%`} hint="Taxa de fechamento" icon={Target} tone="warning" />
        </div>
      </div>
    ),
  },
  {
    id: "operations",
    title: "Operacional",
    description: "Projetos ativos, tarefas abertas, concluídas hoje e prazos.",
    category: "Projetos",
    colSpan: 12,
    render: ({ data }) => (
      <div>
        <SectionLabel>Operacional</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Projetos Ativos" value={String(activeProjects(data.projects))} hint="em andamento" icon={FolderOpen} tone="primary" />
          <StatCard label="Tarefas Abertas" value={String(openTasks(data.allTasks))} hint="aguardando conclusão" icon={CheckSquare} tone="info" />
          <StatCard label="Concluídas Hoje" value={String(completedToday(data.allTasks))} hint="entregues hoje" icon={CheckCircle2} tone="success" />
          <StatCard label="Prazos em 7 dias" value={String(dueSoon(data.allTasks))} hint="vencem em breve" icon={CalendarClock} tone="warning" />
        </div>
      </div>
    ),
  },
  {
    id: "sales-pipeline",
    title: "Pipeline comercial",
    description: "Valor total em negociação e nº de deals abertos.",
    category: "Comercial",
    colSpan: 4,
    render: ({ data }) => (
      <Card className="card-surface p-5 h-full">
        <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
          <HeartHandshake className="h-3.5 w-3.5" /> Pipeline comercial
        </div>
        <p className="mt-3 font-display text-3xl font-bold">{BRL(pipelineValue(data.proposals))}</p>
        <p className="mt-1 text-xs text-muted-foreground">{data.proposals.length} propostas em aberto</p>
      </Card>
    ),
  },
  {
    id: "hr-team",
    title: "Equipe / RH",
    description: "Placeholder para membros, aniversariantes e férias.",
    category: "RH / Equipe",
    colSpan: 4,
    render: () => (
      <Card className="card-surface p-5 h-full">
        <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
          <Users className="h-3.5 w-3.5" /> Equipe
        </div>
        <p className="mt-3 font-display text-3xl font-bold">—</p>
        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
          <Cake className="h-3.5 w-3.5" /> Aniversariantes e férias em breve
        </p>
      </Card>
    ),
  },
  {
    id: "projects-active",
    title: "Projetos em andamento",
    description: "Placeholder de status de projetos ativos.",
    category: "Projetos",
    colSpan: 4,
    render: ({ data }) => (
      <Card className="card-surface p-5 h-full">
        <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">
          <Briefcase className="h-3.5 w-3.5" /> Projetos
        </div>
        <p className="mt-3 font-display text-3xl font-bold">{activeProjects(data.projects)}</p>
        <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" /> Ativos no momento
        </p>
      </Card>
    ),
  },
];

// FinanceCard — variação de StatCard com destaque visual mais rico e ícone maior
function FinanceCard({
  label, value, hint, icon: Icon, tone = "primary", delta,
}: {
  label: string; value: string; hint?: string; icon: any; tone?: StatTone;
  delta?: { value: string; direction: "up" | "down" | "flat" };
}) {
  const toneClasses: Record<StatTone, { bg: string; text: string; ring: string }> = {
    success:     { bg: "bg-success/10",     text: "text-success",     ring: "ring-success/20" },
    destructive: { bg: "bg-destructive/10", text: "text-destructive", ring: "ring-destructive/20" },
    primary:     { bg: "bg-primary/10",     text: "text-primary",     ring: "ring-primary/20" },
    accent:      { bg: "bg-accent/20",      text: "text-accent-foreground", ring: "ring-accent/30" },
    warning:     { bg: "bg-warning/15",     text: "text-warning",     ring: "ring-warning/20" },
    info:        { bg: "bg-info/15",        text: "text-info",        ring: "ring-info/20" },
  };
  const t = toneClasses[tone];
  return (
    <Card className={`card-surface relative overflow-hidden p-4 md:p-5 ring-1 ${t.ring}`}>
      {/* Fundo decorativo circular sutil */}
      <div className={`pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full ${t.bg} opacity-60`} />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            {label}
          </span>
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${t.bg} ${t.text} shadow-sm`}>
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

export const CATEGORIES: WidgetCategory[] = [
  "Saudação", "Tarefas", "Agenda", "Financeiro", "Comercial", "Projetos", "RH / Equipe", "Outros",
];

export const CATEGORY_ICON: Record<WidgetCategory, any> = {
  "Saudação": Sparkles,
  "Tarefas": ClipboardList,
  "Agenda": Calendar,
  "Financeiro": PieChart,
  "Comercial": HeartHandshake,
  "Projetos": Briefcase,
  "RH / Equipe": Users,
  "Outros": Layers,
};

export type UserPref = { id: string; enabled: boolean };

// ---------- Presets ----------

const ALL_IDS = WIDGETS.map(w => w.id);

const PRESETS: Record<string, string[]> = {
  founder: ALL_IDS,
  manager: ["greeting", "kpi-rings", "calendar", "next-meeting", "tasks-today", "assignments", "notifications", "operations", "projects-active"],
  traffic: ["greeting", "kpi-rings", "calendar", "next-meeting", "tasks-today", "finance", "sales-pipeline"],
  sales: ["greeting", "kpi-rings", "calendar", "next-meeting", "sales-pipeline", "finance", "notifications"],
  designer: ["greeting", "calendar", "next-meeting", "tasks-today", "assignments", "notifications", "operations"],
  copywriter: ["greeting", "calendar", "next-meeting", "tasks-today", "assignments", "notifications", "operations"],
  developer: ["greeting", "calendar", "next-meeting", "tasks-today", "assignments", "operations", "projects-active"],
  operations: ["greeting", "kpi-rings", "calendar", "next-meeting", "tasks-today", "notifications", "operations", "hr-team"],
};

const ROLE_KEYWORDS: Array<[RegExp, string]> = [
  [/fund|ceo|dono|diretor/i, "founder"],
  [/gestor.*projet|project|pm\b|scrum/i, "manager"],
  [/tráfeg|trafego|traffic|m[íi]dia|ads|paid/i, "traffic"],
  [/comerc|vend|sales|closer|sdr/i, "sales"],
  [/design|ui|ux|arte/i, "designer"],
  [/copy|redator|conteúdo|conteudo/i, "copywriter"],
  [/dev|tech|program|engenh/i, "developer"],
  [/opera|financ|admin|rh/i, "operations"],
];

export function getPresetForRole(roleTitle: string | null | undefined): UserPref[] {
  const key = detectPresetKey(roleTitle);
  const ids = PRESETS[key] ?? ALL_IDS;
  const enabledSet = new Set(ids);
  const orderedEnabled = ids.map(id => ({ id, enabled: true } as UserPref));
  const rest = ALL_IDS.filter(id => !enabledSet.has(id)).map(id => ({ id, enabled: false } as UserPref));
  return [...orderedEnabled, ...rest];
}

function detectPresetKey(roleTitle: string | null | undefined): string {
  if (!roleTitle) return "founder";
  for (const [re, key] of ROLE_KEYWORDS) if (re.test(roleTitle)) return key;
  return "founder";
}

export function reconcilePrefs(saved: UserPref[] | null | undefined, roleTitle: string | null | undefined): UserPref[] {
  if (!saved || saved.length === 0) return getPresetForRole(roleTitle);
  const knownIds = new Set(ALL_IDS);
  const filtered = saved.filter(p => knownIds.has(p.id));
  const seen = new Set(filtered.map(p => p.id));
  const missing = ALL_IDS.filter(id => !seen.has(id)).map(id => ({ id, enabled: false } as UserPref));
  return [...filtered, ...missing];
}

export function colSpanClass(w: WidgetDef): string {
  const map: Record<number, string> = {
    4: "lg:col-span-4",
    6: "lg:col-span-6",
    8: "lg:col-span-8",
    12: "lg:col-span-12",
  };
  const row = w.rowSpan === 2 ? " lg:row-span-2" : "";
  return `${map[w.colSpan]}${row}`;
}

export function getWidget(id: string): WidgetDef | undefined {
  return WIDGETS.find(w => w.id === id);
}
