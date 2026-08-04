import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Wallet, Plus, Trash2, CheckCircle2, BadgeDollarSign, Clock, PieChart, Users, Ban,
} from "lucide-react";
import { toast } from "sonner";
import "@/prj07.css";

type CostKind = "per_task" | "per_hour" | "one_off" | "allocated_internal";
type CostStatus = "pending" | "confirmed" | "paid" | "cancelled";

const KIND_LABEL: Record<CostKind, string> = {
  per_task: "Por tarefa",
  per_hour: "Por hora",
  one_off: "Avulso",
  allocated_internal: "Interno (alocação)",
};
const KIND_TONE: Record<CostKind, string> = {
  per_task: "blue",
  per_hour: "purple",
  one_off: "amber",
  allocated_internal: "gray",
};
const STATUS_LABEL: Record<CostStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  paid: "Pago",
  cancelled: "Cancelado",
};
const STATUS_TONE: Record<CostStatus, string> = {
  pending: "amber",
  confirmed: "blue",
  paid: "green",
  cancelled: "gray",
};

const money = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dt = (s: string | null) =>
  s ? new Date(`${s.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const initials = (n?: string | null) =>
  (n ?? "—").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "—";

type CostRow = {
  id: string;
  project_id: string;
  task_id: string | null;
  team_member_id: string | null;
  kind: CostKind;
  amount: number;
  hours: number | null;
  description: string | null;
  status: CostStatus;
  occurred_on: string;
  team_members?: { name: string } | null;
  tasks?: { title: string } | null;
};

export function ProjectCostsTab({ projectId, organizationId }: { projectId: string; organizationId: string }) {
  const qc = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | CostStatus>("all");

  const { data: costs = [] } = useQuery<CostRow[]>({
    queryKey: ["project-costs", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_costs")
        .select("id,project_id,task_id,team_member_id,kind,amount,hours,description,status,occurred_on, team_members(name), tasks(title)")
        .eq("project_id", projectId)
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CostRow[];
    },
  });

  const totals = useMemo(() => costs.reduce(
    (acc, c) => {
      const v = Number(c.amount ?? 0);
      if (c.status === "cancelled") return acc;
      acc.total += v;
      if (c.kind === "allocated_internal") acc.internal += v; else acc.variable += v;
      if (c.status === "paid") acc.paid += v;
      else if (c.status === "confirmed") acc.confirmed += v;
      else acc.pending += v;
      acc.hours += Number(c.hours ?? 0);
      return acc;
    },
    { total: 0, variable: 0, internal: 0, paid: 0, confirmed: 0, pending: 0, hours: 0 }
  ), [costs]);

  const byKind = useMemo(() => {
    const map = new Map<CostKind, number>();
    for (const c of costs) {
      if (c.status === "cancelled") continue;
      map.set(c.kind, (map.get(c.kind) ?? 0) + Number(c.amount ?? 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [costs]);

  const rows = filter === "all" ? costs : costs.filter(c => c.status === filter);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CostStatus }) => {
      const { error } = await supabase.from("project_costs").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-costs", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_costs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-costs", projectId] }); toast.success("Custo removido"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const KIND_COLOR: Record<string, string> = {
    per_task: "#2F6BEF", per_hour: "#8B5CF6", one_off: "#F59E0B", allocated_internal: "#5B6779",
  };

  return (
    <div className="prj07">
      <div className="p7-kpis">
        <Kpi icon={Wallet} color="#EF4444" label="Custo total" value={money(totals.total)} sub={`${costs.length} lançamento(s)`} />
        <Kpi icon={BadgeDollarSign} color="#F59E0B" label="Custo variável" value={money(totals.variable)} sub="Fornecedores, avulsos e por tarefa" />
        <Kpi icon={Users} color="#5B6779" label="Alocação interna" value={money(totals.internal)} sub={`${totals.hours.toLocaleString("pt-BR")} h alocadas`} />
        <Kpi icon={CheckCircle2} color="#10B981" label="Confirmado / Pago" value={money(totals.confirmed + totals.paid)} sub={`Pago: ${money(totals.paid)}`} />
        <Kpi icon={Clock} color="#2F6BEF" label="Pendente" value={money(totals.pending)} sub="Aguardando confirmação" />
      </div>

      <div className="p7-split">
        <section className="p7-card">
          <div className="p7-card-h">
            <div>
              <div className="p7-ht"><Wallet /><span className="p7-card-t">Lançamentos de custo</span></div>
              <div className="p7-card-s">Gerados automaticamente pelas tarefas ou lançados manualmente.</div>
            </div>
            <button type="button" className="p7-btn primary" onClick={() => setNewOpen(true)}><Plus /> Lançar custo</button>
          </div>

          <div className="p7-filters">
            {([["all", "Todos"], ["pending", "Pendentes"], ["confirmed", "Confirmados"], ["paid", "Pagos"], ["cancelled", "Cancelados"]] as const).map(([id, label]) => (
              <button key={id} type="button" className={`p7-fchip${filter === id ? " on" : ""}`} onClick={() => setFilter(id as never)}>
                {label}
              </button>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="p7-empty">
              <b>Nenhum custo por aqui</b>
              {filter === "all" ? "Lance o primeiro custo do projeto para acompanhar a margem." : "Nenhum lançamento com este status."}
            </div>
          ) : (
            <table className="p7-table">
              <thead>
                <tr>
                  <th>Responsável / Origem</th>
                  <th>Tipo</th>
                  <th>Data</th>
                  <th style={{ textAlign: "right" }}>Horas</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div className="p7-who">
                        <span className="p7-av">{initials(c.team_members?.name)}</span>
                        <div style={{ minWidth: 0 }}>
                          <div className="p7-strong">{c.team_members?.name ?? "Sem responsável"}</div>
                          <div className="p7-sub">
                            {c.tasks?.title ? c.tasks.title : "Sem tarefa vinculada"}
                            {c.description ? ` · ${c.description}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`p7-badge ${KIND_TONE[c.kind]}`}>{KIND_LABEL[c.kind]}</span></td>
                    <td>{dt(c.occurred_on)}</td>
                    <td className="p7-num">{c.hours != null ? `${Number(c.hours).toLocaleString("pt-BR")} h` : "—"}</td>
                    <td className="p7-num p7-strong">{money(Number(c.amount ?? 0))}</td>
                    <td><span className={`p7-badge ${STATUS_TONE[c.status]}`}>{STATUS_LABEL[c.status]}</span></td>
                    <td>
                      <div className="p7-acts">
                        {c.status === "pending" && (
                          <button type="button" className="p7-iconbtn" title="Confirmar" onClick={() => updateStatus.mutate({ id: c.id, status: "confirmed" })}>
                            <CheckCircle2 />
                          </button>
                        )}
                        {c.status === "confirmed" && (
                          <button type="button" className="p7-iconbtn" title="Marcar como pago" onClick={() => updateStatus.mutate({ id: c.id, status: "paid" })}>
                            <BadgeDollarSign />
                          </button>
                        )}
                        {c.status !== "cancelled" && c.status !== "paid" && (
                          <button type="button" className="p7-iconbtn" title="Cancelar" onClick={() => updateStatus.mutate({ id: c.id, status: "cancelled" })}>
                            <Ban />
                          </button>
                        )}
                        <button type="button" className="p7-iconbtn danger" title="Excluir" onClick={() => remove.mutate(c.id)}>
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="p7-card" style={{ marginTop: 14 }}>
          <div className="p7-card-h">
            <div className="p7-ht"><PieChart /><span className="p7-card-t">Composição do custo</span></div>
          </div>
          {byKind.length === 0 ? (
            <div className="p7-empty">Sem dados ainda.</div>
          ) : (
            <div className="p7-brk">
              {byKind.map(([kind, value]) => {
                const pct = totals.total > 0 ? (value / totals.total) * 100 : 0;
                return (
                  <div key={kind} className="p7-brk-row">
                    <div className="p7-brk-top">
                      <b>{KIND_LABEL[kind]}</b>
                      <span className="p7-num">{money(value)}</span>
                    </div>
                    <div className="p7-bar"><i style={{ width: `${pct}%`, background: KIND_COLOR[kind] ?? "#2F6BEF" }} /></div>
                    <div className="p7-sub">{pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do custo total</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <NewCostDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        projectId={projectId}
        organizationId={organizationId}
        onCreated={() => { qc.invalidateQueries({ queryKey: ["project-costs", projectId] }); setNewOpen(false); }}
      />
    </div>
  );
}

function Kpi({ icon: Icon, color, label, value, sub }: {
  icon: typeof Wallet; color: string; label: string; value: string; sub: string;
}) {
  return (
    <div className="p7-kpi">
      <div className="p7-kpi-h">
        <span className="p7-ico" style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}><Icon /></span>
        <span className="p7-kpi-l">{label}</span>
      </div>
      <div className="p7-kpi-v">{value}</div>
      <div className="p7-kpi-s">{sub}</div>
    </div>
  );
}

function NewCostDialog({ open, onOpenChange, projectId, organizationId, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; projectId: string; organizationId: string; onCreated: () => void;
}) {
  const [memberId, setMemberId] = useState<string>("");
  const [taskId, setTaskId] = useState<string>("");
  const [kind, setKind] = useState<CostKind>("one_off");
  const [amount, setAmount] = useState<string>("");
  const [hours, setHours] = useState<string>("");
  const [occurredOn, setOccurredOn] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState<string>("");

  const { data: members = [] } = useQuery({
    queryKey: ["cost-team-members"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["cost-project-tasks", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("id,title").eq("project_id", projectId).order("created_at", { ascending: false });
      return (data ?? []) as { id: string; title: string }[];
    },
  });

  const save = async () => {
    if (!amount) { toast.error("Informe o valor"); return; }
    const { error } = await supabase.from("project_costs").insert({
      organization_id: organizationId,
      project_id: projectId,
      team_member_id: memberId || null,
      task_id: taskId || null,
      kind,
      amount: Number(amount),
      hours: hours ? Number(hours) : null,
      occurred_on: occurredOn,
      description: description || null,
      status: "pending",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Custo lançado");
    setMemberId(""); setTaskId(""); setAmount(""); setHours(""); setDescription(""); setKind("one_off");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl">
        <DialogHeader><DialogTitle>Lançar custo do projeto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Colaborador</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tarefa</Label>
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {tasks.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={kind} onValueChange={v => setKind(v as CostKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABEL) as CostKind[]).map(k => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Input type="date" value={occurredOn} onChange={e => setOccurredOn(e.target.value)} />
            </div>
          </div>
          {(kind === "per_hour" || kind === "allocated_internal") && (
            <div>
              <Label className="text-xs">Horas</Label>
              <Input type="number" step="0.25" value={hours} onChange={e => setHours(e.target.value)} />
            </div>
          )}
          <div>
            <Label className="text-xs">Observação</Label>
            <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}>Lançar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
