import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  X, Save, Minus, Maximize2, PanelRight, Trash2, Receipt,
  ArrowDownLeft, ArrowUpRight, ChevronDown, Info, Repeat, ListChecks,
  Calendar, FileText, Building2, Tag, CreditCard, Wallet,
} from "lucide-react";
import { ACCOUNTING_NATURES } from "@/lib/finance-analytics";
import "@/windows.css";

export type FinanceEntry = {
  id: string;
  description: string | null;
  amount: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  client_id: string | null;
  project_id: string | null;
  nature: string | null;
  category: string | null;
  competence_month: string | null;
  accounting_nature?: string | null;
  task_ids?: string[] | null;
};

type ProjectTask = {
  id: string;
  title: string;
  status: string;
  billing_value: number | null;
  billing_base_value: number | null;
  billed: boolean;
};

const STATUSES = [
  { value: "pending", label: "Pendente", color: "#d97706" },
  { value: "pending_invoice", label: "A faturar", color: "#7c3aed" },
  { value: "paid", label: "Pago", color: "#16a34a" },
  { value: "overdue", label: "Atrasado", color: "#dc2626" },
  { value: "cancelled", label: "Cancelado", color: "#6b7280" },
  { value: "draft", label: "Rascunho", color: "#6b7280" },
];

const PAYMENT_METHODS = [
  "PIX", "Boleto", "Boleto com PIX", "Transferência", "Cartão de crédito", "Dinheiro",
];

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry?: FinanceEntry | null;
  clients: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  teamMembers?: { id: string; name: string; payment_day?: number | null }[];
  defaultNature?: "revenue" | "expense";
  onSaved?: (id: string) => void;
};

