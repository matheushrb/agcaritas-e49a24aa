import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Wallet, Plus, Trash2, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CostKind = "per_task" | "per_hour" | "one_off" | "allocated_internal";
type CostStatus = "pending" | "confirmed" | "paid" | "cancelled";

const KIND_LABEL: Record<CostKind, string> = {
  per_task: "Por tarefa",
  per_hour: "Por hora",
  one_off: "Avulso",
  allocated_internal: "Interno (alocação)",
};

const STATUS_LABEL: Record<CostStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  paid: "Pago",
  cancelled: "Cancelado",
};

const STATUS_TONE: Record<CostStatus, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  paid: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-muted text-muted-foreground",
};

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

  const { data: costs = [] } = useQuery<CostRow[]>({
    queryKey: ["project-costs", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_costs")
        .select("id,project_id,task_id,team_member_id,kind,amount,hours,description,status,occurred_on, team_members(name), tasks(title)")
        .eq("project_id", projectId)
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const totals = costs.reduce(
    (acc, c) => {
      const v = Number(c.amount ?? 0);
      if (c.status === "cancelled") return acc;
      if (c.kind === "allocated_internal") acc.internal += v;
      else acc.variable += v;
      if (c.status === "paid") acc.paid += v;
      else if (c.status === "confirmed") acc.confirmed += v;
      else if (c.status === "pending") acc.pending += v;
      return acc;
    },
    { variable: 0, internal: 0, paid: 0, confirmed: 0, pending: 0 }
  );

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CostStatus }) => {
      const { error } = await supabase.from("project_costs").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-costs", projectId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_costs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-costs", projectId] }); toast.success("Removido"); },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Custo variável" value={fmt(totals.variable)} tone="danger" />
        <Kpi label="Alocação interna" value={fmt(totals.internal)} />
        <Kpi label="Confirmado / Pago" value={fmt(totals.confirmed + totals.paid)} />
        <Kpi label="Pendente" value={fmt(totals.pending)} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium flex items-center gap-2"><Wallet className="size-4" /> Custos de equipe</div>
          <div className="text-xs text-muted-foreground">Registrado automaticamente ao atribuir colaboradores a tarefas, ou manualmente aqui.</div>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="size-4 mr-1" />Lançar custo avulso</Button>
      </div>

      <Card className="rounded-2xl overflow-hidden">
        {costs.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum custo lançado ainda.
          </div>
        ) : (
          <div className="divide-y">
            {costs.map(c => (
              <div key={c.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{c.team_members?.name ?? "—"}</span>
                    <Badge variant="secondary" className="text-[10px]">{KIND_LABEL[c.kind]}</Badge>
                    <Badge className={cn("text-[10px]", STATUS_TONE[c.status])}>{STATUS_LABEL[c.status]}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {c.tasks?.title ? `Tarefa: ${c.tasks.title}` : "Sem tarefa"}
                    {c.description ? ` · ${c.description}` : ""}
                    {c.hours != null ? ` · ${c.hours}h` : ""}
                    {" · "}{new Date(c.occurred_on).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{fmt(Number(c.amount))}</div>
                </div>
                <div className="flex items-center gap-1">
                  {c.status === "pending" && (
                    <Button size="icon" variant="ghost" title="Confirmar"
                      onClick={() => updateStatus.mutate({ id: c.id, status: "confirmed" })}>
                      <CheckCircle2 className="size-4" />
                    </Button>
                  )}
                  {c.status === "confirmed" && (
                    <Button size="icon" variant="ghost" title="Marcar como pago"
                      onClick={() => updateStatus.mutate({ id: c.id, status: "paid" })}>
                      <Clock className="size-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" title="Excluir"
                    onClick={() => remove.mutate(c.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

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

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <Card className="rounded-2xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-semibold tracking-tight", tone === "danger" && "text-red-600 dark:text-red-400")}>{value}</div>
    </Card>
  );
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function NewCostDialog({ open, onOpenChange, projectId, organizationId, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; projectId: string; organizationId: string; onCreated: () => void;
}) {
  const [memberId, setMemberId] = useState<string>("");
  const [kind, setKind] = useState<CostKind>("one_off");
  const [amount, setAmount] = useState<string>("");
  const [hours, setHours] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  const { data: members = [] } = useQuery({
    queryKey: ["cost-team-members"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("id,name").order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const save = async () => {
    if (!amount) { toast.error("Informe o valor"); return; }
    const { error } = await supabase.from("project_costs").insert({
      organization_id: organizationId,
      project_id: projectId,
      team_member_id: memberId || null,
      kind,
      amount: Number(amount),
      hours: hours ? Number(hours) : null,
      description: description || null,
      status: "pending",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Custo lançado");
    setMemberId(""); setAmount(""); setHours(""); setDescription(""); setKind("one_off");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader><DialogTitle>Lançar custo avulso</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Colaborador</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger><SelectValue placeholder="Selecionar (opcional)" /></SelectTrigger>
              <SelectContent>
                {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
