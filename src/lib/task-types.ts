import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StatusGroup = "todo" | "in_progress" | "review" | "done";

export type TaskTypeRow = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  default_billing_model: string | null;
  default_price: number | null;
  has_broadcast: boolean;
  has_live: boolean;
  has_tech_sheet: boolean;
};

export type TaskTypeStageRow = {
  id: string;
  task_type_id: string;
  name: string;
  order: number;
  color: string;
  status_group: StatusGroup;
  weight: number;
  auto_checklist: string[];
};

/** Lista simples de tipos para uso em seletores. */
export function useTaskTypes() {
  return useQuery<TaskTypeRow[]>({
    queryKey: ["task-types-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_types")
        .select("id,name,color,icon,default_billing_model,default_price,has_broadcast,has_live,has_tech_sheet")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as TaskTypeRow[];
    },
  });
}

/** Etapas de um tipo específico, ordenadas. */
export function useTaskTypeStages(taskTypeId: string | null | undefined) {
  return useQuery<TaskTypeStageRow[]>({
    queryKey: ["task-type-stages", taskTypeId],
    enabled: !!taskTypeId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("task_type_stages")
        .select("id,task_type_id,name,\"order\",color,status_group,weight,auto_checklist")
        .eq("task_type_id", taskTypeId!)
        .order("order");
      if (error) throw error;
      return ((data ?? []) as any[]).map(s => ({
        ...s,
        auto_checklist: Array.isArray(s.auto_checklist) ? s.auto_checklist : [],
      })) as TaskTypeStageRow[];
    },
  });
}

/* ============================================================
   Índice global de etapas — usado nas listas/quadros para exibir
   o nome da etapa dinâmica (current_stage_id) fora da janela.
   ============================================================ */
export type StageInfo = { id: string; name: string; color: string; status_group: StatusGroup };

const FALLBACK_STAGES: Record<string, { name: string; color: string; status_group: StatusGroup }> = {
  briefing: { name: "Briefing", color: "#7F8C9E", status_group: "todo" },
  creation: { name: "Criação", color: "#2F6BEF", status_group: "in_progress" },
  review: { name: "Revisão", color: "#F59E0B", status_group: "review" },
  approval: { name: "Aprovação", color: "#8B5CF6", status_group: "review" },
  delivery: { name: "Entrega", color: "#10B981", status_group: "done" },
};

/** Mapa id_da_etapa -> informações, para todas as etapas da organização. */
export function useStageIndex() {
  return useQuery<Record<string, StageInfo>>({
    queryKey: ["task-type-stages-index"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("task_type_stages")
        .select("id,name,color,status_group");
      if (error) throw error;
      const map: Record<string, StageInfo> = {};
      for (const s of (data ?? []) as StageInfo[]) map[s.id] = s;
      return map;
    },
  });
}

/** Rótulo/cor da etapa de uma tarefa: dinâmica quando houver, senão a etapa padrão. */
export function stageInfoOf(
  task: { stage?: string | null; current_stage_id?: string | null },
  index: Record<string, StageInfo> | undefined,
): { name: string; color: string } {
  const dyn = task.current_stage_id ? index?.[task.current_stage_id] : undefined;
  if (dyn) return { name: dyn.name, color: dyn.color || "#2F6BEF" };
  const fb = FALLBACK_STAGES[task.stage ?? "briefing"] ?? FALLBACK_STAGES.briefing;
  return { name: fb.name, color: fb.color };
}