export function FinanceEntryWindow({
  open, onOpenChange, entry = null, clients, projects, teamMembers = [], defaultNature = "revenue", onSaved,
}: Props) {
  const qc = useQueryClient();
  const isEdit = !!entry?.id;

  const [nature, setNature] = useState<"revenue" | "expense">(defaultNature);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [competence, setCompetence] = useState("");
  const [status, setStatus] = useState("pending");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [collaboratorId, setCollaboratorId] = useState("");
  const [category, setCategory] = useState("");
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [repeatUntil, setRepeatUntil] = useState("");
  const [mode, setMode] = useState<"modal" | "docked" | "minimized">("modal");
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [accNature, setAccNature] = useState("recebimento_cliente");

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["finance_categories", nature],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("finance_categories")
        .select("name")
        .eq("nature", nature)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return ((data ?? []) as { name: string }[]).map(c => c.name);
    },
  });

  const { data: projectTasks = [] } = useQuery<ProjectTask[]>({
    queryKey: ["entry-project-tasks", projectId],
    enabled: open && !!projectId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tasks")
        .select("id, title, status, billing_value, billing_base_value, billed")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProjectTask[];
    },
  });

  const taskValue = (t: ProjectTask) => Number(t.billing_value ?? t.billing_base_value ?? 0);
  const selectedTasks = projectTasks.filter(t => taskIds.includes(t.id));
  const selectedTotal = selectedTasks.reduce((acc, t) => acc + taskValue(t), 0);
  const toggleTask = (id: string) =>
    setTaskIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  useEffect(() => {
    if (!open) return;
    setMode("modal");
    setNature((entry?.nature === "expense" ? "expense" : entry?.nature === "revenue" ? "revenue" : defaultNature));
    setDescription(entry?.description ?? "");
    setAmount(entry ? String(Math.abs(Number(entry.amount ?? 0))) : "");
    setDueDate(entry?.due_date ?? new Date().toISOString().slice(0, 10));
    setCompetence(entry?.competence_month ? entry.competence_month.slice(0, 7) : new Date().toISOString().slice(0, 7));
    setStatus(entry?.status ?? "pending");
    setClientId(entry?.client_id ?? "");
    setProjectId(entry?.project_id ?? "");
    setCollaboratorId((entry as any)?.collaborator_id ?? "");
    setCategory(entry?.category ?? "");
    setMethod(entry?.payment_method ?? "");
    setNotes("");
    setRepeat(false);
    setDayOfMonth("");
    setRepeatUntil("");
    setAccNature((entry as any)?.accounting_nature ?? (((entry?.nature ?? defaultNature) === "expense") ? "custo_variavel" : "recebimento_cliente"));
    setTaskIds(Array.isArray((entry as any)?.task_ids) ? ((entry as any).task_ids as string[]) : []);
  }, [open, entry, defaultNature]);

  const value = Number(String(amount).replace(",", ".") || 0);
  const canSave = description.trim().length > 0 && value > 0;
  const statusInfo = STATUSES.find(s => s.value === status) ?? STATUSES[0];

  const memberPaymentDay = teamMembers.find(m => m.id === collaboratorId)?.payment_day ?? null;
  const effectiveDay = (() => {
    const typed = Number(dayOfMonth);
    if (dayOfMonth && typed >= 1 && typed <= 28) return typed;
    if (memberPaymentDay && memberPaymentDay >= 1 && memberPaymentDay <= 28) return memberPaymentDay;
    const d = dueDate ? Number(dueDate.slice(8, 10)) : new Date().getDate();
    return Math.min(Math.max(d || 1, 1), 28);
  })();

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        description: description.trim(),
        amount: value,
        status,
        nature,
        category: category || null,
        due_date: dueDate || null,
        competence_month: competence ? `${competence}-01` : null,
        client_id: clientId || null,
        project_id: projectId || null,
        collaborator_id: collaboratorId || null,
        payment_method: method || null,
        accounting_nature: accNature,
        task_ids: projectId ? taskIds : [],
        paid_at: status === "paid" ? (entry?.paid_at ?? new Date().toISOString()) : null,
      };
      if (isEdit) {
        const { error } = await (supabase as any).from("charges").update(payload).eq("id", entry!.id);
        if (error) throw error;
        return entry!.id;
      }
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");

      if (repeat) {
        const { data, error } = await (supabase as any)
          .from("recurring_charges")
          .insert({
            organization_id: profile.organization_id,
            description: description.trim(),
            amount: value,
            nature,
            category: category || null,
            day_of_month: effectiveDay,
            client_id: clientId || null,
            project_id: projectId || null,
            collaborator_id: collaboratorId || null,
            payment_method: method || null,
            start_date: dueDate || new Date().toISOString().slice(0, 10),
            end_date: repeatUntil || null,
          })
          .select("id")
          .single();
        if (error) throw error;
        const { error: rpcError } = await (supabase as any).rpc("ensure_recurring_charges");
        if (rpcError) throw rpcError;
        return data.id as string;
      }

      const { data, error } = await (supabase as any)
        .from("charges")
        .insert({ ...payload, organization_id: profile.organization_id })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["charges"] });
      qc.invalidateQueries({ queryKey: ["recurring_charges"] });
      qc.invalidateQueries({ queryKey: ["dashboard-v3"] });
      toast.success(isEdit ? "Lançamento atualizado" : repeat ? "Recorrência criada" : "Lançamento criado");
      onSaved?.(id);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("charges").delete().eq("id", entry!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["charges"] });
      toast.success("Lançamento excluído");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) return null;

  if (mode === "minimized") {
    return (
      <div className="cw cw-mini">
        <span className="cw-title-icon"><Receipt size={15} /></span>
        <span className="cw-mini-title">{description || (isEdit ? "Lançamento" : "Novo lançamento")}</span>
        <button type="button" className="cw-close" onClick={() => setMode("modal")} aria-label="Restaurar"><Maximize2 size={16} /></button>
        <button type="button" className="cw-close" onClick={() => onOpenChange(false)} aria-label="Fechar"><X size={16} /></button>
      </div>
    );
  }

  const Title = ({ children }: { children: React.ReactElement }) =>
    mode === "modal" ? <DialogTitle asChild>{children}</DialogTitle> : children;

  const isRevenue = nature === "revenue";

  const windowEl = (
    <div className="cw-window fe-window" data-nature={nature}>
      {/* Header */}
      <div className="cw-header fe-header">
        <span className="cw-title-icon fe-header-ico"><Receipt size={17} /></span>
        <div className="min-w-0 flex-1">
          <Title><h2>{isEdit ? (description || "Lançamento financeiro") : "Novo lançamento"}</h2></Title>
          <p>Registre entradas e saídas com vínculo a cliente, projeto e contabilidade</p>
        </div>
        <div className="cw-head-actions">
          <button type="button" className="cw-btn cw-btn-primary fe-save-btn" disabled={!canSave || save.isPending}
            onClick={() => save.mutate()}><Save /> {save.isPending ? "Salvando…" : "Salvar"}</button>
          {isEdit && (
            <button type="button" className="cw-close cw-close-danger" aria-label="Excluir" disabled={remove.isPending}
              onClick={() => { if (confirm("Excluir este lançamento?")) remove.mutate(); }}><Trash2 size={17} /></button>
          )}
          <button type="button" className="cw-close" onClick={() => setMode("minimized")} aria-label="Minimizar"><Minus size={18} /></button>
          <button type="button" className="cw-close" onClick={() => setMode(mode === "docked" ? "modal" : "docked")}
            aria-label="Lateralizar"><PanelRight size={17} /></button>
          <button type="button" className="cw-close" onClick={() => onOpenChange(false)} aria-label="Fechar"><X size={18} /></button>
        </div>
      </div>

      {/* Hero: type toggle + amount */}
      <div className="fe-hero">
        <div className="fe-type-toggle">
          <button type="button"
            className={`fe-type-btn ${isRevenue ? "is-on is-revenue" : ""}`}
            onClick={() => { setNature("revenue"); setAccNature("recebimento_cliente"); }}>
            <ArrowDownLeft size={18} />
            <span>Receita</span>
          </button>
          <button type="button"
            className={`fe-type-btn ${!isRevenue ? "is-on is-expense" : ""}`}
            onClick={() => { setNature("expense"); setAccNature("custo_variavel"); }}>
            <ArrowUpRight size={18} />
            <span>Despesa</span>
          </button>
        </div>

        <div className="fe-amount-area">
          <label className="fe-amount-label">Valor do lançamento</label>
          <div className="fe-amount-row">
            <span className="fe-currency">R$</span>
            <input
              className="fe-amount-input"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              autoFocus
            />
            <div className="fe-status-badge" style={{ "--sc": statusInfo.color } as React.CSSProperties}>
              <i />
              <select value={status} onChange={e => setStatus(e.target.value)}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <ChevronDown size={12} />
            </div>
          </div>
          <div className="fe-amount-sub">
            {description ? description : "Descreva o lançamento abaixo"}
            {dueDate && <span className="fe-amount-date"><Calendar size={12} /> {fmtDate(dueDate)}</span>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="cw-content fe-content">
        {/* Description */}
        <div className="fe-field fe-desc-field">
          <label className="cw-label">Descrição<span className="req">*</span></label>
          <input className="cw-input fe-desc-input" placeholder="Ex.: Mensalidade Bella Estética — Nov/25"
            value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        {/* Section: Vinculação */}
        <div className="fe-section">
          <div className="fe-section-head">
            <Building2 size={15} />
            <h4>Vinculação</h4>
          </div>
          <div className="fe-grid-3">
            <div className="cw-field">
              <label className="cw-label">Cliente</label>
              <div className="cw-select-wrap">
                <select className="cw-select" value={clientId} onChange={e => setClientId(e.target.value)}>
                  <option value="">Sem cliente</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown size={14} />
              </div>
            </div>
            <div className="cw-field">
              <label className="cw-label">Projeto</label>
              <div className="cw-select-wrap">
                <select className="cw-select" value={projectId} onChange={e => setProjectId(e.target.value)}>
                  <option value="">Sem projeto</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown size={14} />
              </div>
            </div>
            <div className="cw-field">
              <label className="cw-label">Colaborador</label>
              <div className="cw-select-wrap">
                <select className="cw-select" value={collaboratorId} onChange={e => setCollaboratorId(e.target.value)}>
                  <option value="">Sem colaborador</option>
                  {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <ChevronDown size={14} />
              </div>
            </div>
          </div>
        </div>

        {/* Section: Datas */}
        <div className="fe-section">
          <div className="fe-section-head">
            <Calendar size={15} />
            <h4>Datas</h4>
          </div>
          <div className="fe-grid-3">
            <div className="cw-field">
              <label className="cw-label">Vencimento</label>
              <input type="date" className="cw-input" value={dueDate ?? ""} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Competência</label>
              <input type="month" className="cw-input" value={competence} onChange={e => setCompetence(e.target.value)} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Categoria</label>
              <div className="cw-select-wrap">
                <select className="cw-select" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">Sem categoria</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} />
              </div>
            </div>
          </div>
        </div>

        {/* Section: Contabilidade */}
        <div className="fe-section">
          <div className="fe-section-head">
            <Wallet size={15} />
            <h4>Contabilidade</h4>
          </div>
          <div className="fe-grid-2">
            <div className="cw-field">
              <label className="cw-label">Natureza contábil</label>
              <div className="cw-select-wrap">
                <select className="cw-select" value={accNature} onChange={e => setAccNature(e.target.value)}>
                  {ACCOUNTING_NATURES.filter(n => n.side === nature).map(n => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
              <span className="fe-hint">
                {ACCOUNTING_NATURES.find(n => n.value === accNature)?.hint}
              </span>
            </div>
            <div className="cw-field">
              <label className="cw-label">Forma de pagamento</label>
              <div className="cw-select-wrap">
                <select className="cw-select" value={method} onChange={e => setMethod(e.target.value)}>
                  <option value="">Não definida</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <ChevronDown size={14} />
              </div>
            </div>
          </div>
        </div>

        {/* Tasks linked */}
        {!!projectId && (
          <div className="fe-section">
            <div className="fe-section-head">
              <ListChecks size={15} />
              <h4>Tarefas incluídas</h4>
            </div>
            {projectTasks.length === 0 ? (
              <div className="cw-callout"><Info size={14} /><span>Este projeto ainda não possui tarefas.</span></div>
            ) : (
              <>
                <div className="fe-tasks-list">
                  {projectTasks.map(t => {
                    const checked = taskIds.includes(t.id);
                    return (
                      <label key={t.id} className={`fe-task-row ${checked ? "is-checked" : ""}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleTask(t.id)} />
                        <span className="fe-task-title">{t.title}</span>
                        {t.billed && <span className="fe-task-billed">já faturada</span>}
                        <strong className="fe-task-val">{money(taskValue(t))}</strong>
                      </label>
                    );
                  })}
                </div>
                <div className="fe-tasks-bar">
                  <span className="fe-tasks-sum">
                    {taskIds.length} tarefa(s) — soma {money(selectedTotal)}
                  </span>
                  <button type="button" className="cw-btn cw-btn-secondary cw-btn-sm"
                    onClick={() => setTaskIds(projectTasks.map(t => t.id))}>Selecionar todas</button>
                  <button type="button" className="cw-btn cw-btn-secondary cw-btn-sm"
                    onClick={() => setTaskIds([])}>Limpar</button>
                  <button type="button" className="cw-btn cw-btn-primary cw-btn-sm" disabled={selectedTotal <= 0}
                    onClick={() => setAmount(String(selectedTotal))}>Usar soma como valor</button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Recurrence */}
        {!isEdit && (
          <div className="fe-section">
            <div className="fe-section-head">
              <Repeat size={15} />
              <h4>Recorrência</h4>
            </div>
            <div className="fe-repeat-row">
              <label className="fe-switch-label">
                <input type="checkbox" role="switch" checked={repeat} onChange={e => setRepeat(e.target.checked)} />
                <Repeat size={14} /> Repetir mensalmente
              </label>
              {repeat && (
                <div className="fe-repeat-opts">
                  <div className="fe-repeat-field">
                    <span>Dia do mês</span>
                    <input className="cw-input" type="number" min={1} max={28} style={{ width: 80 }}
                      value={dayOfMonth || String(effectiveDay)}
                      onChange={e => setDayOfMonth(e.target.value)} />
                  </div>
                  <div className="fe-repeat-field">
                    <span>Repetir até</span>
                    <input className="cw-input" type="date" style={{ width: 160 }}
                      value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="fe-section">
          <div className="fe-section-head">
            <FileText size={15} />
            <h4>Observações internas</h4>
          </div>
          <textarea className="cw-textarea" rows={3} placeholder="Notas internas (opcional)"
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      {/* Footer */}
      <div className="cw-footer fe-footer">
        <span className="fe-foot-info">
          {isEdit ? "Editando lançamento existente" : "Novo lançamento"}
          {" · "}
          <strong style={{ color: isRevenue ? "var(--cw-green)" : "var(--cw-danger)" }}>
            {isRevenue ? "Entrada" : "Saída"} {money(value)}
          </strong>
        </span>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button type="button" className="cw-btn cw-btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
          <button type="button" className="cw-btn cw-btn-primary" disabled={!canSave || save.isPending}
            onClick={() => save.mutate()}>
            {save.isPending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar lançamento"} <Save />
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
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        className="cw cw-shell p-0 gap-0 border-0 overflow-hidden [&>button:last-of-type]:hidden w-[calc(100vw-2rem)] max-w-[920px] sm:max-w-[920px]"
        style={{ boxShadow: "0 24px 60px rgba(15,25,40,.20)" }}
      >
        {windowEl}
      </DialogContent>
    </Dialog>
  );
}
