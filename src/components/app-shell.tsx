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
      {/* Floating sidebar (not full height, indented island) */}
      <aside className="fixed left-3 top-24 bottom-6 z-30 hidden md:flex flex-col items-center gap-1 py-3 w-16 rounded-4xl bg-sidebar shadow-[var(--shadow-elevated)] border border-border">
        {sideIcons.map(item => {
          const active = pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              title={item.label}
              className="group relative grid h-11 w-11 place-items-center rounded-2xl transition-colors"
              style={active ? { backgroundColor: "var(--sidebar-active)", color: "var(--primary-foreground)" } : undefined}
            >
              <Icon className={`h-5 w-5 ${active ? "" : "text-sidebar-foreground group-hover:text-foreground"}`} />
            </Link>
          );
        })}
        <div className="mt-auto">
          <button
            onClick={handleSignOut}
            className="grid h-11 w-11 place-items-center rounded-2xl text-sidebar-foreground hover:text-destructive"
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
        <nav className="hidden lg:flex items-center gap-6 text-sm">
          {[
            { to: "/dashboard", label: "Dashboard" },
            { to: "/projects", label: "Projetos" },
            { to: "/crm", label: "CRM" },
          ].map(link => {
            const active = pathname.startsWith(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative py-1 ${active ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
              >
                {link.label}
                {active && <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
        <div className="relative hidden md:block min-w-0 flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar ou digite um comando" className="pl-9 bg-card border-border rounded-full" />
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
        <Button variant="ghost" size="icon" className="rounded-full"><Bell className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="rounded-full"><Settings className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" className="hidden md:inline-flex rounded-full gap-2">
          <Download className="h-4 w-4" /> Exportar
          <span className="ml-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">xls</span>
        </Button>
        <Button size="sm" className="rounded-full gap-1.5">
          <Plus className="h-4 w-4" /> Novo projeto
        </Button>
      </div>
    </header>
  );
}
