import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutGrid, Users, FileText, Briefcase, DollarSign, Calendar, UsersRound,
  Search, Settings, Moon, Sun, Sparkles, LogOut, Bell,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/theme-provider";
import { supabase } from "@/integrations/supabase/client";

// Sidebar principal — 7 ícones conforme documento Pixie v2 (Dashboard, CRM,
// Propostas, Projetos, Financeiro, Agenda, RH). Configurações no rodapé.
const sideIcons = [
  { to: "/dashboard",  icon: LayoutGrid, label: "Dashboard" },
  { to: "/crm",        icon: Users,      label: "CRM" },
  { to: "/proposals",  icon: FileText,   label: "Propostas" },
  { to: "/projects",   icon: Briefcase,  label: "Projetos" },
  { to: "/finance",    icon: DollarSign, label: "Financeiro" },
  { to: "/calendar",   icon: Calendar,   label: "Agenda" },
  { to: "/team",       icon: UsersRound, label: "RH" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const pathname = useRouterState({ select: s => s.location.pathname });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      {/* Floating sidebar — azul com selector branco no item ativo */}
      <aside className="fixed left-3 top-24 bottom-6 z-30 hidden md:flex flex-col items-center gap-1 py-3 w-16 rounded-4xl bg-primary shadow-[var(--shadow-elevated)] border border-primary/30">
        {sideIcons.map(item => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              title={item.label}
              className={`group relative grid h-11 w-11 place-items-center rounded-2xl transition-colors ${
                active
                  ? "bg-white text-primary shadow-sm"
                  : "text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
              }`}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
        <div className="mt-auto flex flex-col items-center gap-1">
          <Link
            to="/settings"
            title="Configurações"
            className={`grid h-11 w-11 place-items-center rounded-2xl transition-colors ${
              pathname.startsWith("/settings")
                ? "bg-white text-primary shadow-sm"
                : "text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            }`}
          >
            <Settings className="h-5 w-5" />
          </Link>
          <button
            onClick={handleSignOut}
            className="grid h-11 w-11 place-items-center rounded-2xl text-primary-foreground/80 hover:text-white hover:bg-white/10"
            title="Sair"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </aside>

      {/* Main content, padded left to make room for floating sidebar */}
      <div className="pl-4 pr-4 sm:pl-6 sm:pr-6 md:pl-24 lg:pl-28 lg:pr-8 py-6">
        <TopBar theme={theme} onToggleTheme={setTheme} pathname={pathname} />
        <main className="mt-6">
          {children}
        </main>
      </div>
    </div>
  );
}

function TopBar({
  theme, onToggleTheme, pathname,
}: { theme: "light" | "dark"; onToggleTheme: (t: "light" | "dark") => void; pathname: string }) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 lg:flex lg:flex-wrap lg:justify-between">
      <div className="flex min-w-0 items-center gap-6">
        <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-bold hidden sm:inline">Caritas</span>
        </Link>
        <div className="relative hidden md:block min-w-0 flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar tarefas, clientes, projetos, propostas..." className="pl-9 bg-card border-border rounded-full" />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex items-center rounded-full bg-card border border-border p-1">
          <button
            onClick={() => onToggleTheme("light")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${theme === "light" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
          >
            <Sun className="h-3.5 w-3.5" /> Claro
          </button>
          <button
            onClick={() => onToggleTheme("dark")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${theme === "dark" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            <Moon className="h-3.5 w-3.5" /> Escuro
          </button>
        </div>
        <Link to="/notifications" title="Notificações"
          className={`grid h-9 w-9 place-items-center rounded-full ${pathname.startsWith("/notifications") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          <Bell className="h-4 w-4" />
        </Link>
        <Link to="/settings" title="Configurações"
          className={`grid h-9 w-9 place-items-center rounded-full ${pathname.startsWith("/settings") ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}
