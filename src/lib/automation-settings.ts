import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type TaskPriority = "low" | "medium" | "high" | "urgent" | "critical";

export type AutomationSettings = {
  overdueEscalate: {
    enabled: boolean;
    daysAfterDue: number; // 0 = no mesmo dia em que vencer
    targetPriority: TaskPriority;
  };
};

export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  overdueEscalate: {
    enabled: false,
    daysAfterDue: 0,
    targetPriority: "urgent",
  },
};

function normalize(raw: unknown): AutomationSettings {
  const src = (raw ?? {}) as Partial<AutomationSettings>;
  const oe = src.overdueEscalate ?? {};
  return {
    overdueEscalate: {
      enabled: Boolean((oe as any).enabled),
      daysAfterDue: Math.max(0, Number((oe as any).daysAfterDue ?? 0)),
      targetPriority: ((oe as any).targetPriority as TaskPriority) ?? "urgent",
    },
  };
}

async function fetchOrgSettings(): Promise<{ orgId: string | null; settings: AutomationSettings }> {
  const { data: p } = await supabase.from("profiles").select("organization_id").maybeSingle();
  if (!p?.organization_id) return { orgId: null, settings: DEFAULT_AUTOMATION_SETTINGS };
  const { data } = await supabase
    .from("organizations")
    .select("id, automation_settings")
    .eq("id", p.organization_id)
    .maybeSingle();
  return {
    orgId: p.organization_id,
    settings: normalize((data as any)?.automation_settings),
  };
}

export function useAutomationSettings() {
  return useQuery({
    queryKey: ["automation-settings"],
    queryFn: fetchOrgSettings,
    staleTime: 60_000,
  });
}

export function useUpdateAutomationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (next: AutomationSettings) => {
      const { data: p } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!p?.organization_id) throw new Error("Organização não encontrada");
      const { error } = await supabase
        .from("organizations")
        .update({ automation_settings: next as any })
        .eq("id", p.organization_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation-settings"] });
      toast.success("Automações atualizadas");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Priority ordering for escalation comparison */
const PRIORITY_RANK: Record<TaskPriority, number> = {
  low: 0, medium: 1, high: 2, urgent: 3, critical: 4,
};

/** Compute the effective (display) priority for a task, applying overdue escalation. */
export function effectivePriority(
  task: { priority: TaskPriority; due_date: string | null; status?: string | null },
  settings: AutomationSettings,
): { priority: TaskPriority; escalated: boolean } {
  const rule = settings.overdueEscalate;
  if (!rule.enabled) return { priority: task.priority, escalated: false };
  if (!task.due_date) return { priority: task.priority, escalated: false };
  if (task.status === "done") return { priority: task.priority, escalated: false };

  const due = new Date(task.due_date);
  const threshold = new Date(due.getTime() + rule.daysAfterDue * 24 * 60 * 60 * 1000);
  if (Date.now() < threshold.getTime()) return { priority: task.priority, escalated: false };

  if (PRIORITY_RANK[rule.targetPriority] <= PRIORITY_RANK[task.priority]) {
    return { priority: task.priority, escalated: false };
  }
  return { priority: rule.targetPriority, escalated: true };
}
