import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  X, Plus, Trash2, Check, Info, ChevronDown, ListChecks, DollarSign,
  Paperclip, Save, Clock, CalendarDays, Layers,
} from "lucide-react";
import "@/windows.css";

type Stage = "briefing" | "creation" | "review" | "approval" | "delivery";
const STAGES: { id: Stage; label: string }[] = [
  { id: "briefing", label: "Briefing" },
  { id: "creation", label: "Criação" },
  { id: "review", label: "Revisão" },
  { id: "approval", label: "Aprovação" },
  { id: "delivery", label: "Entrega" },
];

const PRIORITIES = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
  { value: "critical", label: "Crítica" },
];

type DeliverableDraft = {
  id: string; platform: string; type: string;
  billing_enabled: boolean; billing_value: number | null; delivered: boolean;
};
type ChecklistDraft = { id: string; title: string; done: boolean };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const uid = () => Math.random().toString(36).slice(2, 9);

export function NewTaskWindow({
  open, onOpenChange, defaultProjectId = null, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultProjectId?: string | null;
  onCreated?: (id: string) => void;
}) {
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId);
  const [taskTypeId, setTaskTypeId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [stage, setStage] = useState<Stage>("briefing");
  const [estimated, setEstimated] = useState<string>("");
  const [billingEnabled, setBillingEnabled] = useState(true);
  const [deliverables, setDeliverables] = useState<DeliverableDraft[]>([]);
  const [checklist, setChecklist] = useState<ChecklistDraft[]>([]);
  const [platformsSel, setPlatformsSel] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects_min"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const { data: taskTypes = [] } = useQuery({
    queryKey: ["task_types_min"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("task_types").select("id,name,default_value,active").order("name");
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
  const { data: platforms = [] } = useQuery({
    queryKey: ["platforms"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("platforms").select("id,name,active").order("sort_order");
      return ((data ?? []) as any[]).filter(p => p.active !== false);
    },
  });

  const billableTotal = useMemo(
    () => deliverables.filter(d => d.billing_enabled).reduce((s, d) => s + (d.billing_value ?? 0), 0),
    [deliverables],
  );
  const doneCount = checklist.filter(c => c.done).length;

  const reset = () => {
    setTitle(""); setDescription(""); setProjectId(defaultProjectId); setTaskTypeId(null);
    setAssigneeId(null); setDueDate(""); setPriority("medium"); setStage("briefing");
    setEstimated(""); setBillingEnabled(true); setDeliverables([]); setChecklist([]);
    setPlatformsSel([]); setNotes("");
  };
  const close = (o: boolean) => { onOpenChange(o); if (!o) reset(); };

  const create = useMutation({
    mutationFn: async (asDraft: boolean) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { data, error } = await supabase.from("tasks").insert({
        title: title.trim(),
        description: [description.trim(), notes.trim() && `\n\nObservações: ${notes.trim()}`].filter(Boolean).join("") || null,
        status: asDraft ? "todo" : "todo",
        priority: priority as any,
        project_id: projectId,
        assignee_id: assigneeId,
        due_date: dueDate || null,
        stage: stage as any,
        task_type_id: taskTypeId,
        estimated_hours: estimated ? Number(estimated) : null,
        billing_enabled: billingEnabled,
        billing_value: billableTotal || null,
        platform: platformsSel[0] ?? null,
        organization_id: profile.organization_id,
        deliverables: deliverables.map(d => ({
          id: d.id, platform: d.platform, type: d.type,
          billing_enabled: d.billing_enabled, billing_model: "per_task",
          billing_value: d.billing_value, delivered: d.delivered, invoiced: false,
        })) as any,
        subtasks: checklist as any,
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa criada");
      onCreated?.(id);
      close(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = title.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        className="cw p-0 gap-0 border-0 overflow-hidden [&>button:last-of-type]:hidden w-[calc(100vw-2rem)] max-w-[1105px] sm:max-w-[1105px]"
        style={{ borderRadius: 14, boxShadow: "0 24px 60px rgba(15,25,40,.20)" }}
      >
        <div className="cw-window">
          {/* HEADER */}
          <div className="cw-header">
            <span className="cw-title-icon"><ListChecks size={17} /></span>
            <div className="min-w-0 flex-1">
              <DialogTitle asChild><h2>Nova Tarefa</h2></DialogTitle>
              <p>Crie a tarefa, defina os entregáveis e acompanhe o fluxo de produção</p>
            </div>
            <button type="button" className="cw-close" onClick={() => close(false)} aria-label="Fechar"><X size={18} /></button>
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
            {STAGES.map((s, i) => {
              const activeIdx = STAGES.findIndex(x => x.id === stage);
              return (
                <div key={s.id} className={`cw-flow-step${s.id === stage ? " is-on" : ""}${i < activeIdx ? " is-done" : ""}`}>
                  <button type="button" className="cw-flow-dot" onClick={() => setStage(s.id)}>
                    {i < activeIdx ? <Check size={13} /> : i + 1}
                  </button>
                  <span className="cw-flow-label">{s.label}</span>
                </div>
              );
            })}
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
                <div className="cw-section-head"><div><h4>Plataformas e canais</h4></div></div>
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
                    Os arquivos podem ser anexados na aba Arquivos do projeto após criar a tarefa.
                  </span>
                </div>
              </div>
            </div>

            {/* COLUNA LATERAL */}
            <div className="cw-side">
              <div className="cw-side-card">
                <h5><Layers size={15} /> Resumo</h5>
                <div className="cw-side-line"><span>Etapa atual</span><span>{STAGES.find(s => s.id === stage)?.label}</span></div>
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
            </div>
            <div className="cw-foot-group">
              <button type="button" className="cw-btn cw-btn-secondary" disabled={!canSave || create.isPending}
                onClick={() => create.mutate(true)}>
                <Save /> Salvar rascunho
              </button>
              <button type="button" className="cw-btn cw-btn-primary" disabled={!canSave || create.isPending}
                onClick={() => create.mutate(false)}>
                {create.isPending ? "Criando…" : "Criar tarefa"} <Check />
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
