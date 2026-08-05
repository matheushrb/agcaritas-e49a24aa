import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { BriefingForm } from "@/components/briefing-form";
import { fetchBriefingTemplates, type BriefingData } from "@/lib/briefing";

/** Card de briefing do projeto — usa os modelos configuráveis da agência. */
export function ProjectBriefingCard({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [data, setData] = useState<BriefingData>({});

  const { data: templates = [] } = useQuery({
    queryKey: ["briefing_templates"],
    queryFn: fetchBriefingTemplates,
  });

  const { data: project } = useQuery({
    queryKey: ["project_briefing", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("projects")
        .select("id,briefing,briefing_template_id")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (!project) return;
    setTemplateId(project.briefing_template_id ?? null);
    setData(project.briefing && typeof project.briefing === "object" ? project.briefing : {});
  }, [project?.id, project?.briefing_template_id]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("projects")
        .update({ briefing_template_id: templateId, briefing: data })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Briefing salvo");
      qc.invalidateQueries({ queryKey: ["project_briefing", projectId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar briefing"),
  });

  const briefingTemplates = templates.filter(t => t.template_type === "briefing");
  const template = briefingTemplates.find(t => t.id === templateId) ?? null;

  return (
    <section className="p2-card" style={{ gridColumn: "1 / -1" }}>
      <div className="p2-card-h">
        <span className="p2-card-t">Briefing do projeto</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <Select value={templateId ?? undefined} onValueChange={v => setTemplateId(v)}>
            <SelectTrigger className="h-8 w-[220px] text-xs">
              <SelectValue placeholder={briefingTemplates.length ? "Escolher modelo" : "Nenhum modelo cadastrado"} />
            </SelectTrigger>
            <SelectContent>
              {briefingTemplates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="rounded-full" disabled={!template || save.isPending} onClick={() => save.mutate()}>
            Salvar
          </Button>
        </div>
      </div>

      {template ? (
        <div style={{ marginTop: 12 }}>
          <BriefingForm template={template} data={data} onChange={setData} showHeader={false} />
        </div>
      ) : (
        <div className="p2-empty">
          Escolha um modelo de briefing. Os modelos são criados em Configurações › Modelos de Briefing.
        </div>
      )}
    </section>
  );
}
