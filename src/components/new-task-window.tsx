import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  X, Plus, Trash2, Check, Info, ChevronDown, ListChecks, DollarSign,
  Paperclip, Save, Clock, CalendarDays, Layers, Trash, Minus, Maximize2, PanelRight,
  Play, Square, Radio, SlidersHorizontal, FileText,
} from "lucide-react";
import { BriefingForm } from "@/components/briefing-form";
import { fetchBriefingTemplates, briefingProgress, type BriefingData } from "@/lib/briefing";

import { useTaskTypeStages } from "@/lib/task-types";
import { CwDate, CwDateRange } from "@/components/cw-date";
import { UnsavedChangesDialog, ConfirmDeleteDialog } from "@/components/confirm-dialogs";
import { syncChargesFromTask } from "@/lib/billing-sync";
import { computeStageWindows, stageAlert, fmtBr, type StageWindow } from "@/lib/stage-schedule";

import "@/windows.css";

const EMPTY_ARR: any[] = [];



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
  { value: "todo", label: "A fazer", color: "#7F8C9E" },
  { value: "in_progress", label: "Em andamento", color: "#2F6BEF" },
  { value: "review", label: "Revisão", color: "#E0912F" },
  { value: "done", label: "Concluída", color: "#1FA971" },
];
const statusColor = (v: string) => STATUSES.find(s => s.value === v)?.color ?? "#7F8C9E";

/** Cor por etapa (usada quando a etapa não define cor própria). */
const STAGE_PALETTE = ["#7F8C9E", "#8B5CF6", "#EF4444", "#0EA5E9", "#F97316", "#1FA971", "#2F6BEF", "#D946EF"];


type DeliverableDraft = {
  id: string; platform: string; type: string;
  billing_enabled: boolean; billing_value: number | null; delivered: boolean;
  /** Data combinada para a entrega (prazo). */
  due_date?: string | null;
  /** Data em que a entrega foi efetivamente confirmada. */
  delivered_at?: string | null;
  invoiced?: boolean;
};

/** Anexo da tarefa (arquivo no armazenamento). */
type AttachmentDraft = {
  id: string; path: string; name: string; type: string; size: number; is_image: boolean;
};

type ChecklistDraft = { id: string; title: string; done: boolean };

/** Subtarefa real (linha própria em tasks, com parent_task_id) — pode ter tipo e valor próprios. */
type SubtaskDraft = {
  id: string;
  rowId: string | null;
  title: string;
  task_type_id: string | null;
  value: number | null;
  status: string;
  due_date: string | null;
};

/** Ao Vivo / Estreia — transmissões ligadas à tarefa. */
type LiveDraft = {
  id: string; title: string; kind: "live" | "premiere"; platform: string;
  date: string | null; time: string; duration_min: number | null;
  status: "scheduled" | "live" | "aired" | "cancelled";
  url: string; notes: string;
};
const LIVE_KINDS = [
  { value: "live", label: "Ao Vivo" },
  { value: "premiere", label: "Estreia" },
];
const LIVE_STATUS = [
  { value: "scheduled", label: "Agendado", color: "#7F8C9E" },
  { value: "live", label: "No ar", color: "#E5484D" },
  { value: "aired", label: "Exibido", color: "#1FA971" },
  { value: "cancelled", label: "Cancelado", color: "#F97316" },
];

/** Ficha técnica — informações técnicas de captação, edição e arte. */
type TechSheet = {
  category: string;
  aspect_ratio: string; resolution: string; fps: string; codec: string; duration: string;
  camera: string; lens: string; lighting: string; audio: string; location: string;
  edit_notes: string; color_notes: string; subtitles: string; deliver_format: string;
  art_size: string; art_dpi: string; art_color_mode: string; art_bleed: string;
  art_usage: string; art_fonts: string; art_palette: string;
  extra: string;
};
const EMPTY_TECH: TechSheet = {
  category: "video", aspect_ratio: "", resolution: "", fps: "", codec: "", duration: "",
  camera: "", lens: "", lighting: "", audio: "", location: "",
  edit_notes: "", color_notes: "", subtitles: "", deliver_format: "",
  art_size: "", art_dpi: "", art_color_mode: "", art_bleed: "",
  art_usage: "", art_fonts: "", art_palette: "", extra: "",
};
const TECH_CATEGORIES = [
  { value: "video", label: "Vídeo / Captação" },
  { value: "broadcast", label: "Transmissão ao vivo" },
  { value: "graphic", label: "Gráfico / Arte" },
  { value: "audio", label: "Áudio" },
  { value: "other", label: "Outro" },
];


const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const uid = () => Math.random().toString(36).slice(2, 9);

