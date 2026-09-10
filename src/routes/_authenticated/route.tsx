import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { isOnboardedCached, markOnboarded } from "@/lib/auth-cache";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Acesso direto temporariamente liberado (login desativado a pedido).
  beforeLoad: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    return { user: sessionData.session?.user ?? null };
  },

  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
