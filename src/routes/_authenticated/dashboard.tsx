import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Suspense, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  WIDGETS, getWidget, colSpanClass, reconcilePrefs,
  type UserPref,
} from "@/lib/dashboard-widgets";
import { DashboardPersonalize } from "@/components/dashboard-personalize";
import { QuickCreateButton } from "@/components/quick-create-button";
import { ExecutiveDashboard, executiveQuery } from "@/components/dashboard/executive";


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
      supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }).limit(100),
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

const prefsQuery = {
  queryKey: ["dashboard-preferences"],
  queryFn: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return null;
    const { data } = await supabase
      .from("dashboard_preferences" as any)
      .select("widgets")
      .eq("user_id", userRes.user.id)
      .maybeSingle();
    return (data as any) ?? null;
  },
};

function DashboardContent() {
  const { data: me } = useSuspenseQuery(profileQuery);
  const { data } = useSuspenseQuery(dashboardQuery);
  const { data: prefsRow } = useSuspenseQuery(prefsQuery);
  const qc = useQueryClient();

  const profile = me?.profile as any;
  const roleTitle: string | null = profile?.role_title ?? null;

  const firstName =
    profile?.display_name?.trim() ||
    profile?.full_name?.trim().split(" ")[0] ||
    me?.user?.user_metadata?.full_name?.split(" ")[0] ||
    me?.user?.email?.split("@")[0] ||
    "por aí";

  const initialPrefs = reconcilePrefs(prefsRow?.widgets as UserPref[] | null, roleTitle);
  const [prefs, setPrefs] = useState<UserPref[]>(initialPrefs);

  // Persiste no Supabase quando muda (com debounce simples)
  useEffect(() => {
    const t = setTimeout(async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      await supabase.from("dashboard_preferences" as any).upsert(
        { user_id: userRes.user.id, widgets: prefs as any },
        { onConflict: "user_id" },
      );
      qc.setQueryData(prefsQuery.queryKey, { widgets: prefs });
    }, 400);
    return () => clearTimeout(t);
  }, [prefs, qc]);

  const ctx = { data, firstName };
  const { data: exec } = useSuspenseQuery(executiveQuery);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const fullName = profile?.display_name?.trim() || profile?.full_name?.trim() || firstName;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold leading-tight">{greeting}, {fullName}!</h1>
          <p className="text-[13px] text-muted-foreground">
            Aqui está o panorama da Caritas para hoje,{" "}
            {new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DashboardPersonalize value={prefs} onChange={setPrefs} roleTitle={roleTitle} />
          <QuickCreateButton />
        </div>
      </div>

      <ExecutiveDashboard data={exec} />

      {prefs.some(p => p.enabled) && (
        <details className="rounded-lg border border-border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-[13px] font-semibold">
            Meus widgets personalizados
          </summary>
          <div className="grid grid-cols-1 gap-4 border-t border-border p-4 lg:grid-cols-12 lg:gap-5">
            {prefs
              .filter(p => p.enabled)
              .map(p => {
                const w = getWidget(p.id);
                if (!w) return null;
                return (
                  <section key={w.id} className={colSpanClass(w)}>
                    {w.render(ctx)}
                  </section>
                );
              })}
          </div>
        </details>
      )}

    </div>
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
