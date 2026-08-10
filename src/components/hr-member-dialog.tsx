import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityDialog, DialogField, DialogCancelButton } from "@/components/entity-dialog";
import { UserPlus } from "lucide-react";
import { TeamCostFieldsEditor, type TeamCostFields, type CostMode } from "@/components/team-cost-fields";
import {
  CONTRACT_TYPES, LEVEL_LABEL, STATUS_META, initialsOf,
  type HrMember, type HrContractType, type TeamLevel, type TeamStatus,
} from "@/lib/hr";

const emptyCost: TeamCostFields = {
  cost_mode: "internal_fixed",
  monthly_salary: null,
  monthly_hours: 160,
  hourly_rate: null,
  default_task_rate: null,
  task_rate_overrides: {},
  cost_notes: null,
};

const COST_BY_CONTRACT: Record<HrContractType, CostMode> = {
  internal: "internal_fixed",
  freelancer_task: "freelancer_per_task",
  freelancer_hour: "freelancer_per_hour",
  contractor: "one_off",
  company: "one_off",
};

export function HrMemberDialog({ open, onOpenChange, initial, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: HrMember | null;
  onSave: (v: Partial<HrMember>) => void;
}) {
  const [f, setF] = useState<Partial<HrMember>>(
    () => initial ?? { status: "active", level: "mid", contract_type: "internal", work_location: "presencial", ...emptyCost },
  );
  const isEdit = !!initial;
  const contract = (f.contract_type ?? "internal") as HrContractType;
  const isCompany = contract === "company";

  const cost: TeamCostFields = {
    cost_mode: (f.cost_mode ?? "internal_fixed") as CostMode,
    monthly_salary: f.monthly_salary ?? null,
    monthly_hours: f.monthly_hours ?? 160,
    hourly_rate: f.hourly_rate ?? null,
    default_task_rate: f.default_task_rate ?? null,
    task_rate_overrides: f.task_rate_overrides ?? {},
    cost_notes: f.cost_notes ?? null,
  };

  return (
    <EntityDialog
      open={open} onOpenChange={onOpenChange}
      icon={UserPlus} tone="purple"
      eyebrow="RH"
      title={isEdit ? "Editar pessoa" : "Nova pessoa"}
      subtitle="Vínculo, dados profissionais e modelo de custo."
      main={
        <>
          <DialogField label="Tipo de vínculo">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {(Object.keys(CONTRACT_TYPES) as HrContractType[]).map(k => {
                const meta = CONTRACT_TYPES[k];
                const on = contract === k;
                return (
                  <button
                    key={k} type="button"
                    onClick={() => setF({ ...f, contract_type: k, cost_mode: COST_BY_CONTRACT[k] })}
                    className={`text-left rounded-xl border px-3 py-2 transition ${on ? meta.tone : "border-border bg-card hover:bg-muted/50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${meta.dot}`} />
                      <span className="text-[13px] font-medium">{meta.label}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{meta.note}</div>
                  </button>
                );
              })}
            </div>
          </DialogField>

          <DialogField label={isCompany ? "Nome de exibição / apelido da empresa" : "Nome completo"}>
            <Input placeholder={isCompany ? "Ex.: Studio Vértice" : "Ex.: Ana Beatriz Souza"} value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} autoFocus />
          </DialogField>

          {isCompany && (
            <div className="grid grid-cols-2 gap-3">
              <DialogField label="Razão social">
                <Input value={f.company_legal_name ?? ""} onChange={e => setF({ ...f, company_legal_name: e.target.value })} />
              </DialogField>
              <DialogField label="CNPJ">
                <Input placeholder="00.000.000/0001-00" value={f.company_tax_id ?? ""} onChange={e => setF({ ...f, company_tax_id: e.target.value })} />
              </DialogField>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <DialogField label="E-mail">
              <Input type="email" placeholder="ana@empresa.com" value={f.email ?? ""} onChange={e => setF({ ...f, email: e.target.value })} />
            </DialogField>
            <DialogField label="Telefone">
              <Input placeholder="(11) 99999-0000" value={f.phone ?? ""} onChange={e => setF({ ...f, phone: e.target.value })} />
            </DialogField>
          </div>

          {isCompany && (
            <DialogField label="Contato responsável">
              <Input placeholder="Nome do contato na empresa" value={f.company_contact ?? ""} onChange={e => setF({ ...f, company_contact: e.target.value })} />
            </DialogField>
          )}

          <div className="grid grid-cols-2 gap-3">
            <DialogField label={isCompany ? "Serviço prestado" : "Cargo"}>
              <Input placeholder={isCompany ? "Ex.: Produção de vídeo" : "Ex.: Designer"} value={f.role ?? ""} onChange={e => setF({ ...f, role: e.target.value })} />
            </DialogField>
            <DialogField label="Área">
              <Input placeholder="Ex.: Criação, Mídia, Atendimento" value={f.area ?? ""} onChange={e => setF({ ...f, area: e.target.value })} />
            </DialogField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DialogField label="Especialidade">
              <Input placeholder="Ex.: Motion, UI, tráfego pago" value={f.specialty ?? ""} onChange={e => setF({ ...f, specialty: e.target.value })} />
            </DialogField>
            <DialogField label="Local de trabalho">
              <Select value={f.work_location ?? undefined} onValueChange={(v) => setF({ ...f, work_location: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="presencial">Presencial</SelectItem>
                  <SelectItem value="hibrido">Híbrido</SelectItem>
                  <SelectItem value="remoto">Remoto</SelectItem>
                </SelectContent>
              </Select>
            </DialogField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DialogField label={isCompany ? "Início do contrato" : "Admissão"}>
              <Input type="date" value={f.admitted_on ?? ""} onChange={e => setF({ ...f, admitted_on: e.target.value || null })} />
            </DialogField>
            {!isCompany && (
              <DialogField label="Nascimento">
                <Input type="date" value={f.birth_date ?? ""} onChange={e => setF({ ...f, birth_date: e.target.value || null })} />
              </DialogField>
            )}
            <DialogField label="Dia de pagamento">
              <Input
                type="number" min={1} max={28} placeholder="Ex.: 5"
                value={f.payment_day ?? ""}
                onChange={e => setF({ ...f, payment_day: e.target.value ? Number(e.target.value) : null })}
              />
            </DialogField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <DialogField label="Chave PIX">
              <Input placeholder="CPF, e-mail ou chave aleatória" value={f.pix_key ?? ""} onChange={e => setF({ ...f, pix_key: e.target.value })} />
            </DialogField>
            <DialogField label="Dados bancários">
              <Input placeholder="Banco · agência · conta" value={f.bank_info ?? ""} onChange={e => setF({ ...f, bank_info: e.target.value })} />
            </DialogField>
            <DialogField label="Revisão salarial a cada (meses)">
              <Input
                type="number" min={1} max={60} placeholder="Ex.: 12"
                value={f.salary_review_months ?? ""}
                onChange={e => setF({ ...f, salary_review_months: e.target.value ? Number(e.target.value) : null })}
              />
            </DialogField>
          </div>

          <div className="pt-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Modelo de custo</div>
            <TeamCostFieldsEditor value={cost} onChange={(v) => setF({ ...f, ...v })} />
          </div>

          <DialogField label="Observações do RH">
            <Textarea rows={3} placeholder="Contrato, acordos, particularidades…" value={f.hr_notes ?? ""} onChange={e => setF({ ...f, hr_notes: e.target.value })} />
          </DialogField>
        </>
      }
      sidebar={
        <>
          <div className="flex items-center gap-3">
            <div className="size-14 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-semibold text-lg">
              {initialsOf(f.name ?? "")}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{f.name || "Nova pessoa"}</div>
              <div className="text-xs text-muted-foreground truncate">{f.role || CONTRACT_TYPES[contract].label}</div>
            </div>
          </div>
          <DialogField label="Nível">
            <Select value={f.level ?? undefined} onValueChange={(v) => setF({ ...f, level: v as TeamLevel })}>
              <SelectTrigger><SelectValue placeholder="Nível" /></SelectTrigger>
              <SelectContent>{Object.entries(LEVEL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </DialogField>
          <DialogField label="Status">
            <Select value={f.status ?? undefined} onValueChange={(v) => setF({ ...f, status: v as TeamStatus })}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
          </DialogField>
          <div className={`rounded-xl border px-3 py-2 text-[11px] ${CONTRACT_TYPES[contract].tone}`}>
            {CONTRACT_TYPES[contract].note}
          </div>
        </>
      }
      footer={
        <>
          <DialogCancelButton onClick={() => onOpenChange(false)} />
          <Button className="rounded-full" onClick={() => onSave(f)} disabled={!f.name}>
            {isEdit ? "Salvar" : "Adicionar pessoa"}
          </Button>
        </>
      }
    />
  );
}
