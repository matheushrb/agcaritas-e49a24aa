import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  X, Plus, Trash2, Check, Info, ChevronDown, ListChecks, DollarSign,
  Paperclip, Save, Clock, CalendarDays, Layers, Trash, Minus, Maximize2, PanelRight,
  Play, Square, Radio, SlidersHorizontal,
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
  due_date?: string | null;
  invoiced?: boolean;
};
type ChecklistDraft = { id: string; title: string; done: boolean };

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
  const [liveItems, setLiveItems] = useState<LiveDraft[]>([]);
  const [tech, setTech] = useState<TechSheet>(EMPTY_TECH);
  const [tab, setTab] = useState<"details" | "live" | "tech">("details");
  const setT = (k: keyof TechSheet, v: string) => setTech(t => ({ ...t, [k]: v }));


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
    return allPlatforms.filter((p: any) =>
      set.has(String(p.name).toLowerCase()) || set.has(String(p.id).toLowerCase()));
  }, [allPlatforms, projectId, projectPlatformNames]);

  /* Remove seleções que não pertencem mais às plataformas do projeto. */
  useEffect(() => {
    if (!projectId || projectPlatformNames.length === 0) return;
    const allowed = new Set(platforms.map((p: any) => String(p.name)));
    setPlatformsSel(sel => (sel.every(s => allowed.has(s)) ? sel : sel.filter(s => allowed.has(s))));
  }, [projectId, platforms, projectPlatformNames.length]);

  /* ---------- Etapas: do tipo de tarefa (quando houver) ou padrão ---------- */
  const { data: typeStages = [] } = useTaskTypeStages(taskTypeId);

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
        due_date: d.due_date ?? null,
        invoiced: !!d.invoiced,
      })),
    );
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
  const { data: timeEntries = [] } = useQuery({
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




  const reset = () => {
    setTitle(""); setDescription(""); setProjectId(defaultProjectId); setTaskTypeId(null);
    setAssigneeId(null); setDueDate(""); setPriority("medium"); setStatus("todo"); setStage("briefing"); setCurrentStageId(null);
    setEstimated(""); setBillingEnabled(true); setBaseValue(""); setDeliverables([]); setChecklist([]);
    setPlatformsSel([]); setNotes(""); setLiveItems([]); setTech(EMPTY_TECH); setTab("details");
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
    progress,

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
      due_date: d.due_date || null,
    })) as any,
    live_items: liveItems as any,
    tech_sheet: tech as any,
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

  if (mode === "minimized") {
    return (
      <div className="cw cw-mini">
        <span className="cw-title-icon"><ListChecks size={15} /></span>
        <span className="cw-mini-title">{title || (isEdit ? "Tarefa" : "Nova Tarefa")}</span>
        {timerChip}
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
                </button>
              ))}
            </div>
            <p className="cw-stageband-hint">
              Ao mudar a etapa, o status é sincronizado automaticamente. Você pode mudar livremente entre etapas.
            </p>
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
                    onClick={() => setDeliverables(d => [...d, { id: uid(), platform: platformsSel[0] ?? "", type: "", billing_enabled: billingEnabled, billing_value: null, delivered: false, due_date: null }])}>
                    <Plus /> Adicionar entregável
                  </button>
                </div>
                <table className="cw-table">
                  <thead>
                    <tr>
                      <th style={{ width: 140 }}>Plataforma</th>
                      <th>Formato / entrega</th>
                      <th style={{ width: 140 }}>Prazo</th>
                      <th style={{ width: 90 }}>Faturável</th>
                      <th style={{ width: 110 }}>Valor</th>
                      <th style={{ width: 120 }}>Entrega</th>
                      <th style={{ width: 56 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {deliverables.length === 0 && (
                      <tr><td colSpan={7} className="cw-mut" style={{ textAlign: "center" }}>Nenhum entregável adicionado.</td></tr>
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
                          <input type="date" className="cw-table-inline-input" value={d.due_date ?? ""}
                            style={late ? { color: "#e14545", fontWeight: 600 } : undefined}
                            onChange={e => setDeliverables(list => list.map(x => x.id === d.id ? { ...x, due_date: e.target.value || null } : x))} />
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
                            onClick={() => setDeliverables(list => list.map(x => x.id === d.id ? { ...x, delivered: !x.delivered } : x))}>
                            {d.delivered ? <><Check size={12} /> Entregue</> : late ? "Atrasado" : "Marcar entregue"}
                          </button>
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
                  {platforms.length === 0 && (
                    <span style={{ fontSize: 11, color: "var(--cw-muted)" }}>
                      {projectId
                        ? "Nenhuma plataforma habilitada neste projeto — edite o projeto para liberar."
                        : "Cadastre plataformas em Configurações."}
                    </span>
                  )}
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
                      {timeEntries.slice(0, 6).map(e => (
                        editEntry?.id === e.id ? (
                          <div key={e.id} className="cw-ts-form" style={{ marginTop: 4 }}>
                            <input className="cw-input" type="date" value={editEntry.date}
                              onChange={ev => setEditEntry({ ...editEntry, date: ev.target.value })} />
                            <input className="cw-input" type="number" step="0.25" value={editEntry.hours}
                              onChange={ev => setEditEntry({ ...editEntry, hours: ev.target.value })} placeholder="Horas" />
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
                        )
                      ))}
                      {timeEntries.length === 0 && <span className="cw-hint">Nenhum apontamento ainda.</span>}
                    </div>

                    <div className="cw-ts-form">
                      <input className="cw-input" type="date" value={tsDate} onChange={e => setTsDate(e.target.value)} />
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
