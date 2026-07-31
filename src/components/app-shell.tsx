import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutGrid, Home, ClipboardList, Users, FileText, Briefcase, DollarSign, Calendar, UsersRound,
  Settings, Moon, Sun, LogOut, Bell, CheckSquare, Target, Truck, Lightbulb,
  Megaphone, Building2, Receipt, HelpCircle,
  Inbox, MessageSquare, FileSignature, Check, Trash2, Asterisk, ChevronDown,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "@/components/theme-provider";
import { GlobalSearch } from "@/components/global-search";
import { supabase } from "@/integrations/supabase/client";

type NavItem = { to: string; icon: typeof LayoutGrid; label: string };

const primaryNav: NavItem[] = [
  { to: "/dashboard", icon: Home, label: "Dashboard" },
  { to: "/projects", icon: ClipboardList, label: "Projetos" },
  { to: "/tasks", icon: CheckSquare, label: "Tarefas" },
  { to: "/crm", icon: Users, label: "CRM" },
  { to: "/proposals", icon: FileText, label: "Propostas" },
  { to: "/finance", icon: DollarSign, label: "Financeiro" },
  { to: "/invoices", icon: Receipt, label: "Faturas" },
  { to: "/calendar", icon: Calendar, label: "Agenda" },
  { to: "/team", icon: UsersRound, label: "RH" },
];

