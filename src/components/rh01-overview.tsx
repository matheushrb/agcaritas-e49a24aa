import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, UserCheck, Palmtree, Wallet, Clock, Cake, AlertTriangle, ArrowRight } from "lucide-react";
import {
  CONTRACT_TYPES, STATUS_META, initialsOf, brl, monthlyCost, birthdayInDays, fmtDay,
  type HrMember, type HrContractType,
} from "@/lib/hr";

type Block = { id: string; user_id: string; kind: string; start_date: string; end_date: string; reason: string | null };

const BLOCK_LABEL: Record<string, string> = { ferias: "Férias", folga: "Folga", bloqueio: "Bloqueio", feriado: "Feriado" };

export function Rh01Overview({ members }: { members: HrMember[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartIso = monthStart.toISOString().slice(0, 10);

  const { data: blocks = [] } = useQuery<Block[]>({
    queryKey: ["hr-blocks", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_blocks")
        .select("id,user_id,kind,start_date,end_date,reason")
        .gte("end_date", today)
        .order("start_date")
        .limit(30);
      if (error) throw error;
      return (data ?? []) as Block[];
    },
  });

  const { data: entries = [] } = useQuery<{ user_id: string | null; duration_seconds: number }[]>({
    queryKey: ["hr-time-month", monthStartIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("user_id,duration_seconds")
        .gte("created_at", monthStartIso);
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const kpis = useMemo(() => {
    const active = members.filter(m => m.status === "active");
    const cost = members.reduce((s, m) => s + monthlyCost(m), 0);
    const hours = members.reduce((s, m) => s + Number(m.monthly_hours ?? 0), 0);
    const away = members.filter(m => m.status === "away" || m.status === "vacation").length;
    return { total: members.length, active: active.length, away, cost, hours };
  }, [members]);

  const byContract = useMemo(() => {
    const rows = (Object.keys(CONTRACT_TYPES) as HrContractType[]).map(k => {
      const list = members.filter(m => m.contract_type === k);
      return { key: k, count: list.length, cost: list.reduce((s, m) => s + monthlyCost(m), 0) };
    });
    const max = Math.max(1, ...rows.map(r => r.cost));
    return { rows, max };
  }, [members]);

  const hoursByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      if (!e.user_id) continue;
      map.set(e.user_id, (map.get(e.user_id) ?? 0) + Number(e.duration_seconds ?? 0) / 3600);
    }
    return map;
  }, [entries]);

  const areas = useMemo(() => {
    const map = new Map<string, { capacity: number; used: number; people: number }>();
    for (const m of members) {
      if (m.status === "inactive") continue;
      const key = m.area?.trim() || "Sem área";
      const row = map.get(key) ?? { capacity: 0, used: 0, people: 0 };
      row.capacity += Number(m.monthly_hours ?? 0);
      row.used += m.user_id ? (hoursByUser.get(m.user_id) ?? 0) : 0;
      row.people += 1;
      map.set(key, row);
    }
    return [...map.entries()].sort((a, b) => b[1].capacity - a[1].capacity);
  }, [members, hoursByUser]);

  const birthdays = useMemo(() =>
    members
      .map(m => ({ m, days: birthdayInDays(m.birth_date) }))
      .filter(x => x.days !== null)
      .sort((a, b) => (a.days! - b.days!))
      .slice(0, 5),
  [members]);

  const memberByUser = useMemo(() => {
    const map = new Map<string, HrMember>();
    members.forEach(m => { if (m.user_id) map.set(m.user_id, m); });
    return map;
  }, [members]);

  const alerts = useMemo(() => {
    const out: { id: string; text: string; to?: string }[] = [];
    members.forEach(m => {
      if (m.contract_type === "internal" && !m.monthly_salary)
        out.push({ id: `sal-${m.id}`, text: `${m.name} está como interno mas sem salário cadastrado`, to: m.id });
      if (m.contract_type === "freelancer_hour" && !m.hourly_rate)
        out.push({ id: `hr-${m.id}`, text: `${m.name} não tem valor/hora definido`, to: m.id });
      if (m.contract_type === "freelancer_task" && !m.default_task_rate)
        out.push({ id: `tk-${m.id}`, text: `${m.name} não tem valor por tarefa definido`, to: m.id });
      if (m.contract_type === "company" && !m.company_tax_id)
        out.push({ id: `cn-${m.id}`, text: `${m.name} (empresa) está sem CNPJ`, to: m.id });
      if (!m.email) out.push({ id: `em-${m.id}`, text: `${m.name} está sem e-mail de contato`, to: m.id });
    });
    return out.slice(0, 6);
  }, [members]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi icon={Users} label="Pessoas" value={String(kpis.total)} hint="cadastros ativos e inativos" />
        <Kpi icon={UserCheck} label="Ativos" value={String(kpis.active)} hint="disponíveis para alocação" />
        <Kpi icon={Palmtree} label="Ausentes / férias" value={String(kpis.away)} hint="fora da operação hoje" />
        <Kpi icon={Wallet} label="Custo fixo mensal" value={brl(kpis.cost)} hint="salários + hora contratada" />
        <Kpi icon={Clock} label="Capacidade" value={`${Math.round(kpis.hours)} h`} hint="horas/mês contratadas" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Custo por tipo de vínculo</h3>
            <span className="text-[11px] text-muted-foreground">estimativa mensal</span>
          </div>
          <div className="space-y-3">
            {byContract.rows.map(r => {
              const meta = CONTRACT_TYPES[r.key];
              return (
                <div key={r.key}>
                  <div className="flex items-center justify-between text-[13px] mb-1">
                    <span className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${meta.dot}`} />
                      {meta.label}
                      <span className="text-muted-foreground">· {r.count}</span>
                    </span>
                    <span className="tabular-nums font-medium">{r.cost ? brl(r.cost) : "variável"}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full ${meta.dot}`} style={{ width: `${Math.round((r.cost / byContract.max) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Ausências e férias</h3>
          <div className="space-y-2.5">
            {blocks.slice(0, 6).map(b => {
              const m = memberByUser.get(b.user_id);
              return (
                <div key={b.id} className="flex items-center gap-2.5">
                  <div className="size-8 rounded-full bg-muted flex items-center justify-center text-[11px] font-medium">
                    {initialsOf(m?.name ?? "?")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] truncate">{m?.name ?? "Colaborador"}</div>
                    <div className="text-[11px] text-muted-foreground">{fmtDay(b.start_date)} – {fmtDay(b.end_date)}</div>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{BLOCK_LABEL[b.kind] ?? b.kind}</Badge>
                </div>
              );
            })}
            {blocks.length === 0 && <p className="text-[13px] text-muted-foreground">Ninguém ausente no período.</p>}
          </div>

          <h3 className="text-sm font-semibold mt-5 mb-2 flex items-center gap-1.5"><Cake className="size-3.5" />Aniversários</h3>
          <div className="space-y-1.5">
            {birthdays.map(({ m, days }) => (
              <div key={m.id} className="flex items-center justify-between text-[13px]">
                <span className="truncate">{m.name}</span>
                <span className="text-[11px] text-muted-foreground">{days === 0 ? "hoje 🎉" : `em ${days} d`}</span>
              </div>
            ))}
            {birthdays.length === 0 && <p className="text-[13px] text-muted-foreground">Sem aniversários próximos.</p>}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Capacidade por área</h3>
            <span className="text-[11px] text-muted-foreground">horas lançadas no mês vs. contratadas</span>
          </div>
          <div className="space-y-3">
            {areas.map(([area, row]) => {
              const pct = row.capacity ? Math.min(100, Math.round((row.used / row.capacity) * 100)) : 0;
              return (
                <div key={area}>
                  <div className="flex items-center justify-between text-[13px] mb-1">
                    <span>{area} <span className="text-muted-foreground">· {row.people} pessoa(s)</span></span>
                    <span className="tabular-nums text-muted-foreground">{Math.round(row.used)}h / {Math.round(row.capacity)}h</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
            {areas.length === 0 && <p className="text-[13px] text-muted-foreground">Cadastre pessoas para ver a capacidade.</p>}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><AlertTriangle className="size-3.5 text-amber-500" />Alertas de cadastro</h3>
          <div className="space-y-2">
            {alerts.map(a => (
              <Link
                key={a.id} to="/team/$memberId" params={{ memberId: a.to! }}
                className="flex items-start gap-2 text-[13px] rounded-lg px-2 py-1.5 hover:bg-muted/60 transition"
              >
                <span className="size-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span className="flex-1 leading-snug">{a.text}</span>
                <ArrowRight className="size-3.5 text-muted-foreground mt-0.5" />
              </Link>
            ))}
            {alerts.length === 0 && <p className="text-[13px] text-muted-foreground">Tudo certo por aqui.</p>}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Quem está na operação</h3>
        <div className="flex flex-wrap gap-2">
          {members.filter(m => m.status !== "inactive").map(m => (
            <Link
              key={m.id} to="/team/$memberId" params={{ memberId: m.id }}
              className="flex items-center gap-2 rounded-full border border-border bg-card pl-1 pr-3 py-1 hover:bg-muted/60 transition"
            >
              <span className="size-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">{initialsOf(m.name)}</span>
              <span className="text-[13px]">{m.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_META[m.status ?? "active"]?.tone}`}>
                {STATUS_META[m.status ?? "active"]?.label}
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-[11px] uppercase tracking-wide font-medium">{label}</span>
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-1.5">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
    </Card>
  );
}
