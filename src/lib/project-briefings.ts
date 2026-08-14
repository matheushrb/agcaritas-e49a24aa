import { supabase as sb } from "@/integrations/supabase/client";
import type { BriefingData } from "@/lib/briefing";

export type ProjectBriefing = {
  id: string;
  project_id: string;
  title: string;
  template_id: string | null;
  data: BriefingData;
  status: "draft" | "done";
  created_at: string;
  updated_at: string;
};

export async function orgIdOf() {
  const { data: userRes } = await sb.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Sessão expirada.");
  const { data } = await sb.from("profiles").select("organization_id").eq("id", uid).maybeSingle();
  const org = (data as { organization_id?: string } | null)?.organization_id;
  if (!org) throw new Error("Organização não encontrada.");
  return org;
}

export async function fetchProjectBriefings(projectId: string): Promise<ProjectBriefing[]> {
  const { data, error } = await sb
    .from("project_briefings")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ProjectBriefing[];
}

export async function createProjectBriefing(projectId: string, title: string, templateId: string | null) {
  const organization_id = await orgIdOf();
  const { data: userRes } = await sb.auth.getUser();
  const { data, error } = await sb
    .from("project_briefings")
    .insert({
      organization_id,
      project_id: projectId,
      title: title || "Novo briefing",
      template_id: templateId,
      data: {},
      status: "draft",
      created_by: userRes.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as ProjectBriefing;
}

export async function updateProjectBriefing(id: string, patch: Partial<ProjectBriefing>) {
  const { error } = await sb.from("project_briefings").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteProjectBriefing(id: string) {
  const { error } = await sb.from("project_briefings").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateProjectBriefing(b: ProjectBriefing) {
  const organization_id = await orgIdOf();
  const { error } = await sb.from("project_briefings").insert({
    organization_id,
    project_id: b.project_id,
    title: `${b.title} (cópia)`,
    template_id: b.template_id,
    data: b.data as never,
    status: "draft",
  });
  if (error) throw error;
}
