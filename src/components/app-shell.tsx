import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutGrid, Home, ClipboardList, Users, FileText, Briefcase, DollarSign, UsersRound,
  Settings, Moon, Sun, LogOut, Bell, CheckSquare, Target, Truck, Lightbulb,
  Megaphone, Building2, Receipt, HelpCircle,
  Inbox, MessageSquare, FileSignature, Check, Trash2, Asterisk, ChevronDown,
  PanelLeftClose, PanelLeftOpen, Rows3, Rows2,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "@/components/theme-provider";
import { GlobalSearch } from "@/components/global-search";
import { TopbarCalendar } from "@/components/topbar-calendar";
import { TopbarWeather } from "@/components/topbar-weather";
import { supabase } from "@/integrations/supabase/client";
import caritasLogo from "@/assets/caritas-logo-horizontal.png.asset.json";
import caritasSymbol from "@/assets/caritas-symbol.png.asset.json";
import { resolveAvatarUrl } from "@/components/settings/profile-tab";

type NavItem = { to: string; icon: typeof LayoutGrid; label: string };

const primaryNav: NavItem[] = [
  { to: "/dashboard", icon: Home, label: "Dashboard" },
  { to: "/projects", icon: ClipboardList, label: "Projetos" },
  { to: "/tasks", icon: CheckSquare, label: "Tarefas" },
  { to: "/crm", icon: Users, label: "CRM" },
  { to: "/proposals", icon: FileText, label: "Propostas" },
  { to: "/finance", icon: DollarSign, label: "Financeiro" },
  { to: "/invoices", icon: Receipt, label: "Faturas" },
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
  const [expanded, setExpanded] = useState(false);
  const [density, setDensity] = useState<"cozy" | "compact">("cozy");

  useEffect(() => {
    const saved = localStorage.getItem("caritas.nav.expanded");
    if (saved === "1") setExpanded(true);
    const d = localStorage.getItem("caritas.density");
    if (d === "compact" || d === "cozy") setDensity(d);
  }, []);

  const toggleDensity = () => {
    setDensity(v => {
      const next = v === "compact" ? "cozy" : "compact";
      localStorage.setItem("caritas.density", next);
      return next;
    });
  };

  const toggleNav = () => {
    setExpanded(v => {
      localStorage.setItem("caritas.nav.expanded", v ? "0" : "1");
      return !v;
    });
  };

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
        className={`cv-nav-item${active ? " is-active" : ""}`}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {expanded && <span>{item.label}</span>}
      </Link>
    );
  };

  return (
    <div className="caritas-ui" data-theme={theme} data-nav={expanded ? "expanded" : "collapsed"} data-density={density}>
      <aside className="cv-sidebar">
        <div className="cv-sidebar-logo">
          <span className="cv-sb-brand">
            <img src={caritasSymbol.url} alt="Caritas" style={{ width: 26, height: "auto" }} />
            {expanded && <span>Caritas</span>}
          </span>
          <button
            type="button"
            className="cv-sb-toggle"
            onClick={toggleNav}
            title={expanded ? "Colapsar menu" : "Expandir menu"}
            aria-label={expanded ? "Colapsar menu" : "Expandir menu"}
          >
            {expanded ? <PanelLeftClose /> : <PanelLeftOpen />}
          </button>
        </div>

        <nav className="cv-sidebar-nav">
          {expanded && <div className="cv-sb-group">Módulos</div>}
          {primaryNav.map(railItem)}
          {expanded && <div className="cv-sb-group">Mais</div>}
          {expanded && secondaryNav.map(railItem)}
          <Popover>
            <PopoverTrigger asChild>
              <button className="cv-nav-item" title="Mais módulos" style={expanded ? { display: "none" } : undefined}>
                <LayoutGrid className="h-[18px] w-[18px]" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="w-60 p-1.5 rounded-xl">
              <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">Mais módulos</div>
              {secondaryNav.map(item => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-muted"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </Link>
                );
              })}
            </PopoverContent>
          </Popover>
        </nav>

        <div className="cv-sidebar-bottom">
          {railItem({ to: "/settings", icon: Settings, label: "Configurações" })}
          <button onClick={handleSignOut} title="Sair" className="cv-nav-item">
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {expanded && <span>Sair</span>}
          </button>
        </div>
      </aside>

      <div className="cv-shell">
        <TopBar theme={theme} onToggleTheme={setTheme} pathname={pathname} density={density} onToggleDensity={toggleDensity} />
        <main className="cv-main">{children}</main>
      </div>
    </div>
  );
}


function TopBar({
  theme, onToggleTheme, pathname, density, onToggleDensity,
}: {
  theme: "light" | "dark";
  onToggleTheme: (t: "light" | "dark") => void;
  pathname: string;
  density: "cozy" | "compact";
  onToggleDensity: () => void;
}) {
  const { data: me } = useQuery({
    queryKey: ["topbar-profile"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, display_name, role_title, avatar_url")
        .eq("id", userRes.user.id)
        .maybeSingle();
      const avatar = await resolveAvatarUrl((data as { avatar_url?: string | null } | null)?.avatar_url);
      return { email: userRes.user.email ?? "", profile: data as any, avatar };
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

  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="cv-topbar" data-stuck={stuck ? "true" : "false"}>
      <Link to="/dashboard" className="cv-brand" style={{ textDecoration: "none", color: "inherit" }}>
        <img src={caritasLogo.url} alt="Agência Caritas" style={{ height: 26, width: "auto" }} />
      </Link>

      <GlobalSearch />

      <div className="cv-top-actions">
        <button
          onClick={() => onToggleTheme(theme === "dark" ? "light" : "dark")}
          className="cv-theme"
          title={theme === "dark" ? "Mudar para modo claro" : "Mudar para modo escuro"}
        >
          {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          <span style={{ fontSize: 12 }}>{theme === "dark" ? "Escuro" : "Claro"}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggleDensity}
          className="cv-icon-button"
          title={density === "compact" ? "Densidade compacta (clique para confortável)" : "Densidade confortável (clique para compacta)"}
          aria-label="Alternar densidade da interface"
        >
          {density === "compact" ? <Rows3 className="h-4 w-4" /> : <Rows2 className="h-4 w-4" />}
        </button>
        <TopbarWeather />
        <TopbarCalendar />
        <NotificationsBell />
        <a
          href="https://docs.lovable.dev"
          target="_blank"
          rel="noreferrer"
          title="Ajuda"
          className="cv-icon-button"
        >
          <HelpCircle className="h-4 w-4" />
        </a>
        <Link
          to="/settings"
          title="Configurações"
          className="cv-icon-button"
          style={pathname.startsWith("/settings") ? { color: "var(--primary)" } : undefined}
        >
          <Settings className="h-4 w-4" />
        </Link>
        <Link to="/settings" className="cv-profile" title="Meu perfil" style={{ textDecoration: "none", color: "inherit" }}>
          <span className="cv-avatar">
            {me?.avatar
              ? <img src={me.avatar} alt="Minha foto" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              : initials}
          </span>
          <div>
            <strong>{name}</strong>
            <span>{roleTitle}</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--muted)" }} />
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
        className="cv-icon-button cv-bell"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <b>
            {unread}
          </b>
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
