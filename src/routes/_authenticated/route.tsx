import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { isOnboardedCached, markOnboarded } from "@/lib/auth-cache";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // getSession reads the locally persisted session (no network round-trip),
    // keeping navigation between screens instant.
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) throw redirect({ to: "/auth" });

    // Force the onboarding wizard until the profile is filled in (checked once
    // per session, then cached in memory).
    if (!isOnboardedCached(user.id)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.onboarding_completed) throw redirect({ to: "/onboarding" });
      markOnboarded(user.id);
    }

    return { user };
  },

  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
