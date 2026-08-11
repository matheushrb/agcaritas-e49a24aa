import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  X, Save, Minus, Maximize2, PanelRight, Trash2, Receipt,
  ArrowDownCircle, ArrowUpCircle, ChevronDown, Info, Repeat,
} from "lucide-react";
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
  { value: "pending", label: "Pendente" },
  { value: "pending_invoice", label: "A faturar" },
  { value: "paid", label: "Pago" },
  { value: "overdue", label: "Atrasado" },
  { value: "cancelled", label: "Cancelado" },
  { value: "draft", label: "Rascunho" },
];

const PAYMENT_METHODS = [
  "PIX", "Boleto", "Boleto com PIX", "Transferência", "Cartão de crédito", "Dinheiro",
];

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  }, [open, entry, defaultNature]);

  const value = Number(String(amount).replace(",", ".") || 0);
  const canSave = description.trim().length > 0 && value > 0;

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



  const windowEl = (
    <div className="cw-window">
      <div className="cw-header">
        <span className="cw-title-icon"><Receipt size={17} /></span>
        <div className="min-w-0 flex-1">
          <Title><h2>{isEdit ? (description || "Lançamento financeiro") : "Novo lançamento financeiro"}</h2></Title>
          <p>Registre entradas e saídas, vincule a cliente/projeto e acompanhe o status de pagamento</p>
        </div>
        <div className="cw-head-actions">
          <button type="button" className="cw-btn cw-btn-primary cw-btn-sm" disabled={!canSave || save.isPending}
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

      <div className="cw-props">
        <div className="cw-prop">
          <div className="cw-label">Status</div>
          <div className="cw-prop-value">
            <select className="cw-bare" value={status} onChange={e => setStatus(e.target.value)}>
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <ChevronDown size={14} style={{ color: "var(--cw-muted)", flexShrink: 0 }} />
          </div>
        </div>
        <div className="cw-prop">
          <div className="cw-label">Cliente</div>
          <div className="cw-prop-value">
            <select className="cw-bare" value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="">Sem cliente</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown size={14} style={{ color: "var(--cw-muted)", flexShrink: 0 }} />
          </div>
        </div>
        <div className="cw-prop">
          <div className="cw-label">Projeto</div>
          <div className="cw-prop-value">
            <select className="cw-bare" value={projectId} onChange={e => setProjectId(e.target.value)}>
              <option value="">Sem projeto</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronDown size={14} style={{ color: "var(--cw-muted)", flexShrink: 0 }} />
          </div>
        </div>
        <div className="cw-prop">
          <div className="cw-label">Colaborador</div>
          <div className="cw-prop-value">
            <select className="cw-bare" value={collaboratorId} onChange={e => setCollaboratorId(e.target.value)}>
              <option value="">Sem colaborador</option>
              {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <ChevronDown size={14} style={{ color: "var(--cw-muted)", flexShrink: 0 }} />
          </div>
        </div>
        <div className="cw-prop">
          <div className="cw-label">Vencimento</div>
          <div className="cw-prop-value">
            <input type="date" className="cw-bare" value={dueDate ?? ""} onChange={e => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="cw-prop">
          <div className="cw-label">Competência</div>
          <div className="cw-prop-value">
            <input type="month" className="cw-bare" value={competence} onChange={e => setCompetence(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="cw-content">
        <div className="cw-grid cw-grid-2">
          <div className="cw-field cw-span-full">
            <label className="cw-label">Tipo de lançamento<span className="req">*</span></label>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setNature("revenue")}
                className={`cw-btn ${nature === "revenue" ? "cw-btn-primary" : "cw-btn-secondary"}`}>
                <ArrowDownCircle /> Receita
              </button>
              <button type="button" onClick={() => setNature("expense")}
                className={`cw-btn ${nature === "expense" ? "cw-btn-primary" : "cw-btn-secondary"}`}>
                <ArrowUpCircle /> Despesa
              </button>
            </div>
          </div>

          <div className="cw-field cw-span-full">
            <label className="cw-label">Descrição<span className="req">*</span></label>
            <input className="cw-input" autoFocus placeholder="Ex.: Mensalidade Bella Estética — Nov/25"
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className="cw-field">
            <label className="cw-label">Valor (R$)<span className="req">*</span></label>
            <input className="cw-input" inputMode="decimal" placeholder="0,00"
              value={amount} onChange={e => setAmount(e.target.value)} />
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

          <div className="cw-field">
            <label className="cw-label">Resumo</label>
            <div className={`cw-callout ${nature === "expense" ? "" : "is-green"}`}>
              <Info size={14} />
              <span>
                {nature === "expense" ? "Saída" : "Entrada"} de <strong>{money(value)}</strong>
                {dueDate ? ` com vencimento em ${new Date(`${dueDate}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}.
              </span>
            </div>
          </div>

          {!isEdit && (
            <div className="cw-field cw-span-full">
              <label className="cw-label">Recorrência</label>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" role="switch" checked={repeat} onChange={e => setRepeat(e.target.checked)} />
                  <Repeat size={14} /> Repetir mensalmente
                </label>
                {repeat && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--cw-muted)" }}>Dia do mês</span>
                      <input
                        className="cw-input" type="number" min={1} max={28} style={{ width: 90 }}
                        value={dayOfMonth || String(effectiveDay)}
                        onChange={e => setDayOfMonth(e.target.value)}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "var(--cw-muted)" }}>Repetir até</span>
                      <input className="cw-input" type="date" style={{ width: 170 }}
                        value={repeatUntil} onChange={e => setRepeatUntil(e.target.value)} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}


          <div className="cw-field cw-span-full">
            <label className="cw-label">Observações internas</label>
            <textarea className="cw-textarea" rows={3} placeholder="Notas (opcional)"
              value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="cw-footer">
        <span style={{ fontSize: 11, color: "var(--cw-muted)" }}>{isEdit ? "Editando lançamento existente" : "Novo lançamento"}</span>
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
        className="cw cw-shell p-0 gap-0 border-0 overflow-hidden [&>button:last-of-type]:hidden w-[calc(100vw-2rem)] max-w-[1180px] sm:max-w-[1180px]"
        style={{ boxShadow: "0 24px 60px rgba(15,25,40,.20)" }}
      >
        {windowEl}
      </DialogContent>
    </Dialog>
  );
}
