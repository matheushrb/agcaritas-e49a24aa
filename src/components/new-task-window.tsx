import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  X, Plus, Trash2, Check, Info, ChevronDown, ListChecks, DollarSign,
  Paperclip, Save, Clock, CalendarDays, Layers, Trash, Minus, Maximize2, PanelRight,
} from "lucide-react";
import { useTaskTypeStages } from "@/lib/task-types";
import "@/windows.css";


type Stage = "briefing" | "creation" | "review" | "approval" | "delivery";
type StatusGroup = "todo" | "in_progress" | "review" | "done";
const STAGES: { id: Stage; label: string; status: StatusGroup }[] = [
  { id: "briefing", label: "Briefing", status: "todo" },
  { id: "creation", label: "Criação", status: "in_progress" },
  { id: "review", label: "Revisão", status: "review" },
  { id: "approval", label: "Aprovação", status: "review" },
  { id: "delivery", label: "Entrega", status: "done" },
];


const PRIORITIES = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
  { value: "critical", label: "Crítica" },
];

const STATUSES = [
  { value: "todo", label: "A fazer" },
  { value: "in_progress", label: "Em andamento" },
  { value: "review", label: "Revisão" },
  { value: "done", label: "Concluída" },
];

type DeliverableDraft = {
  id: string; platform: string; type: string;
  billing_enabled: boolean; billing_value: number | null; delivered: boolean;
  invoiced?: boolean;
};
type ChecklistDraft = { id: string; title: string; done: boolean };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const uid = () => Math.random().toString(36).slice(2, 9);

