import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StatusGroup = "todo" | "in_progress" | "review" | "done";

export type TaskTypeRow = {
  id: string;
  name: string;
  color: string;
  default_billing_model: string | null;
  default_price: number | null;
};

export type TaskTypeStageRow = {
  id: string;
  task_type_id: string;
  name: string;
  order: number;
  color: string;
  status_group: StatusGroup;
  weight: number;
};

/** Lista simples de tipos para uso em seletores. */
export function useTaskTypes() {
  return useQuery<TaskTypeRow[]>({
    queryKey: ["task-types-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_types")
        .select("id,name,color,default_billing_model,default_price")
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
      const { data, error } = await supabase
        .from("task_type_stages")
        .select("id,task_type_id,name,\"order\",color,status_group,weight")
        .eq("task_type_id", taskTypeId!)
        .order("order");
      if (error) throw error;
      return (data ?? []) as TaskTypeStageRow[];
    },
  });
}
