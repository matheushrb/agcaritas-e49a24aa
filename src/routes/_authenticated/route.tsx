import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Onboarding gate: force the wizard until the profile is filled in.
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", data.user.id)
      .maybeSingle();

    const needsOnboarding = !profile?.onboarding_completed;
    const onOnboarding = location.pathname.startsWith("/onboarding");
    if (needsOnboarding && !onOnboarding) throw redirect({ to: "/onboarding" });
    if (!needsOnboarding && onOnboarding) throw redirect({ to: "/dashboard" });

    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