export function TaskWindow({
  open, onOpenChange, taskId = null, defaultProjectId = null, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Quando informado, a janela abre no modo edição da tarefa existente. */
  taskId?: string | null;
  defaultProjectId?: string | null;
  onCreated?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!taskId;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId);
  const [taskTypeId, setTaskTypeId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("todo");
  const [stage, setStage] = useState<Stage>("briefing");
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);

  const [estimated, setEstimated] = useState<string>("");
  const [billingEnabled, setBillingEnabled] = useState(true);
  const [baseValue, setBaseValue] = useState<string>("");
  const [deliverables, setDeliverables] = useState<DeliverableDraft[]>([]);
  const [checklist, setChecklist] = useState<ChecklistDraft[]>([]);
  const [platformsSel, setPlatformsSel] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects_min_platforms"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id,name,social_platforms").order("name");
      return (data ?? []) as { id: string; name: string; social_platforms: any }[];
    },
  });
  const { data: taskTypes = [] } = useQuery({
    queryKey: ["task_types_min"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("task_types").select("id,name,default_price,active").order("name");
      return ((data ?? []) as any[]).filter(t => t.active !== false);
    },
  });
  const { data: people = [] } = useQuery({
    queryKey: ["profiles_people"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,display_name").order("full_name");
      return (data ?? []) as { id: string; full_name: string; display_name: string | null }[];
    },
  });
  const { data: allPlatforms = [] } = useQuery({
    queryKey: ["platforms"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("platforms").select("id,name,active").order("sort_order");
      return ((data ?? []) as any[]).filter(p => p.active !== false);
    },
  });

  /* Plataformas disponíveis: apenas as do projeto; todas se a tarefa for avulsa. */
  const projectPlatformNames = useMemo(() => {
    const proj = projects.find(p => p.id === projectId);
    const raw = proj?.social_platforms;
    const arr: string[] = Array.isArray(raw)
      ? raw.map((x: any) => (typeof x === "string" ? x : x?.name ?? x?.platform ?? "")).filter(Boolean)
      : [];
    return arr;
  }, [projects, projectId]);

  const platforms = useMemo(() => {
    if (!projectId || projectPlatformNames.length === 0) return allPlatforms;
    const set = new Set(projectPlatformNames.map(n => n.toLowerCase()));
    const filtered = allPlatforms.filter((p: any) =>
      set.has(String(p.name).toLowerCase()) || set.has(String(p.id).toLowerCase()));
    return filtered.length ? filtered : allPlatforms;
  }, [allPlatforms, projectId, projectPlatformNames]);

  /* ---------- Etapas: do tipo de tarefa (quando houver) ou padrão ---------- */
  const { data: typeStages = [] } = useTaskTypeStages(taskTypeId);

  const flowSteps = useMemo(() => {
    if (typeStages.length) {
      return typeStages.map(s => ({ key: s.id, label: s.name, status: s.status_group as StatusGroup, stageId: s.id, stage: null as Stage | null }));
    }
    return STAGES.map(s => ({ key: s.id, label: s.label, status: s.status, stageId: null as string | null, stage: s.id }));
  }, [typeStages]);

  const activeIdx = useMemo(() => {
    const byId = typeStages.length
      ? flowSteps.findIndex(s => s.stageId === currentStageId)
      : flowSteps.findIndex(s => s.stage === stage);
    if (byId >= 0) return byId;
    const byStatus = flowSteps.findIndex(s => s.status === status);
    return byStatus >= 0 ? byStatus : 0;
  }, [flowSteps, typeStages.length, currentStageId, stage, status]);

  /* Selecionar uma etapa move o status condicionado a ela. */
  const selectStep = (i: number) => {
    const s = flowSteps[i];
    if (!s) return;
    setStatus(s.status);
    if (s.stageId) {
      setCurrentStageId(s.stageId);
      const eq = STAGES.find(x => x.status === s.status);
      if (eq) setStage(eq.id);
    } else if (s.stage) {
      setStage(s.stage);
      setCurrentStageId(null);
    }
  };

  /* Alterar o status leva a etapa para a primeira condicionada àquele status. */
  const changeStatus = (value: string) => {
    setStatus(value);
    const i = flowSteps.findIndex(s => s.status === value);
    if (i >= 0) {
      const s = flowSteps[i];
      if (s.stageId) setCurrentStageId(s.stageId);
      else if (s.stage) { setStage(s.stage); setCurrentStageId(null); }
    }
  };


  /* ---------- Carregar tarefa existente ---------- */
  const { data: existing } = useQuery({
    queryKey: ["task-window", taskId],
    enabled: !!taskId && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select("*")
        .eq("id", taskId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (!open) return;
    if (!isEdit) return;
    if (!existing) return;
    setTitle(existing.title ?? "");
    setDescription(existing.description ?? "");
    setProjectId(existing.project_id ?? null);
    setTaskTypeId(existing.task_type_id ?? null);
    setCurrentStageId(existing.current_stage_id ?? null);

    setAssigneeId(existing.assignee_id ?? null);
    setDueDate(existing.due_date ?? "");
    setPriority(existing.priority ?? "medium");
    setStatus(existing.status ?? "todo");
    setStage((existing.stage as Stage) ?? "briefing");
    setEstimated(existing.estimated_hours != null ? String(existing.estimated_hours) : "");
    setBillingEnabled(existing.billing_enabled !== false);
    setBaseValue(existing.billing_base_value != null ? String(existing.billing_base_value) : "");
    setDeliverables(
      (Array.isArray(existing.deliverables) ? existing.deliverables : []).map((d: any) => ({
        id: d.id ?? uid(),
        platform: d.platform ?? "",
        type: d.type ?? "",
        billing_enabled: d.billing_enabled !== false,
        billing_value: d.billing_value ?? null,
        delivered: !!d.delivered,
        invoiced: !!d.invoiced,
      })),
    );
    setChecklist(
      (Array.isArray(existing.subtasks) ? existing.subtasks : []).map((s: any) => ({
        id: s.id ?? uid(), title: s.title ?? "", done: !!s.done,
      })),
    );
    setPlatformsSel(existing.platform ? String(existing.platform).split(",").map((s: string) => s.trim()).filter(Boolean) : []);
    setNotes("");
  }, [existing, open, isEdit]);

  const deliverablesTotal = useMemo(
    () => deliverables.filter(d => d.billing_enabled).reduce((s, d) => s + (d.billing_value ?? 0), 0),
    [deliverables],
  );
  const baseNum = baseValue ? Number(baseValue) || 0 : 0;
  const billableTotal = baseNum + deliverablesTotal;
  const doneCount = checklist.filter(c => c.done).length;

  const reset = () => {
    setTitle(""); setDescription(""); setProjectId(defaultProjectId); setTaskTypeId(null);
    setAssigneeId(null); setDueDate(""); setPriority("medium"); setStatus("todo"); setStage("briefing"); setCurrentStageId(null);
    setEstimated(""); setBillingEnabled(true); setBaseValue(""); setDeliverables([]); setChecklist([]);
    setPlatformsSel([]); setNotes("");
  };
  const close = (o: boolean) => { onOpenChange(o); if (!o) reset(); };

  const payload = () => ({
    title: title.trim(),
    description: [description.trim(), notes.trim() && `\n\nObservações: ${notes.trim()}`].filter(Boolean).join("") || null,
    status: status as any,
    priority: priority as any,
    project_id: projectId,
    assignee_id: assigneeId,
    due_date: dueDate || null,
    stage: stage as any,
    current_stage_id: currentStageId,

    task_type_id: taskTypeId,
    estimated_hours: estimated ? Number(estimated) : null,
    billing_enabled: billingEnabled,
    billing_base_value: baseValue ? Number(baseValue) : null,
    billing_value: billableTotal || null,
    platform: platformsSel.join(", ") || null,
    deliverables: deliverables.map(d => ({
      id: d.id, platform: d.platform, type: d.type,
      billing_enabled: d.billing_enabled, billing_model: "per_task",
      billing_value: d.billing_value, delivered: d.delivered, invoiced: !!d.invoiced,
    })) as any,
    subtasks: checklist as any,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const { error } = await (supabase as any).from("tasks").update(payload()).eq("id", taskId!);
        if (error) throw error;
        return taskId!;
      }
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { data, error } = await (supabase as any).from("tasks")
        .insert({ ...payload(), organization_id: profile.organization_id })
        .select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["task-window", taskId] });
      toast.success(isEdit ? "Tarefa atualizada" : "Tarefa criada");
      if (!isEdit) onCreated?.(id);
      close(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa excluída");
      close(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [mode, setMode] = useState<"modal" | "docked" | "minimized">("modal");
  useEffect(() => { if (open) setMode("modal"); }, [open]);

  const canSave = title.trim().length > 0;

  const Title = ({ children }: { children: React.ReactElement }) =>
    mode === "modal" ? <DialogTitle asChild>{children}</DialogTitle> : children;

  if (!open) return null;

  if (mode === "minimized") {
    return (
      <div className="cw cw-mini">
        <span className="cw-title-icon"><ListChecks size={15} /></span>
        <span className="cw-mini-title">{title || (isEdit ? "Tarefa" : "Nova Tarefa")}</span>
        <button type="button" className="cw-close" onClick={() => setMode("modal")} aria-label="Restaurar"><Maximize2 size={16} /></button>
        <button type="button" className="cw-close" onClick={() => close(false)} aria-label="Fechar"><X size={16} /></button>
      </div>
    );
  }

  const windowEl = (
        <div className="cw-window">
          {/* HEADER */}
          <div className="cw-header">
            <span className="cw-title-icon"><ListChecks size={17} /></span>
            <div className="min-w-0 flex-1">
              <Title><h2>{isEdit ? (title || "Tarefa") : "Nova Tarefa"}</h2></Title>
              <p>{isEdit
                ? "Edite a tarefa, os entregáveis e acompanhe o fluxo de produção"
                : "Crie a tarefa, defina os entregáveis e acompanhe o fluxo de produção"}</p>
            </div>
            <div className="cw-head-actions">
              <button type="button" className="cw-btn cw-btn-primary cw-btn-sm" disabled={!canSave || save.isPending}
                onClick={() => save.mutate()}><Save /> {save.isPending ? "Salvando…" : "Salvar"}</button>
              {isEdit && (
                <button type="button" className="cw-close cw-close-danger" aria-label="Excluir" disabled={remove.isPending}
                  onClick={() => { if (confirm("Excluir esta tarefa?")) remove.mutate(); }}><Trash2 size={17} /></button>
              )}
              <button type="button" className="cw-close" onClick={() => setMode("minimized")} aria-label="Minimizar"><Minus size={18} /></button>
              <button type="button" className="cw-close" onClick={() => setMode(mode === "docked" ? "modal" : "docked")}
                aria-label="Lateralizar"><PanelRight size={17} /></button>
              <button type="button" className="cw-close" onClick={() => close(false)} aria-label="Fechar"><X size={18} /></button>
            </div>
          </div>


          {/* PROPRIEDADES COMPACTAS */}
          <div className="cw-props">
            <div className="cw-prop">
              <div className="cw-label">Projeto</div>
              <div className="cw-prop-value">
                <select value={projectId ?? ""} onChange={e => setProjectId(e.target.value || null)}>
                  <option value="">Sem projeto</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown size={14} style={{ color: "var(--cw-muted)", flexShrink: 0 }} />
              </div>
            </div>
            <div className="cw-prop">
              <div className="cw-label">Tipo de tarefa</div>
              <div className="cw-prop-value">
                <select value={taskTypeId ?? ""} onChange={e => setTaskTypeId(e.target.value || null)}>
                  <option value="">Selecione</option>
                  {taskTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <ChevronDown size={14} style={{ color: "var(--cw-muted)", flexShrink: 0 }} />
              </div>
            </div>
            <div className="cw-prop">
              <div className="cw-label">Responsável</div>
              <div className="cw-prop-value">
                <select value={assigneeId ?? ""} onChange={e => setAssigneeId(e.target.value || null)}>
                  <option value="">Não atribuído</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.display_name || p.full_name}</option>)}
                </select>
                <ChevronDown size={14} style={{ color: "var(--cw-muted)", flexShrink: 0 }} />
              </div>
            </div>
            <div className="cw-prop">
              <div className="cw-label">Prazo</div>
              <div className="cw-prop-value">
                <CalendarDays size={14} style={{ color: "var(--cw-muted)", flexShrink: 0 }} />
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="cw-prop">
              <div className="cw-label">Prioridade</div>
              <div className="cw-prop-value">
                <select value={priority} onChange={e => setPriority(e.target.value)}>
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <ChevronDown size={14} style={{ color: "var(--cw-muted)", flexShrink: 0 }} />
              </div>
            </div>
          </div>

          {/* FLUXO DE ETAPAS */}
          <div className="cw-flow">
            {flowSteps.map((s, i) => (
              <div key={s.key} className={`cw-flow-step${i === activeIdx ? " is-on" : ""}${i < activeIdx ? " is-done" : ""}`}>
                <button type="button" className="cw-flow-dot" onClick={() => selectStep(i)}
                  title={`Move o status para: ${STATUSES.find(x => x.value === s.status)?.label ?? s.status}`}>
                  {i < activeIdx ? <Check size={13} /> : i + 1}
                </button>
                <span className="cw-flow-label">{s.label}</span>
              </div>
            ))}
          </div>


          {/* CORPO */}
          <div className="cw-task-body">
            <div>
              <div className="cw-field">
                <span className="cw-label">Título da tarefa<span className="req">*</span></span>
                <input className="cw-input" autoFocus value={title} maxLength={140}
                  onChange={e => setTitle(e.target.value)} placeholder="Ex.: Reels institucional — roteiro e gravação" />
              </div>

              <div className="cw-field" style={{ marginTop: 14 }}>
                <span className="cw-label">Descrição / briefing</span>
                <textarea className="cw-textarea" rows={4} value={description}
                  onChange={e => setDescription(e.target.value)} placeholder="Contexto, referências e o que precisa ser entregue..." />
              </div>

              {/* ENTREGÁVEIS */}
              <div className="cw-section">
                <div className="cw-section-head">
                  <div>
                    <h4>Entregáveis</h4>
                    <p>Somente entregáveis marcados como entregues podem ser faturados.</p>
                  </div>
                  <button type="button" className="cw-btn cw-btn-secondary sm"
                    onClick={() => setDeliverables(d => [...d, { id: uid(), platform: platformsSel[0] ?? "", type: "", billing_enabled: billingEnabled, billing_value: null, delivered: false }])}>
                    <Plus /> Adicionar entregável
                  </button>
                </div>
                <table className="cw-table">
                  <thead>
                    <tr>
                      <th style={{ width: 150 }}>Plataforma</th>
                      <th>Formato / entrega</th>
                      <th style={{ width: 110 }}>Faturável</th>
                      <th style={{ width: 120 }}>Valor</th>
                      <th style={{ width: 100 }}>Entregue</th>
                      <th style={{ width: 56 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {deliverables.length === 0 && (
                      <tr><td colSpan={6} className="cw-mut" style={{ textAlign: "center" }}>Nenhum entregável adicionado.</td></tr>
                    )}
                    {deliverables.map(d => (
                      <tr key={d.id}>
                        <td>
                          <select className="cw-table-inline-input" value={d.platform}
                            onChange={e => setDeliverables(list => list.map(x => x.id === d.id ? { ...x, platform: e.target.value } : x))}>
                            <option value="">—</option>
                            {platforms.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <input className="cw-table-inline-input" value={d.type} placeholder="Ex.: Reels 60s"
                            onChange={e => setDeliverables(list => list.map(x => x.id === d.id ? { ...x, type: e.target.value } : x))} />
                        </td>
                        <td>
                          <input type="checkbox" checked={d.billing_enabled}
                            onChange={e => setDeliverables(list => list.map(x => x.id === d.id ? { ...x, billing_enabled: e.target.checked } : x))} />
                        </td>
                        <td>
                          <input type="number" step="0.01" className="cw-table-inline-input" value={d.billing_value ?? ""} placeholder="0,00"
                            onChange={e => setDeliverables(list => list.map(x => x.id === d.id ? { ...x, billing_value: e.target.value ? Number(e.target.value) : null } : x))} />
                        </td>
                        <td>
                          <input type="checkbox" checked={d.delivered}
                            onChange={e => setDeliverables(list => list.map(x => x.id === d.id ? { ...x, delivered: e.target.checked } : x))} />
                        </td>
                        <td>
                          <button type="button" className="cw-row-icon" onClick={() => setDeliverables(list => list.filter(x => x.id !== d.id))}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* CHECKLIST */}
              <div className="cw-section">
                <div className="cw-mini-head">
                  <h5>Checklist {checklist.length > 0 && <span style={{ color: "var(--cw-muted)", fontWeight: 400 }}>({doneCount}/{checklist.length})</span>}</h5>
                  <button type="button" className="cw-link" onClick={() => setChecklist(c => [...c, { id: uid(), title: "", done: false }])}>
                    <Plus size={13} /> Adicionar item
                  </button>
                </div>
                {checklist.length === 0 && <div style={{ fontSize: 11, color: "var(--cw-muted)" }}>Nenhum item de checklist.</div>}
                {checklist.map(c => (
                  <div key={c.id} className={`cw-check-item${c.done ? " is-done" : ""}`}>
                    <input type="checkbox" checked={c.done}
                      onChange={e => setChecklist(list => list.map(x => x.id === c.id ? { ...x, done: e.target.checked } : x))} />
                    <input type="text" value={c.title} placeholder="Descreva o item"
                      onChange={e => setChecklist(list => list.map(x => x.id === c.id ? { ...x, title: e.target.value } : x))} />
                    <button type="button" className="cw-row-icon" onClick={() => setChecklist(list => list.filter(x => x.id !== c.id))}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>

              {/* PLATAFORMAS / CANAIS */}
              <div className="cw-section">
                <div className="cw-section-head">
                  <div>
                    <h4>Plataformas e canais</h4>
                    <p>{projectId && projectPlatformNames.length > 0
                      ? "Apenas as plataformas cadastradas no projeto."
                      : projectId
                        ? "Projeto sem plataformas cadastradas — exibindo todas."
                        : "Tarefa avulsa: todas as plataformas disponíveis."}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {platforms.map((p: any) => {
                    const on = platformsSel.includes(p.name);
                    return (
                      <button key={p.id} type="button" className={`cw-chip${on ? "" : " is-neutral"}`}
                        onClick={() => setPlatformsSel(s => on ? s.filter(x => x !== p.name) : [...s, p.name])}>
                        {on && <Check size={12} />} {p.name}
                      </button>
                    );
                  })}
                  {platforms.length === 0 && <span style={{ fontSize: 11, color: "var(--cw-muted)" }}>Cadastre plataformas em Configurações.</span>}
                </div>
              </div>

              {/* ANEXOS */}
              <div className="cw-section">
                <div className="cw-section-head"><div><h4>Anexos</h4></div></div>
                <div className="cw-card cw-card-pad flex items-center gap-3" style={{ borderStyle: "dashed" }}>
                  <Paperclip size={16} style={{ color: "var(--cw-muted)" }} />
                  <span style={{ fontSize: 11.5, color: "var(--cw-muted)" }}>
                    Os arquivos podem ser anexados na aba Arquivos do projeto.
                  </span>
                </div>
              </div>
            </div>

            {/* COLUNA LATERAL */}
            <div className="cw-side">
              <div className="cw-side-card">
                <h5><Layers size={15} /> Resumo</h5>
                <div className="cw-field" style={{ marginBottom: 8 }}>
                  <span className="cw-label">Status</span>
                  <select className="cw-input" value={status} onChange={e => changeStatus(e.target.value)}>
                    {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="cw-side-line"><span>Etapa atual</span><span>{flowSteps[activeIdx]?.label ?? "—"}</span></div>
                <div className="cw-side-line"><span>Entregáveis</span><span>{deliverables.length}</span></div>
                <div className="cw-side-line"><span>Checklist</span><span>{doneCount}/{checklist.length}</span></div>
                <div className="cw-side-line"><span>Plataformas</span><span>{platformsSel.length}</span></div>
              </div>

              <div className="cw-side-card">
                <h5><DollarSign size={15} /> Faturamento</h5>
                <div className="cw-switch-row" style={{ padding: 0 }}>
                  <span className="cw-sw-title" style={{ fontSize: 11.5 }}>Tarefa faturável</span>
                  <button type="button" className={`cw-switch${billingEnabled ? " is-on" : ""}`} onClick={() => setBillingEnabled(b => !b)} />
                </div>
                <div className="cw-field" style={{ marginTop: 10 }}>
                  <span className="cw-label">Valor base da tarefa</span>
                  <input className="cw-input" type="number" step="0.01" value={baseValue}
                    onChange={e => setBaseValue(e.target.value)} placeholder="0,00" />
                  <span className="cw-hint">Os entregáveis faturáveis somam a este valor.</span>
                </div>
                <div className="cw-side-line" style={{ marginTop: 6 }}>
                  <span>Entregáveis</span><span>{brl(deliverablesTotal)}</span>
                </div>
                <div className="cw-side-total">
                  <div className="cw-side-line" style={{ padding: 0 }}>
                    <span>Valor previsto</span><span>{brl(billableTotal)}</span>
                  </div>
                </div>
              </div>

              <div className="cw-side-card">
                <h5><Clock size={15} /> Estimativa</h5>
                <input className="cw-input" type="number" step="0.5" value={estimated}
                  onChange={e => setEstimated(e.target.value)} placeholder="Horas estimadas" />
              </div>

              <div className="cw-side-card">
                <h5><Info size={15} /> Observações</h5>
                <textarea className="cw-textarea" rows={3} value={notes}
                  onChange={e => setNotes(e.target.value)} placeholder="Notas internas" />
              </div>
            </div>
          </div>

          {/* RODAPÉ */}
          <div className="cw-footer">
            <div className="cw-foot-group">
              <button type="button" className="cw-btn cw-btn-secondary" onClick={() => close(false)}>Cancelar</button>
              {isEdit && (
                <button type="button" className="cw-btn cw-btn-ghost" style={{ color: "var(--cw-danger)" }}
                  disabled={remove.isPending}
                  onClick={() => { if (confirm("Excluir esta tarefa?")) remove.mutate(); }}>
                  <Trash /> Excluir
                </button>
              )}
            </div>
            <div className="cw-foot-group">
              <button type="button" className="cw-btn cw-btn-primary" disabled={!canSave || save.isPending}
                onClick={() => save.mutate()}>
                {save.isPending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar tarefa"}{" "}
                {isEdit ? <Save /> : <Check />}
              </button>
            </div>
          </div>
        </div>
  );

  if (mode === "docked") {
    return (
      <>
        <div className="cw-dock-backdrop" onClick={() => setMode("minimized")} />
        <aside className="cw cw-dock">{windowEl}</aside>
      </>
    );
  }

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent
        className="cw cw-shell p-0 gap-0 border-0 overflow-hidden [&>button:last-of-type]:hidden w-[calc(100vw-2rem)] max-w-[1180px] sm:max-w-[1180px]"
        style={{ boxShadow: "0 24px 60px rgba(15,25,40,.20)" }}
      >
        {windowEl}
      </DialogContent>
    </Dialog>
  );
}


/** Compatibilidade: janela de criação. */
export function NewTaskWindow(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultProjectId?: string | null;
  onCreated?: (id: string) => void;
}) {
  return <TaskWindow {...props} taskId={null} />;
}