export function TaskWindow({
  open, onOpenChange, taskId = null, defaultProjectId = null, defaultTaskTypeId = null, defaultTitle = "", onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Quando informado, a janela abre no modo edição da tarefa existente. */
  taskId?: string | null;
  defaultProjectId?: string | null;
  /** Tipo de tarefa pré-selecionado ao criar (ex.: tarefa base do tipo de projeto). */
  defaultTaskTypeId?: string | null;
  defaultTitle?: string;
  onCreated?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!taskId;

  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId);
  const [taskTypeId, setTaskTypeId] = useState<string | null>(defaultTaskTypeId);

  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("todo");
  const [stage, setStage] = useState<Stage>("briefing");
  const [currentStageId, setCurrentStageId] = useState<string | null>(null);

  const [estimated, setEstimated] = useState<string>("");
  const [billingEnabled, setBillingEnabled] = useState(true);
  const [baseValue, setBaseValue] = useState<string>("");
  const [deliverables, setDeliverables] = useState<DeliverableDraft[]>([]);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const [checklist, setChecklist] = useState<ChecklistDraft[]>([]);
  const [subtasks, setSubtasks] = useState<SubtaskDraft[]>([]);
  const [removedSubtaskIds, setRemovedSubtaskIds] = useState<string[]>([]);
  const [platformsSel, setPlatformsSel] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [liveItems, setLiveItems] = useState<LiveDraft[]>([]);
  const [tech, setTech] = useState<TechSheet>(EMPTY_TECH);
  const [tab, setTab] = useState<"details" | "work" | "files" | "briefing" | "live" | "tech">("details");
  const [headOpen, setHeadOpen] = useState(false);

  const [briefingTemplateId, setBriefingTemplateId] = useState<string | null>(null);
  const [briefingData, setBriefingData] = useState<BriefingData>({});
  const setT = (k: keyof TechSheet, v: string) => setTech(t => ({ ...t, [k]: v }));


  const { data: projects = EMPTY_ARR } = useQuery({
    queryKey: ["projects_min_platforms"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id,name,client_id,social_platforms").order("name");
      return (data ?? []) as { id: string; name: string; client_id: string | null; social_platforms: any }[];
    },
  });
  const { data: taskTypes = EMPTY_ARR } = useQuery({
    queryKey: ["task_types_min_v2"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("task_types").select("id,name,default_price,active,has_broadcast,has_live,has_tech_sheet,briefing_template_id").order("name");
      return ((data ?? []) as any[]).filter(t => t.active !== false);
    },
  });
  const { data: briefingTemplates = EMPTY_ARR } = useQuery({
    queryKey: ["briefing_templates"],
    queryFn: fetchBriefingTemplates,
  });
  const { data: people = EMPTY_ARR } = useQuery({
    queryKey: ["profiles_people"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,display_name").order("full_name");
      return (data ?? []) as { id: string; full_name: string; display_name: string | null }[];
    },
  });
  const { data: allPlatforms = EMPTY_ARR } = useQuery({
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
    return allPlatforms.filter((p: any) =>
      set.has(String(p.name).toLowerCase()) || set.has(String(p.id).toLowerCase()));
  }, [allPlatforms, projectId, projectPlatformNames]);

  /* Remove seleções que não pertencem mais às plataformas do projeto. */
  useEffect(() => {
    if (!projectId || projectPlatformNames.length === 0) return;
    const allowed = new Set(platforms.map((p: any) => String(p.name)));
    setPlatformsSel(sel => (sel.every(s => allowed.has(s)) ? sel : sel.filter(s => allowed.has(s))));
  }, [projectId, platforms, projectPlatformNames.length]);

  /* ---------- Abas opcionais conforme o tipo de tarefa ---------- */
  const activeType = useMemo(
    () => (taskTypes as any[]).find(t => t.id === taskTypeId),
    [taskTypes, taskTypeId],
  );
  const showLiveTab = !!activeType?.has_live || liveItems.length > 0;
  const briefingTpl = useMemo(
    () => briefingTemplates.find(t => t.id === briefingTemplateId) ?? null,
    [briefingTemplates, briefingTemplateId],
  );
  const briefingFilled = briefingProgress(briefingTpl, briefingData).filled > 0;
  const showTechTab = !!activeType?.has_tech_sheet || Object.values(tech ?? {}).some(v => String(v ?? "").trim() !== "");
  const techFilled = useMemo(
    () => Object.entries(tech).some(([k, v]) => k !== "category" && String(v ?? "").trim() !== ""),
    [tech],
  );

  useEffect(() => {
    if ((tab === "live" && !showLiveTab) || (tab === "tech" && !showTechTab)) setTab("details");
  }, [tab, showLiveTab, showTechTab]);


  /* Modelo de briefing sugerido pelo tipo de tarefa. */
  useEffect(() => {
    if (!activeType?.briefing_template_id) return;
    setBriefingTemplateId(prev => prev ?? activeType.briefing_template_id);
  }, [activeType?.briefing_template_id]);

  /* ---------- Etapas: do tipo de tarefa (quando houver) ou padrão ---------- */
  const { data: typeStages = EMPTY_ARR } = useTaskTypeStages(taskTypeId);

  const flowSteps = useMemo(() => {
    if (typeStages.length) {
      return typeStages.map((s, i) => ({
        key: s.id, label: s.name, status: s.status_group as StatusGroup,
        stageId: s.id, stage: null as Stage | null,
        color: s.color || STAGE_PALETTE[i % STAGE_PALETTE.length],
      }));
    }
    return STAGES.map((s, i) => ({
      key: s.id, label: s.label, status: s.status,
      stageId: null as string | null, stage: s.id,
      color: STAGE_PALETTE[i % STAGE_PALETTE.length],
    }));
  }, [typeStages]);

  const activeIdx = useMemo(() => {
    const byId = typeStages.length
      ? flowSteps.findIndex(s => s.stageId === currentStageId)
      : flowSteps.findIndex(s => s.stage === stage);
    if (byId >= 0) return byId;
    const byStatus = flowSteps.findIndex(s => s.status === status);
    return byStatus >= 0 ? byStatus : 0;
  }, [flowSteps, typeStages.length, currentStageId, stage, status]);

  /* ---------- Prazos relativos das etapas ---------- */
  const stageWindows = useMemo(
    () => computeStageWindows(dueDate || null, (typeStages as any[]).map(s => ({
      id: s.id, name: s.name, color: s.color,
      start_offset_days: s.start_offset_days ?? null,
      end_offset_days: s.end_offset_days ?? null,
    }))),
    [typeStages, dueDate],
  );
  const stageWindowById = useMemo(() => {
    const m: Record<string, StageWindow> = {};
    for (const w of stageWindows) m[w.stageId] = w;
    return m;
  }, [stageWindows]);
  const stageAlerts = useMemo(() => {
    const out: Record<string, ReturnType<typeof stageAlert>> = {};
    flowSteps.forEach((s, i) => {
      if (!s.stageId) return;
      const w = stageWindowById[s.stageId];
      if (!w) return;
      const pos: -1 | 0 | 1 = i < activeIdx ? -1 : i === activeIdx ? 0 : 1;
      out[s.stageId] = stageAlert(w, pos);
    });
    return out;
  }, [flowSteps, stageWindowById, activeIdx]);
  const currentStageAlert = currentStageId ? stageAlerts[currentStageId] : null;


  /* Selecionar uma etapa move o status condicionado a ela. */
  const selectStep = (i: number) => {
    const s = flowSteps[i];
    if (!s) return;
    setStatus(s.status);
    if (s.stageId) {
      setCurrentStageId(s.stageId);
      const eq = STAGES.find(x => x.status === s.status);
      if (eq) setStage(eq.id);
      clearOtherStageAutomations(s.stageId);
      applyStageAutomations(s.stageId);
    } else if (s.stage) {
      setStage(s.stage);
      setCurrentStageId(null);
      clearOtherStageAutomations(null);
    }
  };

  const norm = (v: any) => String(v ?? "").trim().toLowerCase();

  /**
   * Remove os itens que foram gerados automaticamente por OUTRAS etapas.
   * Só some o que corresponde à configuração de automação de outra etapa —
   * itens criados à mão pelo usuário permanecem.
   */
  const clearOtherStageAutomations = (keepStageId: string | null) => {
    const others = (typeStages as any[]).filter(s => s.id !== keepStageId);
    if (!others.length) return;
    const keep: any = keepStageId ? (typeStages as any[]).find(s => s.id === keepStageId) : null;


    const gather = (key: string, pick: (item: any) => string) => {
      const drop = new Set<string>();
      for (const s of others) for (const it of (Array.isArray(s[key]) ? s[key] : [])) drop.add(pick(it));
      const kept = new Set<string>();
      if (keep) for (const it of (Array.isArray(keep[key]) ? keep[key] : [])) kept.add(pick(it));
      return (v: string) => drop.has(v) && !kept.has(v);
    };

    const dropChk = gather("auto_checklist", (t: any) => norm(t));
    const dropDel = gather("auto_deliverables", (d: any) => norm(d?.label || d?.platform));
    const dropLive = gather("auto_live", (l: any) => norm(l?.title));
    const dropSub = gather("auto_subtasks", (s: any) => norm(s?.title));

    setChecklist(prev => prev.filter(c => !dropChk(norm(c.title))));
    setDeliverables(prev => prev.filter(d => d.invoiced || !dropDel(norm(d.platform))));
    setLiveItems(prev => prev.filter(l => !dropLive(norm(l.title))));
    setSubtasks(prev => {
      const removed = prev.filter(s => dropSub(norm(s.title)));
      if (removed.length) {
        const ids = removed.map(s => s.rowId).filter(Boolean) as string[];
        if (ids.length) setRemovedSubtaskIds(cur => [...cur, ...ids]);
      }
      return prev.filter(s => !dropSub(norm(s.title)));
    });
  };

  /** Cria checklist, entregáveis e transmissões configurados no modelo da etapa. */
  const applyStageAutomations = (stageId: string) => {
    const row: any = typeStages.find(x => x.id === stageId);
    if (!row) return;
    let created = 0;

    const autoChk: string[] = Array.isArray(row.auto_checklist) ? row.auto_checklist : [];
    if (autoChk.length) {
      setChecklist(prev => {
        const seen = new Set(prev.map(c => c.title.trim().toLowerCase()));
        const add = autoChk
          .map(t => String(t).trim())
          .filter(t => t && !seen.has(t.toLowerCase()))
          .map(title => ({ id: uid(), title, done: false }));
        created += add.length;
        return add.length ? [...prev, ...add] : prev;
      });
    }

    const autoDel: any[] = Array.isArray(row.auto_deliverables) ? row.auto_deliverables : [];
    if (autoDel.length) {
      setDeliverables(prev => {
        const seen = new Set(prev.map(d => `${(d.platform ?? "").trim().toLowerCase()}|${(d.type ?? "").trim().toLowerCase()}`));
        const add = autoDel
          .filter(d => d && (d.label || d.platform))
          .filter(d => {
            const key = `${String(d.label || d.platform).trim().toLowerCase()}|${String(d.type ?? "").trim().toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .map(d => ({
            id: uid(),
            platform: String(d.label || d.platform || ""),
            type: String(d.type || "other"),
            billing_enabled: !!d.value,
            billing_value: d.value ?? null,
            delivered: false,
          }));
        created += add.length;
        return add.length ? [...prev, ...add] : prev;
      });
    }

    const autoLive: any[] = Array.isArray(row.auto_live) ? row.auto_live : [];
    if (autoLive.length) {
      setLiveItems(prev => {
        const seen = new Set(prev.map(l => l.title.trim().toLowerCase()));
        const add = autoLive
          .filter(l => l && l.title && !seen.has(String(l.title).trim().toLowerCase()))
          .map(l => ({
            id: uid(),
            title: String(l.title),
            kind: (l.kind === "premiere" ? "premiere" : "live") as LiveDraft["kind"],
            platform: String(l.platform || ""),
            date: null,
            time: "",
            duration_min: null,
            status: "scheduled" as LiveDraft["status"],
            url: "",
            notes: "",
          }));
        created += add.length;
        return add.length ? [...prev, ...add] : prev;
      });
    }

    const autoSub: any[] = Array.isArray(row.auto_subtasks) ? row.auto_subtasks : [];
    if (autoSub.length) {
      setSubtasks(prev => {
        const seen = new Set(prev.map(s => s.title.trim().toLowerCase()));
        const add = autoSub
          .filter(s => s && s.title && !seen.has(String(s.title).trim().toLowerCase()))
          .map(s => ({
            id: uid(),
            rowId: null,
            title: String(s.title),
            task_type_id: s.task_type_id ?? null,
            value: s.value ?? null,
            status: "todo",
            due_date: null,
          }));
        created += add.length;
        return add.length ? [...prev, ...add] : prev;
      });
    }

    if (created) toast.success(`${created} item(ns) criados pela etapa “${row.name}”`);
  };

  /* Nova tarefa com modelo: já entra na 1ª etapa do tipo e aplica as automações. */
  const [seededStageType, setSeededStageType] = useState<string | null>(null);
  useEffect(() => {
    if (!open || isEdit) return;
    if (!taskTypeId || typeStages.length === 0) return;
    if (seededStageType === taskTypeId) return;
    const first: any = typeStages[0];
    setSeededStageType(taskTypeId);
    setCurrentStageId(first.id);
    setStatus(first.status_group ?? "todo");
    clearOtherStageAutomations(first.id);
    applyStageAutomations(first.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, taskTypeId, typeStages]);



  /* Alterar o status leva a etapa para a primeira condicionada àquele status. */
  const changeStatus = (value: string) => {
    setStatus(value);
    const i = flowSteps.findIndex(s => s.status === value);
    if (i >= 0) {
      const s = flowSteps[i];
      if (s.stageId) { setCurrentStageId(s.stageId); clearOtherStageAutomations(s.stageId); }
      else if (s.stage) { setStage(s.stage); setCurrentStageId(null); clearOtherStageAutomations(null); }
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

  /* Subtarefas reais (linhas em tasks com parent_task_id). */
  const { data: childRows = EMPTY_ARR } = useQuery({
    queryKey: ["task-subtasks", taskId],
    enabled: !!taskId && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select("id,title,task_type_id,billing_value,billing_base_value,status,due_date")
        .eq("parent_task_id", taskId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  useEffect(() => {
    if (!open || !isEdit) return;
    setSubtasks(childRows.map((r: any) => ({
      id: r.id,
      rowId: r.id,
      title: r.title ?? "",
      task_type_id: r.task_type_id ?? null,
      value: r.billing_base_value ?? r.billing_value ?? null,
      status: r.status ?? "todo",
      due_date: r.due_date ?? null,
    })));
    setRemovedSubtaskIds([]);
  }, [childRows, open, isEdit]);


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
    setStartDate(existing.start_date ?? "");
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
        due_date: d.due_date ?? null,
        delivered_at: d.delivered_at ?? null,
        invoiced: !!d.invoiced,
      })),
    );
    setAttachments(
      (Array.isArray((existing as any).attachments) ? (existing as any).attachments : []).map((a: any) => ({
        id: a.id ?? uid(), path: a.path ?? "", name: a.name ?? "arquivo",
        type: a.type ?? "", size: a.size ?? 0, is_image: !!a.is_image,
      })),
    );
    setCoverPath((existing as any).cover_url ?? null);

    setChecklist(
      (Array.isArray(existing.subtasks) ? existing.subtasks : []).map((s: any) => ({
        id: s.id ?? uid(), title: s.title ?? "", done: !!s.done,
      })),
    );
    setPlatformsSel(existing.platform ? String(existing.platform).split(",").map((s: string) => s.trim()).filter(Boolean) : []);
    setLiveItems(
      (Array.isArray(existing.live_items) ? existing.live_items : []).map((l: any) => ({
        id: l.id ?? uid(), title: l.title ?? "", kind: (l.kind === "premiere" ? "premiere" : "live"),
        platform: l.platform ?? "", date: l.date ?? null, time: l.time ?? "",
        duration_min: l.duration_min ?? null,
        status: (["scheduled", "live", "aired", "cancelled"].includes(l.status) ? l.status : "scheduled"),
        url: l.url ?? "", notes: l.notes ?? "",
      })) as LiveDraft[],
    );
    setBriefingTemplateId(existing.briefing_template_id ?? null);
    setBriefingData(existing.briefing && typeof existing.briefing === "object" ? existing.briefing : {});
    setTech({ ...EMPTY_TECH, ...(existing.tech_sheet && typeof existing.tech_sheet === "object" ? existing.tech_sheet : {}) });
    setNotes("");

  }, [existing, open, isEdit]);

  const deliverablesTotal = useMemo(
    () => deliverables.filter(d => d.billing_enabled).reduce((s, d) => s + (d.billing_value ?? 0), 0),
    [deliverables],
  );
  const baseNum = baseValue ? Number(baseValue) || 0 : 0;
  const billableTotal = baseNum + deliverablesTotal;
  const doneCount = checklist.filter(c => c.done).length;

  /* ---------- Progresso: 50% etapa + 50% checklist ---------- */
  const stagePct = useMemo(() => {
    const total = flowSteps.length || 1;
    if (status === "done") return 100;
    return Math.round((activeIdx / Math.max(1, total - 1)) * 100);
  }, [flowSteps.length, activeIdx, status]);
  const checklistPct = checklist.length ? Math.round((doneCount / checklist.length) * 100) : null;
  const progress = useMemo(() => {
    if (status === "done") return 100;
    if (checklistPct === null) return stagePct;
    return Math.round(stagePct * 0.5 + checklistPct * 0.5);
  }, [status, stagePct, checklistPct]);

  /* ---------- Timesheet ---------- */
  const { data: timeEntries = EMPTY_ARR } = useQuery({
    queryKey: ["task-time-entries", taskId],
    enabled: !!taskId && open,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("time_entries")
        .select("id,duration_seconds,started_at,created_at")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: false });
      return (data ?? []) as { id: string; duration_seconds: number; started_at: string | null; created_at: string }[];
    },
  });
  const totalSeconds = timeEntries.reduce((s, e) => s + (e.duration_seconds ?? 0), 0);
  const fmtHours = (sec: number) => `${Math.floor(sec / 3600)}h ${String(Math.round((sec % 3600) / 60)).padStart(2, "0")}m`;
  const [tsHours, setTsHours] = useState("");
  const [tsDate, setTsDate] = useState(() => new Date().toISOString().slice(0, 10));


  const addTime = useMutation({
    mutationFn: async () => {
      const h = Number(tsHours.replace(",", "."));
      if (!h || h <= 0) throw new Error("Informe as horas");
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("time_entries").insert({
        organization_id: profile.organization_id,
        task_id: taskId,
        user_id: auth.user?.id ?? null,
        duration_seconds: Math.round(h * 3600),
        started_at: new Date(`${tsDate}T12:00:00`).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTsHours("");
      qc.invalidateQueries({ queryKey: ["task-time-entries", taskId] });
      toast.success("Horas lançadas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTime = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("time_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-time-entries", taskId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const [editEntry, setEditEntry] = useState<{ id: string; hours: string; date: string } | null>(null);
  const updateTime = useMutation({
    mutationFn: async () => {
      if (!editEntry) return;
      const h = Number(editEntry.hours.replace(",", "."));
      if (!h || h <= 0) throw new Error("Informe as horas");
      const { error } = await (supabase as any).from("time_entries").update({
        duration_seconds: Math.round(h * 3600),
        started_at: new Date(`${editEntry.date}T12:00:00`).toISOString(),
      }).eq("id", editEntry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditEntry(null);
      qc.invalidateQueries({ queryKey: ["task-time-entries", taskId] });
      toast.success("Lançamento atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });


  /* ---------- Cronômetro (play / stop) ---------- */
  const timerKey = taskId ? `cw-timer:${taskId}` : null;
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    if (!timerKey) { setTimerStart(null); return; }
    const raw = localStorage.getItem(timerKey);
    setTimerStart(raw ? Number(raw) : null);
  }, [timerKey]);

  useEffect(() => {
    if (timerStart == null) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [timerStart]);

  const runningSeconds = timerStart == null ? 0 : Math.max(0, Math.floor((nowTick - timerStart) / 1000));
  const fmtClock = (sec: number) =>
    [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60]
      .map(n => String(n).padStart(2, "0")).join(":");

  const startTimer = () => {
    if (!timerKey) return;
    const t = Date.now();
    localStorage.setItem(timerKey, String(t));
    setTimerStart(t); setNowTick(t);
  };

  const stopTimer = useMutation({
    mutationFn: async () => {
      if (timerStart == null) return;
      const seconds = Math.max(60, Math.floor((Date.now() - timerStart) / 1000));
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("time_entries").insert({
        organization_id: profile.organization_id,
        task_id: taskId,
        user_id: auth.user?.id ?? null,
        duration_seconds: seconds,
        started_at: new Date(timerStart).toISOString(),
        ended_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (timerKey) localStorage.removeItem(timerKey);
      setTimerStart(null);
      qc.invalidateQueries({ queryKey: ["task-time-entries", taskId] });
      toast.success("Tempo registrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });




  /* ---------- Anexos ---------- */
  useEffect(() => {
    const missing = attachments.filter(a => a.is_image && a.path && !previews[a.path]);
    if (missing.length === 0) return;
    let alive = true;
    (async () => {
      const next: Record<string, string> = {};
      for (const a of missing) {
        const { data } = await supabase.storage.from("task-files").createSignedUrl(a.path, 60 * 60);
        if (data?.signedUrl) next[a.path] = data.signedUrl;
      }
      if (alive && Object.keys(next).length) setPreviews(p => ({ ...p, ...next }));
    })();
    return () => { alive = false; };
  }, [attachments, previews]);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const added: AttachmentDraft[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 15 * 1024 * 1024) { toast.error(`${file.name}: máximo de 15 MB.`); continue; }
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${taskId ?? "novas"}/${uid()}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("task-files").upload(path, file, { contentType: file.type || undefined });
        if (error) { toast.error(`${file.name}: ${error.message}`); continue; }
        added.push({
          id: uid(), path, name: file.name, type: file.type || "",
          size: file.size, is_image: (file.type || "").startsWith("image/"),
        });
      }
      if (added.length) {
        setAttachments(list => [...list, ...added]);
        const firstImg = added.find(a => a.is_image);
        if (firstImg && !coverPath) setCoverPath(firstImg.path);
      }
    } finally {
      setUploading(false);
    }
  }

  async function removeAttachment(a: AttachmentDraft) {
    await supabase.storage.from("task-files").remove([a.path]);
    setAttachments(list => list.filter(x => x.id !== a.id));
    if (coverPath === a.path) setCoverPath(null);
  }

  async function openAttachment(a: AttachmentDraft) {
    const { data } = await supabase.storage.from("task-files").createSignedUrl(a.path, 60 * 10);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  const reset = () => {

    setTitle(defaultTitle); setDescription(""); setProjectId(defaultProjectId); setTaskTypeId(defaultTaskTypeId);
    setAssigneeId(null); setDueDate(""); setPriority("medium"); setStatus("todo"); setStage("briefing"); setCurrentStageId(null);
    setEstimated(""); setBillingEnabled(true); setBaseValue(""); setDeliverables([]); setChecklist([]);
    setPlatformsSel([]); setNotes(""); setLiveItems([]); setTech(EMPTY_TECH); setTab("details");
    setAttachments([]); setCoverPath(null); setPreviews({});
    setBriefingTemplateId(null); setBriefingData({}); setSeededStageType(null);

  };
  const close = (o: boolean) => { setBaseline(""); onOpenChange(o); if (!o) reset(); };

  /* ---------- Alterações não salvas ---------- */
  const [baseline, setBaseline] = useState("");
  const [askUnsaved, setAskUnsaved] = useState(false);
  const [askDelete, setAskDelete] = useState(false);


  const payload = () => ({
    title: title.trim(),
    description: [description.trim(), notes.trim() && `\n\nObservações: ${notes.trim()}`].filter(Boolean).join("") || null,
    status: status as any,
    priority: priority as any,
    project_id: projectId,
    // Cliente herdado automaticamente do projeto selecionado.
    ...(projectId ? { client_id: projects.find(p => p.id === projectId)?.client_id ?? null } : {}),
    assignee_id: assigneeId,
    start_date: startDate || null,
    due_date: dueDate || null,
    stage: stage as any,
    current_stage_id: currentStageId,
    stage_started_on: (currentStageId && stageWindowById[currentStageId]?.start) || null,
    stage_due_on: (currentStageId && stageWindowById[currentStageId]?.end) || null,
    progress,

    task_type_id: taskTypeId,
    estimated_hours: estimated ? Number(estimated) : null,
    billing_enabled: billingEnabled,
    billing_base_value: baseValue ? Number(baseValue) : null,
    // O valor da tarefa guarda somente a parcela-base. Entregáveis são linhas
    // independentes no faturamento e não podem ser incorporados aqui novamente.
    billing_value: baseValue ? Number(baseValue) : null,
    platform: platformsSel.join(", ") || null,
    deliverables: deliverables.map(d => ({
      id: d.id, platform: d.platform, type: d.type,
      billing_enabled: d.billing_enabled, billing_model: "per_task",
      billing_value: d.billing_value, delivered: d.delivered, invoiced: !!d.invoiced,
      due_date: d.due_date || null,
      delivered_at: d.delivered ? (d.delivered_at || new Date().toISOString().slice(0, 10)) : null,
    })) as any,
    attachments: attachments as any,
    cover_url: coverPath,

    briefing_template_id: briefingTemplateId,
    briefing: briefingData as any,
    live_items: liveItems as any,
    tech_sheet: tech as any,
    subtasks: checklist as any,
  });


  /** Cria/atualiza/remove as subtarefas reais ligadas à tarefa. */
  async function syncSubtasks(parentId: string, orgId: string) {
    if (removedSubtaskIds.length) {
      await (supabase as any).from("tasks").delete().in("id", removedSubtaskIds);
    }
    for (const s of subtasks) {
      const title = s.title.trim();
      if (!title) continue;
      const row = {
        title,
        task_type_id: s.task_type_id || taskTypeId || null,
        status: s.status as any,
        billing_enabled: s.value != null,
        billing_base_value: s.value,
        billing_value: s.value,
        due_date: s.due_date || dueDate || null,
        project_id: projectId || null,
        client_id: projectId ? (projects.find(p => p.id === projectId)?.client_id ?? null) : null,
        parent_task_id: parentId,
      };
      if (s.rowId) {
        await (supabase as any).from("tasks").update(row).eq("id", s.rowId);
      } else {
        await (supabase as any).from("tasks").insert({ ...row, organization_id: orgId });
      }
    }
    setRemovedSubtaskIds([]);
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      if (isEdit) {
        const { error } = await (supabase as any).from("tasks").update(payload()).eq("id", taskId!);
        if (error) throw error;
        await syncSubtasks(taskId!, profile.organization_id);
        // Espelha os novos valores nas cobranças/faturas em aberto que já usam
        // esta tarefa (faturas pagas ou canceladas não são alteradas).
        const updated = await syncChargesFromTask(taskId!).catch(() => [] as string[]);
        return { id: taskId!, updated };
      }
      const { data, error } = await (supabase as any).from("tasks")
        .insert({ ...payload(), organization_id: profile.organization_id })
        .select("id").single();
      if (error) throw error;
      await syncSubtasks(data.id as string, profile.organization_id);
      return { id: data.id as string, updated: [] as string[] };
    },
    onSuccess: ({ id, updated }) => {
      qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["project-tasks"] });
      qc.invalidateQueries({ queryKey: ["task-subtasks", taskId] });
      qc.invalidateQueries({ queryKey: ["task-window", taskId] });
      qc.invalidateQueries({ queryKey: ["charges"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["invoice-charges"] });
      toast.success(isEdit ? "Tarefa atualizada" : "Tarefa criada");
      if (updated.length) {
        toast.info(`Valores atualizados na${updated.length > 1 ? "s" : ""} fatura${updated.length > 1 ? "s" : ""} #${updated.join(", #")}`);
      }
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
      qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["project-tasks"] });
      toast.success("Tarefa excluída");
      close(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [mode, setMode] = useState<"modal" | "docked" | "minimized">("modal");
  useEffect(() => { if (open) setMode("modal"); }, [open]);

  /* snapshot inicial para detectar alterações */
  useEffect(() => {
    if (!open) { setBaseline(""); return; }
    if (isEdit && !existing) return;
    const t = setTimeout(() => setBaseline(JSON.stringify(payload())), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, existing]);

  const isDirty = !!baseline && JSON.stringify(payload()) !== baseline;
  const requestClose = () => { if (isDirty) setAskUnsaved(true); else close(false); };

  const canSave = title.trim().length > 0;


  const titleEl = (node: React.ReactElement) =>
    mode === "modal" ? <DialogTitle asChild>{node}</DialogTitle> : node;

  if (!open) return null;

  const timerChip = taskId ? (
    <div className={`cw-head-timer${timerStart != null ? " is-running" : ""}`}>
      <Clock size={13} />
      <span className="cw-head-timer-clock">{fmtClock(runningSeconds)}</span>
      {timerStart == null ? (
        <button type="button" className="cw-timer-btn is-play" onClick={startTimer} title="Iniciar cronômetro">
          <Play size={13} />
        </button>
      ) : (
        <button type="button" className="cw-timer-btn is-stop" disabled={stopTimer.isPending}
          onClick={() => stopTimer.mutate()} title="Parar e registrar lançamento">
          <Square size={12} />
        </button>
      )}
    </div>
  ) : null;

  const confirmDialogs = (
    <>
      <UnsavedChangesDialog
        open={askUnsaved} onOpenChange={setAskUnsaved}
        saving={save.isPending}
        onDiscard={() => { setAskUnsaved(false); close(false); }}
        onSave={() => { setAskUnsaved(false); save.mutate(); }}
      />
      <ConfirmDeleteDialog
        open={askDelete} onOpenChange={setAskDelete}
        pending={remove.isPending}
        title="Excluir esta tarefa?"
        description="A tarefa, seus entregáveis e lançamentos serão removidos permanentemente."
        onConfirm={() => { setAskDelete(false); remove.mutate(); }}
      />
    </>
  );

  if (mode === "minimized") {
    return (
      <>
      <div className="cw cw-mini">
        <span className="cw-title-icon"><ListChecks size={15} /></span>
        <span className="cw-mini-title">{title || (isEdit ? "Tarefa" : "Nova Tarefa")}</span>
        {timerChip}
        <button type="button" className="cw-close" onClick={() => setMode("modal")} aria-label="Restaurar"><Maximize2 size={16} /></button>
        <button type="button" className="cw-close" onClick={requestClose} aria-label="Fechar"><X size={16} /></button>
      </div>
      {confirmDialogs}
      </>
    );
  }


  const windowEl = (
        <div className="cw-window">
          {/* HEADER */}
          <div className="cw-header">
            <span className="cw-title-icon"><ListChecks size={17} /></span>
            <div className="min-w-0 flex-1">
              {titleEl(<h2>{isEdit ? (title || "Tarefa") : "Nova Tarefa"}</h2>)}
              <p>{isEdit
                ? "Edite a tarefa, os entregáveis e acompanhe o fluxo de produção"
                : "Crie a tarefa, defina os entregáveis e acompanhe o fluxo de produção"}</p>
            </div>
            <div className="cw-head-actions">
              {timerChip}

              <div className="cw-head-status" style={{ ["--sc" as string]: statusColor(status) }}>
                <i />
                <select value={status} onChange={e => changeStatus(e.target.value)} aria-label="Status">
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <button type="button" className="cw-btn cw-btn-primary cw-btn-sm" disabled={!canSave || save.isPending}
                onClick={() => save.mutate()}><Save /> {save.isPending ? "Salvando…" : "Salvar"}</button>
              {isEdit && (
                <button type="button" className="cw-close cw-close-danger" aria-label="Excluir" disabled={remove.isPending}
                  onClick={() => setAskDelete(true)}><Trash2 size={17} /></button>
              )}
              <button type="button" className="cw-close" onClick={() => setMode("minimized")} aria-label="Minimizar"><Minus size={18} /></button>
              <button type="button" className="cw-close" onClick={() => setMode(mode === "docked" ? "modal" : "docked")}
                aria-label="Lateralizar"><PanelRight size={17} /></button>
              <button type="button" className="cw-close" onClick={requestClose} aria-label="Fechar"><X size={18} /></button>
            </div>
          </div>

          <div className="cw-headzone is-open is-slim">


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
            <div className="cw-prop" style={{ gridColumn: "span 2" }}>
              <div className="cw-label">Período (início → prazo)</div>
              <div className="cw-prop-value">
                <CwDateRange start={startDate} end={dueDate}
                  onChange={(s, e) => { setStartDate(s); setDueDate(e); }} />
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
          <div className="cw-stageband">
            <div className="cw-stageband-head">
              <Layers size={14} />
              <strong>ETAPA DA TAREFA</strong>
              {taskTypes.find((t: any) => t.id === taskTypeId)?.name && (
                <span className="cw-stageband-type">{taskTypes.find((t: any) => t.id === taskTypeId)?.name}</span>
              )}
            </div>
            <div className="cw-stageband-row">
              {flowSteps.map((s, i) => (
                <button
                  type="button"
                  key={s.key}
                  onClick={() => selectStep(i)}
                  title={`Etapa: ${s.label} — status: ${STATUSES.find(x => x.value === s.status)?.label ?? s.status}`}
                  className={`cw-stage-step${i === activeIdx ? " is-on" : ""}${i < activeIdx ? " is-done" : ""}`}
                  style={{ ["--stc" as string]: s.color, ["--stsc" as string]: statusColor(s.status) }}
                >
                  <span className="cw-stage-step-top">
                    <i className="cw-stage-bullet" />
                    <span className="cw-stage-name">{s.label}</span>
                    {i < activeIdx ? <Check size={13} /> : <span className="cw-stage-arrow">›</span>}
                  </span>
                  <span className="cw-stage-sub">
                    {STATUSES.find(x => x.value === s.status)?.label ?? s.status}
                  </span>
                  {s.stageId && stageWindowById[s.stageId] && (stageWindowById[s.stageId].start || stageWindowById[s.stageId].end) && (
                    <span className="cw-stage-dates">
                      {fmtBr(stageWindowById[s.stageId].start)} → {fmtBr(stageWindowById[s.stageId].end)}
                    </span>
                  )}
                  {s.stageId && stageAlerts[s.stageId] && (
                    <span className={`cw-stage-alert is-${stageAlerts[s.stageId]!.level}`}>
                      {stageAlerts[s.stageId]!.message}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {currentStageAlert && currentStageAlert.level !== "ok" && (
              <p className={`cw-stage-banner is-${currentStageAlert.level}`}>
                Etapa “{flowSteps[activeIdx]?.label}”: {currentStageAlert.message}
              </p>
            )}
            <p className="cw-stageband-hint">
              Ao mudar a etapa, o status é sincronizado automaticamente. Os prazos das etapas são contados a partir da data de entrega.
            </p>
          </div>
          </div>






          {/* CORPO */}
          <div className="cw-task-body">
            <div>
              <div className="cw-tabs">
                <button type="button" className={`cw-tab${tab === "details" ? " is-on" : ""}`} onClick={() => setTab("details")}>
                  <ListChecks size={14} /> Detalhes
                </button>
                <button type="button" className={`cw-tab${tab === "work" ? " is-on" : ""}`} onClick={() => setTab("work")}>
                  <Check size={14} /> Subtarefas e checklist
                  {(subtasks.length + checklist.length) > 0 && <span className="cw-tab-count">{subtasks.length + checklist.length}</span>}
                </button>
                <button type="button" className={`cw-tab${tab === "files" ? " is-on" : ""}`} onClick={() => setTab("files")}>
                  <Paperclip size={14} /> Anexos
                  {attachments.length > 0 && <span className="cw-tab-count">{attachments.length}</span>}
                </button>
                <button type="button"
                  className={`cw-tab${tab === "briefing" ? " is-on" : ""}${briefingFilled ? " is-filled" : ""}`}
                  onClick={() => setTab("briefing")}>
                  <FileText size={14} /> Briefing
                </button>
                {showLiveTab && (
                  <button type="button"
                    className={`cw-tab${tab === "live" ? " is-on" : ""}${liveItems.length > 0 ? " is-live" : ""}`}
                    onClick={() => setTab("live")}>
                    <Radio size={14} /> Ao Vivo / Estreia
                    {liveItems.length > 0 && <span className="cw-tab-count">{liveItems.length}</span>}
                  </button>
                )}
                {showTechTab && (
                  <button type="button"
                    className={`cw-tab${tab === "tech" ? " is-on" : ""}${techFilled ? " is-filled" : ""}`}
                    onClick={() => setTab("tech")}>
                    <SlidersHorizontal size={14} /> Ficha técnica
                  </button>
                )}
              </div>


              <div hidden={tab !== "details"}>

              <div className="cw-field">
                <span className="cw-label">Título da tarefa<span className="req">*</span></span>
                <input className="cw-input" autoFocus value={title} maxLength={140}
                  onChange={e => setTitle(e.target.value)} placeholder="Ex.: Reels institucional — roteiro e gravação" />
              </div>

              <div className="cw-field" style={{ marginTop: 14 }}>
                <span className="cw-label">Descrição / briefing</span>
                <textarea className="cw-textarea" rows={9} style={{ minHeight: 190, resize: "vertical" }} value={description}
                  onChange={e => setDescription(e.target.value)} placeholder="Contexto, referências e o que precisa ser entregue..." />
              </div>
              </div>

              <div hidden={tab !== "work"}>
              {/* SUBTAREFAS */}
              <div className="cw-section">
                <div className="cw-mini-head">
                  <h5>Subtarefas {subtasks.length > 0 && <span style={{ color: "var(--cw-muted)", fontWeight: 400 }}>({subtasks.length})</span>}</h5>
                  <button type="button" className="cw-link"
                    onClick={() => setSubtasks(s => [...s, { id: uid(), rowId: null, title: "", task_type_id: null, value: null, status: "todo", due_date: null }])}>
                    <Plus size={13} /> Adicionar subtarefa
                  </button>
                </div>
                {subtasks.length === 0 && (
                  <div style={{ fontSize: 11, color: "var(--cw-muted)" }}>
                    Nenhuma subtarefa. Cada subtarefa vira uma tarefa própria, com seu tipo e valor.
                  </div>
                )}
                {subtasks.map(s => (
                  <div key={s.id} className="cw-subtask-row">
                    <input type="text" className="cw-input" value={s.title} placeholder="Título da subtarefa"
                      onChange={e => setSubtasks(list => list.map(x => x.id === s.id ? { ...x, title: e.target.value } : x))} />
                    <select className="cw-select" value={s.task_type_id ?? ""}
                      onChange={e => setSubtasks(list => list.map(x => x.id === s.id ? { ...x, task_type_id: e.target.value || null } : x))}>
                      <option value="">Tipo da tarefa pai</option>
                      {taskTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    <select className="cw-select" value={s.status}
                      onChange={e => setSubtasks(list => list.map(x => x.id === s.id ? { ...x, status: e.target.value } : x))}>
                      {STATUSES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                    </select>
                    <input type="number" min={0} step="0.01" className="cw-input" style={{ width: 110 }} placeholder="R$"
                      value={s.value ?? ""}
                      onChange={e => setSubtasks(list => list.map(x => x.id === s.id ? { ...x, value: e.target.value ? Number(e.target.value) : null } : x))} />
                    <button type="button" className="cw-row-icon"
                      onClick={() => {
                        if (s.rowId) setRemovedSubtaskIds(r => [...r, s.rowId!]);
                        setSubtasks(list => list.filter(x => x.id !== s.id));
                      }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
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
              </div>

              <div hidden={tab !== "files"}>
              {/* ANEXOS E CAPA */}
              <div className="cw-section">
                <div className="cw-section-head">
                  <div>
                    <h4>Anexos</h4>
                    <p>Envie imagens e arquivos. Escolha uma imagem como capa da tarefa.</p>
                  </div>
                  <label className="cw-btn cw-btn-secondary sm" style={{ cursor: "pointer" }}>
                    <Paperclip size={13} /> {uploading ? "Enviando..." : "Adicionar arquivo"}
                    <input type="file" multiple hidden disabled={uploading}
                      onChange={e => { uploadFiles(e.target.files); e.currentTarget.value = ""; }} />
                  </label>
                </div>

                {attachments.length === 0 ? (
                  <div className="cw-mut" style={{ fontSize: 12 }}>Nenhum anexo ainda.</div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 10 }}>
                    {attachments.map(a => {
                      const isCover = coverPath === a.path;
                      return (
                        <div key={a.id}
                          style={{
                            border: `1px solid ${isCover ? "var(--cw-primary, #2F6BEF)" : "var(--cw-border, #E3E8EF)"}`,
                            boxShadow: isCover ? "0 0 0 2px rgba(47,107,239,.16)" : "none",
                            borderRadius: 12, overflow: "hidden", background: "var(--cw-surface, #fff)",
                          }}>
                          <div style={{ height: 92, background: "var(--cw-soft, #F4F6FA)", display: "grid", placeItems: "center", cursor: "pointer" }}
                            onClick={() => openAttachment(a)}>
                            {a.is_image && previews[a.path]
                              ? <img src={previews[a.path]} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <FileText size={22} style={{ opacity: .5 }} />}
                          </div>
                          <div style={{ padding: "7px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ flex: 1, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.name}>{a.name}</span>
                            <button type="button" className="cw-row-icon" title="Remover" onClick={() => removeAttachment(a)}><Trash2 size={12} /></button>
                          </div>
                          {a.is_image && (
                            <button type="button"
                              className={`cw-deliver-btn${isCover ? " is-done" : ""}`}
                              style={{ width: "calc(100% - 16px)", margin: "0 8px 8px", justifyContent: "center" }}
                              onClick={() => setCoverPath(isCover ? null : a.path)}>
                              {isCover ? <><Check size={12} /> Capa</> : "Definir como capa"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              </div>

              <div hidden={tab !== "details"}>
              {/* ENTREGÁVEIS */}
              <div className="cw-section">
                <div className="cw-section-head">
                  <div>
                    <h4>Entregáveis</h4>
                    <p>Somente entregáveis marcados como entregues podem ser faturados.</p>
                  </div>
                  <button type="button" className="cw-btn cw-btn-secondary sm"
                    onClick={() => setDeliverables(d => [...d, { id: uid(), platform: platformsSel[0] ?? "", type: "", billing_enabled: billingEnabled, billing_value: null, delivered: false, due_date: null }])}>
                    <Plus /> Adicionar entregável
                  </button>
                </div>
                <table className="cw-table">
                  <thead>
                    <tr>
                      <th style={{ width: 128 }}>Plataforma</th>
                      <th>Formato / entrega</th>
                      <th style={{ width: 130 }}>Prazo combinado</th>
                      <th style={{ width: 80 }}>Faturável</th>
                      <th style={{ width: 100 }}>Valor</th>
                      <th style={{ width: 124 }}>Confirmação</th>
                      <th style={{ width: 130 }}>Entregue em</th>
                      <th style={{ width: 56 }} />

                    </tr>
                  </thead>
                  <tbody>
                    {deliverables.length === 0 && (
                      <tr><td colSpan={8} className="cw-mut" style={{ textAlign: "center" }}>Nenhum entregável adicionado.</td></tr>
                    )}
                    {deliverables.map(d => {
                      const late = !d.delivered && !!d.due_date && d.due_date < new Date().toISOString().slice(0, 10);
                      return (
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
                          <CwDate compact value={d.due_date ?? ""} placeholder="Sem data"
                            className={late ? "text-[#e14545] font-semibold" : undefined}
                            onChange={v => setDeliverables(list => list.map(x => x.id === d.id ? { ...x, due_date: v || null } : x))} />
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
                          <button type="button"
                            className={`cw-deliver-btn${d.delivered ? " is-done" : late ? " is-late" : ""}`}
                            onClick={() => setDeliverables(list => list.map(x => x.id === d.id ? {
                              ...x,
                              delivered: !x.delivered,
                              delivered_at: !x.delivered ? (x.delivered_at || new Date().toISOString().slice(0, 10)) : null,
                            } : x))}>
                            {d.delivered ? <><Check size={12} /> Entregue</> : late ? "Atrasado" : "Marcar entregue"}
                          </button>
                        </td>
                        <td>
                          {d.delivered ? (
                            <CwDate compact value={d.delivered_at ?? ""} placeholder="Data da entrega"
                              onChange={v => setDeliverables(list => list.map(x => x.id === d.id ? { ...x, delivered_at: v || null } : x))} />
                          ) : (
                            <span className="cw-mut" style={{ fontSize: 11 }}>—</span>
                          )}
                        </td>

                        <td>
                          <button type="button" className="cw-row-icon" onClick={() => setDeliverables(list => list.filter(x => x.id !== d.id))}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                  {platforms.length === 0 && (
                    <span style={{ fontSize: 11, color: "var(--cw-muted)" }}>
                      {projectId
                        ? "Nenhuma plataforma habilitada neste projeto — edite o projeto para liberar."
                        : "Cadastre plataformas em Configurações."}
                    </span>
                  )}
                </div>
              </div>

              </div>

              {/* BRIEFING */}
              <div hidden={tab !== "briefing"}>
                <div className="cw-section" style={{ marginTop: 0 }}>
                  <div className="cw-field">
                    <span className="cw-label">Modelo de briefing</span>
                    <select
                      className="cw-input"
                      value={briefingTemplateId ?? ""}
                      onChange={e => setBriefingTemplateId(e.target.value || null)}
                    >
                      <option value="">
                        {briefingTemplates.length ? "Selecionar modelo…" : "Nenhum modelo cadastrado"}
                      </option>
                      {briefingTemplates
                        .filter(t => t.template_type === "briefing")
                        .map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  {briefingTpl ? (
                    <div style={{ marginTop: 14 }}>
                      <BriefingForm template={briefingTpl} data={briefingData} onChange={setBriefingData} />
                    </div>
                  ) : (
                    <p className="cw-hint" style={{ marginTop: 10 }}>
                      Escolha um modelo para preencher o briefing desta tarefa. Os modelos são criados em
                      Configurações › Modelos de Briefing e podem ser vinculados a um tipo de tarefa.
                    </p>
                  )}
                </div>
              </div>

              {/* AO VIVO / ESTREIA */}

              <div hidden={tab !== "live"}>
                <div className="cw-section" style={{ marginTop: 0 }}>
                  <div className="cw-section-head">
                    <div>
                      <h4>Ao Vivo / Estreia</h4>
                      <p>Transmissões e estreias desta tarefa — aulas, lives e exibições programadas.</p>
                    </div>
                    <button type="button" className="cw-btn cw-btn-secondary sm"
                      onClick={() => setLiveItems(l => [...l, { id: uid(), title: "", kind: "live", platform: platformsSel[0] ?? "", date: null, time: "", duration_min: null, status: "scheduled", url: "", notes: "" }])}>
                      <Plus /> Adicionar transmissão
                    </button>
                  </div>
                  <table className="cw-table">
                    <thead>
                      <tr>
                        <th>Título / aula</th>
                        <th style={{ width: 110 }}>Tipo</th>
                        <th style={{ width: 130 }}>Plataforma</th>
                        <th style={{ width: 130 }}>Data</th>
                        <th style={{ width: 90 }}>Hora</th>
                        <th style={{ width: 80 }}>Duração</th>
                        <th style={{ width: 130 }}>Status</th>
                        <th style={{ width: 56 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {liveItems.length === 0 && (
                        <tr><td colSpan={8} className="cw-mut" style={{ textAlign: "center" }}>Nenhuma transmissão programada.</td></tr>
                      )}
                      {liveItems.map(l => {
                        const upd = (patch: Partial<LiveDraft>) =>
                          setLiveItems(list => list.map(x => x.id === l.id ? { ...x, ...patch } : x));
                        const sc = LIVE_STATUS.find(s => s.value === l.status)?.color ?? "#7F8C9E";
                        return (
                          <tr key={l.id}>
                            <td>
                              <input className="cw-table-inline-input" value={l.title} placeholder="Ex.: Aula 03 — Fundamentos"
                                onChange={e => upd({ title: e.target.value })} />
                            </td>
                            <td>
                              <select className="cw-table-inline-input" value={l.kind}
                                onChange={e => upd({ kind: e.target.value as LiveDraft["kind"] })}>
                                {LIVE_KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
                              </select>
                            </td>
                            <td>
                              <select className="cw-table-inline-input" value={l.platform}
                                onChange={e => upd({ platform: e.target.value })}>
                                <option value="">—</option>
                                {platforms.map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                              </select>
                            </td>
                            <td>
                              <CwDate compact value={l.date ?? ""} placeholder="Sem data"
                                onChange={v => upd({ date: v || null })} />
                            </td>
                            <td>
                              <input type="time" className="cw-table-inline-input" value={l.time}
                                onChange={e => upd({ time: e.target.value })} />
                            </td>
                            <td>
                              <input type="number" className="cw-table-inline-input" value={l.duration_min ?? ""} placeholder="min"
                                onChange={e => upd({ duration_min: e.target.value ? Number(e.target.value) : null })} />
                            </td>
                            <td>
                              <select className="cw-table-inline-input" value={l.status}
                                style={{ color: sc, fontWeight: 600 }}
                                onChange={e => upd({ status: e.target.value as LiveDraft["status"] })}>
                                {LIVE_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                              </select>
                            </td>
                            <td>
                              <button type="button" className="cw-row-icon" onClick={() => setLiveItems(list => list.filter(x => x.id !== l.id))}>
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {liveItems.map(l => (
                  <div key={l.id} className="cw-section">
                    <div className="cw-mini-head">
                      <h5>{l.title || "Transmissão sem título"}</h5>
                    </div>
                    <div className="cw-grid-2">
                      <div className="cw-field">
                        <span className="cw-label">Link da transmissão</span>
                        <input className="cw-input" value={l.url} placeholder="https://..."
                          onChange={e => setLiveItems(list => list.map(x => x.id === l.id ? { ...x, url: e.target.value } : x))} />
                      </div>
                      <div className="cw-field">
                        <span className="cw-label">Observações</span>
                        <input className="cw-input" value={l.notes} placeholder="Convidados, roteiro, responsável técnico…"
                          onChange={e => setLiveItems(list => list.map(x => x.id === l.id ? { ...x, notes: e.target.value } : x))} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* FICHA TÉCNICA */}
              <div hidden={tab !== "tech"}>
                <div className="cw-section" style={{ marginTop: 0 }}>
                  <div className="cw-section-head">
                    <div>
                      <h4>Ficha técnica</h4>
                      <p>Especificações de captação, transmissão, edição e arte.</p>
                    </div>
                  </div>
                  <div className="cw-field" style={{ maxWidth: 280 }}>
                    <span className="cw-label">Categoria técnica</span>
                    <select className="cw-input" value={tech.category} onChange={e => setT("category", e.target.value)}>
                      {TECH_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                {(tech.category === "video" || tech.category === "broadcast" || tech.category === "other") && (
                  <div className="cw-section">
                    <div className="cw-mini-head"><h5>Imagem e captação</h5></div>
                    <div className="cw-grid-2">
                      <div className="cw-field"><span className="cw-label">Proporção</span>
                        <input className="cw-input" value={tech.aspect_ratio} placeholder="16:9, 9:16, 1:1, 4:5" onChange={e => setT("aspect_ratio", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Definição / resolução</span>
                        <input className="cw-input" value={tech.resolution} placeholder="1080p, 4K UHD, 2160x3840" onChange={e => setT("resolution", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Taxa de quadros (FPS)</span>
                        <input className="cw-input" value={tech.fps} placeholder="24, 30, 60" onChange={e => setT("fps", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Codec / bitrate</span>
                        <input className="cw-input" value={tech.codec} placeholder="H.264 10 Mbps, ProRes" onChange={e => setT("codec", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Câmera</span>
                        <input className="cw-input" value={tech.camera} placeholder="Sony A7 III, iPhone 15 Pro" onChange={e => setT("camera", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Lente</span>
                        <input className="cw-input" value={tech.lens} placeholder="24-70mm f/2.8" onChange={e => setT("lens", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Iluminação</span>
                        <input className="cw-input" value={tech.lighting} placeholder="Key + fill, softbox, luz natural" onChange={e => setT("lighting", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Áudio</span>
                        <input className="cw-input" value={tech.audio} placeholder="Lapela, boom, mesa digital" onChange={e => setT("audio", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Local / cenário</span>
                        <input className="cw-input" value={tech.location} placeholder="Estúdio, externa, home office" onChange={e => setT("location", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Duração prevista</span>
                        <input className="cw-input" value={tech.duration} placeholder="60s, 20 min" onChange={e => setT("duration", e.target.value)} /></div>
                    </div>
                  </div>
                )}

                {(tech.category === "video" || tech.category === "broadcast" || tech.category === "audio" || tech.category === "other") && (
                  <div className="cw-section">
                    <div className="cw-mini-head"><h5>Edição e entrega</h5></div>
                    <div className="cw-grid-2">
                      <div className="cw-field"><span className="cw-label">Formato de entrega</span>
                        <input className="cw-input" value={tech.deliver_format} placeholder="MP4, MOV, WAV" onChange={e => setT("deliver_format", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Legendas</span>
                        <input className="cw-input" value={tech.subtitles} placeholder="Queimada, SRT, sem legenda" onChange={e => setT("subtitles", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Notas de edição</span>
                        <input className="cw-input" value={tech.edit_notes} placeholder="Cortes secos, trilha, lettering" onChange={e => setT("edit_notes", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Cor / color grading</span>
                        <input className="cw-input" value={tech.color_notes} placeholder="LUT, tom quente, Rec.709" onChange={e => setT("color_notes", e.target.value)} /></div>
                    </div>
                  </div>
                )}

                {(tech.category === "graphic" || tech.category === "other") && (
                  <div className="cw-section">
                    <div className="cw-mini-head"><h5>Arte / peça gráfica</h5></div>
                    <div className="cw-grid-2">
                      <div className="cw-field"><span className="cw-label">Proporção / dimensões</span>
                        <input className="cw-input" value={tech.art_size} placeholder="1080x1350 px, A4, 90x50 mm" onChange={e => setT("art_size", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Resolução (DPI)</span>
                        <input className="cw-input" value={tech.art_dpi} placeholder="72 (social) / 300 (impressão)" onChange={e => setT("art_dpi", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Modo de cor</span>
                        <input className="cw-input" value={tech.art_color_mode} placeholder="RGB ou CMYK" onChange={e => setT("art_color_mode", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Sangria / margem</span>
                        <input className="cw-input" value={tech.art_bleed} placeholder="3 mm de sangria" onChange={e => setT("art_bleed", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Uso</span>
                        <input className="cw-input" value={tech.art_usage} placeholder="Impresso, social, digital" onChange={e => setT("art_usage", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Fontes</span>
                        <input className="cw-input" value={tech.art_fonts} placeholder="Tipografias usadas" onChange={e => setT("art_fonts", e.target.value)} /></div>
                      <div className="cw-field"><span className="cw-label">Paleta de cores</span>
                        <input className="cw-input" value={tech.art_palette} placeholder="#2F6BEF, #101B2E" onChange={e => setT("art_palette", e.target.value)} /></div>
                    </div>
                  </div>
                )}

                <div className="cw-section">
                  <div className="cw-field">
                    <span className="cw-label">Observações técnicas</span>
                    <textarea className="cw-textarea" rows={4} value={tech.extra}
                      onChange={e => setT("extra", e.target.value)} placeholder="Qualquer detalhe técnico adicional (equipe, equipamentos, requisitos da plataforma…)" />
                  </div>
                </div>
              </div>
            </div>


            {/* COLUNA LATERAL */}
            <div className="cw-side">
              <div className="cw-side-card">
                <h5><Layers size={15} /> Resumo</h5>
                <div className="cw-side-line">
                  <span>Etapa atual</span>
                  <span
                    className="cw-stage-chip"
                    style={{ ["--sc" as string]: flowSteps[activeIdx]?.color ?? statusColor(status) }}
                  >
                    <i /> {flowSteps[activeIdx]?.label ?? "—"}
                  </span>
                </div>
                <div className="cw-side-line"><span>Entregáveis</span><span>{deliverables.length}</span></div>
                <div className="cw-side-line"><span>Checklist</span><span>{doneCount}/{checklist.length}</span></div>
                <div className="cw-side-line"><span>Plataformas</span><span>{platformsSel.length}</span></div>


                <div className="cw-side-total">
                  <div className="cw-side-line" style={{ padding: 0 }}>
                    <span>Progresso</span><span>{progress}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "rgba(127,140,158,.25)", marginTop: 6 }}>
                    <div style={{ width: `${progress}%`, height: "100%", borderRadius: 999, background: "var(--cw-cobalt)" }} />
                  </div>
                  <span className="cw-hint" style={{ display: "block", marginTop: 6 }}>
                    {checklistPct === null
                      ? `Calculado pela etapa atual (${stagePct}%). Adicione itens ao checklist para refinar.`
                      : `Média de etapa (${stagePct}%) e checklist (${checklistPct}%). Status "Concluída" fixa em 100%.`}
                  </span>
                </div>
              </div>

              <div className="cw-side-card">
                <h5><Clock size={15} /> Timesheet</h5>
                <div className="cw-field" style={{ marginBottom: 8 }}>
                  <span className="cw-label">Horas estimadas</span>
                  <input className="cw-input" type="number" step="0.5" value={estimated}
                    onChange={e => setEstimated(e.target.value)} placeholder="0" />
                </div>
                <div className="cw-side-line" style={{ padding: 0 }}>
                  <span>Total apontado</span><span>{fmtHours(totalSeconds)}</span>
                </div>
                {estimated && Number(estimated) > 0 && (
                  <div className="cw-side-line" style={{ padding: 0 }}>
                    <span>Da estimativa</span>
                    <span>{Math.round((totalSeconds / 3600 / Number(estimated)) * 100)}%</span>
                  </div>
                )}
                {!taskId ? (
                  <span className="cw-hint" style={{ display: "block", marginTop: 8 }}>
                    Salve a tarefa para lançar horas trabalhadas.
                  </span>
                ) : (
                  <>
                    {timerStart != null && (
                      <div className="cw-timer is-running">
                        <span className="cw-timer-clock">{fmtClock(runningSeconds)}</span>
                        <button type="button" className="cw-timer-btn is-stop" disabled={stopTimer.isPending}
                          onClick={() => stopTimer.mutate()} title="Parar e registrar">
                          <Square size={13} />
                        </button>
                      </div>
                    )}
                    <div style={{ marginTop: 8 }}>
                      {timeEntries.slice(0, 6).map(e => {
                        const ee = editEntry;
                        return ee && ee.id === e.id ? (
                          <div key={e.id} className="cw-ts-form" style={{ marginTop: 4 }}>
                            <div className="cw-input" style={{ display: "flex", alignItems: "center" }}>
                              <CwDate value={ee.date} onChange={v => setEditEntry(prev => prev ? { ...prev, date: v } : prev)} />
                            </div>
                            <input className="cw-input" type="number" step="0.25" value={ee.hours}
                              onChange={ev => setEditEntry(prev => prev ? { ...prev, hours: ev.target.value } : prev)} placeholder="Horas" />


                            <button type="button" className="cw-btn cw-btn-sm cw-btn-primary" disabled={updateTime.isPending}
                              onClick={() => updateTime.mutate()}>Salvar</button>
                            <button type="button" className="cw-icon-btn" onClick={() => setEditEntry(null)} title="Cancelar">
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div key={e.id} className="cw-ts-row">
                            <span className="cw-ts-when">
                              {new Date(e.started_at ?? e.created_at).toLocaleDateString("pt-BR")}
                            </span>
                            <button type="button" className="cw-ts-edit"
                              onClick={() => setEditEntry({
                                id: e.id,
                                hours: String(Math.round((e.duration_seconds / 3600) * 100) / 100),
                                date: new Date(e.started_at ?? e.created_at).toISOString().slice(0, 10),
                              })}
                              title="Editar lançamento">{fmtHours(e.duration_seconds)}</button>
                            <button type="button" className="cw-icon-btn" onClick={() => removeTime.mutate(e.id)}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}

                      {timeEntries.length === 0 && <span className="cw-hint">Nenhum apontamento ainda.</span>}
                    </div>

                    <div className="cw-ts-form">
                      <div className="cw-input" style={{ display: "flex", alignItems: "center" }}>
                        <CwDate value={tsDate} onChange={setTsDate} />
                      </div>
                      <input className="cw-input" type="number" step="0.25" value={tsHours}
                        onChange={e => setTsHours(e.target.value)} placeholder="Horas" />
                      <button type="button" className="cw-btn cw-btn-sm" disabled={addTime.isPending}
                        onClick={() => addTime.mutate()}>Lançar</button>
                    </div>
                  </>

                )}
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
                <h5><Info size={15} /> Observações</h5>
                <textarea className="cw-textarea" rows={3} value={notes}
                  onChange={e => setNotes(e.target.value)} placeholder="Notas internas" />
              </div>
            </div>
          </div>

          {/* RODAPÉ */}
          <div className="cw-footer">
            <div className="cw-foot-group">
              <button type="button" className="cw-btn cw-btn-secondary" onClick={requestClose}>Cancelar</button>
              {isEdit && (
                <button type="button" className="cw-btn cw-btn-ghost" style={{ color: "var(--cw-danger)" }}
                  disabled={remove.isPending}
                  onClick={() => setAskDelete(true)}>
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
        {confirmDialogs}
      </>
    );
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) requestClose(); }}>
      <DialogContent
        className="cw cw-shell p-0 gap-0 border-0 overflow-hidden [&>button:last-of-type]:hidden w-[calc(100vw-2rem)] max-w-[1400px] sm:max-w-[1400px]"
        style={{ boxShadow: "0 24px 60px rgba(15,25,40,.20)" }}
      >
        {windowEl}
      </DialogContent>
      {confirmDialogs}
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
