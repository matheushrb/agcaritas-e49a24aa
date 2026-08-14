import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Copy, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BriefingWindow, type BriefingPatch, type Strategy } from "./briefing-window";
import {
  createProjectBriefing, deleteProjectBriefing, duplicateProjectBriefing,
  fetchProjectBriefings, updateProjectBriefing, type ProjectBriefing,
} from "@/lib/project-briefings";
import { fetchBriefingTemplates } from "@/lib/briefing";

export function BriefingsCard({
  projectId, projectName, description, strategy, onSavePositioning,
}: {
  projectId: string;
  projectName: string;
  description: string;
  strategy: Strategy;
  onSavePositioning?: (patch: { description: string; strategy: Strategy }) => void;
}) {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: briefings = [] } = useQuery({
    queryKey: ["project_briefings", projectId],
    queryFn: () => fetchProjectBriefings(projectId),
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["briefing_templates", "briefing"],
    queryFn: async () => (await fetchBriefingTemplates()).filter(t => t.template_type === "briefing" && t.active !== false),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["project_briefings", projectId] });

  const add = useMutation({
    mutationFn: (templateId: string | null) => {
      const tplName = templates.find(t => t.id === templateId)?.name;
      return createProjectBriefing(projectId, tplName ?? "Novo briefing", templateId);
    },
    onSuccess: (row) => { refresh(); setOpenId(row.id); },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: BriefingPatch }) =>
      updateProjectBriefing(id, {
        title: patch.title,
        template_id: patch.briefing_template_id,
        data: patch.briefing,
        status: patch.status,
      }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const dup = useMutation({
    mutationFn: (b: ProjectBriefing) => duplicateProjectBriefing(b),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteProjectBriefing(id),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const current = briefings.find(b => b.id === openId) ?? null;
  const s = strategy ?? {};
  const emptyPositioning =
    !description?.trim() && !s.audience && !s.tone && !s.value_prop && !s.positioning && !(s.essence ?? []).length;

  const progress = (b: ProjectBriefing) => {
    const tpl = templates.find(t => t.id === b.template_id);
    const fields = (tpl?.sections ?? []).flatMap(sec => sec.fields ?? []);
    if (!fields.length) return null;
    const filled = fields.filter(f => String((b.data as Record<string, string>)?.[f.key] ?? "").trim() !== "").length;
    return { filled, total: fields.length, pct: Math.round((filled / fields.length) * 100) };
  };

  return (
    <section className="p5-card">
      <div className="p5-card-h">
        <div className="p5-ht">
          <BookOpen />
          <span className="p5-card-t">Briefings</span>
          {briefings.length > 0 && (
            <span
              style={{
                fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
                background: "var(--primary-soft, color-mix(in oklab, var(--primary) 12%, transparent))",
                color: "var(--primary)",
              }}
            >
              {briefings.length}
            </span>
          )}
        </div>
        <button type="button" className="p5-link" onClick={() => add.mutate(null)}>
          <Plus style={{ width: 13, height: 13 }} /> Novo briefing
        </button>
      </div>

      {/* lista de briefings */}
      <div style={{ display: "grid", gap: 6 }}>
        {briefings.map(b => {
          const p = progress(b);
          return (
            <div
              key={b.id}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                border: "1px solid var(--border)", borderRadius: 9, background: "var(--card)",
              }}
            >
              <FileText style={{ width: 15, height: 15, color: "var(--primary)", flex: "0 0 15px" }} />
              <button
                type="button"
                onClick={() => setOpenId(b.id)}
                style={{ flex: 1, textAlign: "left", fontSize: 12.5, fontWeight: 600, color: "var(--foreground)", background: "none", border: 0, cursor: "pointer" }}
              >
                {b.title}
                <span style={{ display: "block", fontWeight: 400, fontSize: 10.5, color: "var(--muted-foreground)" }}>
                  {templates.find(t => t.id === b.template_id)?.name ?? "Sem modelo"}
                  {p ? ` · ${p.filled}/${p.total} respostas (${p.pct}%)` : ""}
                </span>
              </button>
              <span
                style={{
                  fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                  background: b.status === "done" ? "color-mix(in oklab, var(--success) 15%, transparent)" : "var(--muted)",
                  color: b.status === "done" ? "var(--success)" : "var(--muted-foreground)",
                }}
              >
                {b.status === "done" ? "Concluído" : "Rascunho"}
              </span>
              <button type="button" className="p5-ghost" title="Editar" onClick={() => setOpenId(b.id)}><Pencil /></button>
              <button type="button" className="p5-ghost" title="Duplicar" onClick={() => dup.mutate(b)}><Copy /></button>
              <button type="button" className="p5-ghost" title="Excluir" onClick={() => del.mutate(b.id)}><Trash2 /></button>
            </div>
          );
        })}

        {!briefings.length && (
          <button
            type="button"
            onClick={() => add.mutate(null)}
            style={{
              display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
              padding: "14px 12px", borderRadius: 10, cursor: "pointer",
              border: "1px dashed var(--border)", background: "transparent", color: "var(--muted-foreground)",
            }}
          >
            <Plus style={{ width: 16, height: 16, color: "var(--primary)" }} />
            <span style={{ fontSize: 12 }}>
              Nenhum briefing criado. Crie um por frente do projeto (marca, campanha, lançamento…).
            </span>
          </button>
        )}
      </div>

      {templates.length > 0 && (
        <div className="p5-foot" style={{ flexWrap: "wrap", gap: 6 }}>
          {templates.map(t => (
            <button key={t.id} type="button" onClick={() => add.mutate(t.id)}>
              <Plus /> {t.name}
            </button>
          ))}
        </div>
      )}

      {current && (
        <BriefingWindow
          key={current.id}
          open
          onClose={() => setOpenId(null)}
          projectName={projectName}
          title={current.title}
          status={current.status}
          description={description}
          strategy={s}
          briefing={current.data ?? {}}
          templateId={current.template_id}
          onSave={async (patch) => {
            await save.mutateAsync({ id: current.id, patch });
            onSavePositioning?.({ description: patch.description, strategy: patch.strategy });
          }}
        />
      )}
    </section>
  );
}