const secondaryNav: NavItem[] = [
  { to: "/clients", icon: Building2, label: "Clientes" },
  { to: "/goals", icon: Target, label: "Metas" },
  { to: "/suppliers", icon: Truck, label: "Fornecedores" },
  { to: "/ideas", icon: Lightbulb, label: "Banco de Ideias" },
  { to: "/campaigns", icon: Megaphone, label: "Campanhas Internas" },
  { to: "/contracts", icon: FileSignature, label: "Contratos" },
  { to: "/inbox", icon: Inbox, label: "Caixa de Entrada" },
  { to: "/messages", icon: MessageSquare, label: "Mensagens" },
  { to: "/notifications", icon: Bell, label: "Notificações" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const [expanded] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const railItem = (item: NavItem) => {
    const active = pathname.startsWith(item.to);
    const Icon = item.icon;
    return (
      <Link
        key={item.to}
        to={item.to}
        title={item.label}
        className={`flex h-10 items-center gap-3 rounded-xl text-[13px] font-medium transition-colors ${
          expanded ? "px-2.5" : "justify-center px-0"
        } ${
          active
            ? "bg-[var(--sidebar-active)] text-primary shadow-sm"
            : "text-[var(--sidebar-foreground)] hover:bg-white/12 hover:text-white"
        }`}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {expanded && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      {/* Trilho fixo da referência aprovada DASH-01. */}
      <aside
        className="fixed bottom-[18px] left-[10px] top-[12px] z-40 hidden w-[62px] flex-col rounded-[16px] bg-[var(--sidebar)] px-[10px] py-[9px] shadow-lg md:flex"
      >
        <div className="flex h-[43px] items-center justify-center text-primary-foreground">
          <Asterisk className="h-[25px] w-[25px]" strokeWidth={2.4} />
        </div>

        <div className="mt-[11px] flex flex-1 flex-col gap-[5px] overflow-hidden">
          {primaryNav.map(railItem)}
        </div>

        <div className="mt-2 flex flex-col gap-1 border-t border-white/15 pt-2">
          {railItem({ to: "/settings", icon: Settings, label: "Configurações" })}
          <button
            onClick={handleSignOut}
            title="Sair"
            className={`flex h-10 items-center gap-3 rounded-xl text-[13px] font-medium text-[var(--sidebar-foreground)] hover:bg-white/12 hover:text-white ${
              expanded ? "px-2.5" : "justify-center"
            }`}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {expanded && <span>Sair</span>}
          </button>
        </div>
      </aside>

      <div className="px-4 pb-3 pt-3 md:pl-[103px] md:pr-[28px]" style={{ paddingRight: "max(1rem, calc(var(--dock-offset, 0px) + 1.75rem))" }}>
        <TopBar theme={theme} onToggleTheme={setTheme} pathname={pathname} />
        <main className="mt-[6px]">{children}</main>
      </div>
    </div>
  );
}


function TopBar({
  theme, onToggleTheme, pathname,
}: { theme: "light" | "dark"; onToggleTheme: (t: "light" | "dark") => void; pathname: string }) {
  const { data: me } = useQuery({
    queryKey: ["topbar-profile"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, display_name, role_title")
        .eq("id", userRes.user.id)
        .maybeSingle();
      return { email: userRes.user.email ?? "", profile: data as any };
    },
  });

  const name =
    me?.profile?.display_name?.trim() ||
    me?.profile?.full_name?.trim() ||
    me?.email?.split("@")[0] ||
    "";
  const roleTitle = me?.profile?.role_title ?? "Equipe";
  const initials = name
    ? name.split(" ").filter(Boolean).slice(0, 2).map((p: string) => p[0]!.toUpperCase()).join("")
    : "C";

  return (
    <header className="flex h-[42px] items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Link to="/dashboard" className="flex w-[146px] shrink-0 items-center gap-2">
          <Asterisk className="h-[26px] w-[26px] text-primary" strokeWidth={2.5} />
          <span className="hidden font-display text-[19px] font-bold sm:inline">Caritas</span>
        </Link>
        <div className="w-[412px] min-w-0 max-w-[412px] flex-none">
          <GlobalSearch />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-[9px]">
        <button
          onClick={() => onToggleTheme(theme === "dark" ? "light" : "dark")}
          className="flex h-[36px] min-w-[90px] items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-[12px] font-medium text-foreground hover:bg-muted"
          title={theme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
        >
          {theme === "dark" ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
          <span>{theme === "dark" ? "Escuro" : "Claro"}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <NotificationsBell />
        <a
          href="https://docs.lovable.dev"
          target="_blank"
          rel="noreferrer"
          title="Ajuda"
          className="grid h-9 w-7 place-items-center text-muted-foreground hover:text-foreground"
        >
          <HelpCircle className="h-4 w-4" />
        </a>
        <Link
          to="/settings"
          title="Configurações"
          className={`grid h-9 w-7 place-items-center ${
            pathname.startsWith("/settings") ? "text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings className="h-4 w-4" />
        </Link>
        <Link
          to="/settings"
          className="ml-1 flex h-10 min-w-[154px] items-center gap-2 rounded-md pl-1 pr-0 hover:bg-muted"
          title="Meu perfil"
        >
          <span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {initials}
          </span>
          <span className="hidden min-w-0 flex-col leading-tight lg:flex">
            <span className="truncate text-[13px] font-semibold">{name}</span>
            <span className="truncate text-[11px] text-muted-foreground">{roleTitle}</span>
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground lg:block" />
        </Link>
      </div>
    </header>
  );
}

function NotificationsBell() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["notifications-bell"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,title,body,read,created_at")
        .order("created_at", { ascending: false })
        .limit(12);
      return data ?? [];
    },
  });

  const unread = data.filter(n => !n.read).length;
  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications-bell"] });

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    refresh();
  };
  const markAllRead = async () => {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    refresh();
  };
  const remove = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    refresh();
  };

  return (
    <Popover>
      <PopoverTrigger
        title="Notificações"
        className="relative grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-xl p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-[13px] font-semibold">Notificações</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-[11px] font-medium text-primary hover:underline">
              Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {data.length === 0 && (
            <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">Nenhuma notificação.</p>
          )}
          {data.map(n => (
            <div key={n.id} className={`group flex gap-2 border-b border-border px-3 py-2.5 last:border-0 ${n.read ? "" : "bg-secondary/60"}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{n.title}</div>
                {n.body && <div className="line-clamp-2 text-[11px] text-muted-foreground">{n.body}</div>}
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {!n.read && (
                  <button onClick={() => markRead(n.id)} title="Marcar como lida" className="grid h-6 w-6 place-items-center rounded text-success hover:bg-muted">
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={() => remove(n.id)} title="Excluir" className="grid h-6 w-6 place-items-center rounded text-destructive hover:bg-muted">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-3 py-2">
          <Link to="/notifications" className="text-[12px] font-medium text-primary hover:underline">
            Ver todas
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
