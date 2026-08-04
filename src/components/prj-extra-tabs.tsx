import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Users, Clock, CheckCircle2, ListTodo, ChevronLeft, ChevronRight,
  Grid3x3, Milestone, Calendar as CalIcon,
} from "lucide-react";
import "@/prj07.css";

export type TabTask = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  assignee_id: string | null;
  platform: string | null;
  estimated_hours: number | null;
  billing_value: number | null;
  progress: number | null;
  created_at?: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  todo: "A fazer", in_progress: "Em andamento", review: "Em revisão", done: "Concluída", blocked: "Bloqueada",
};
const STATUS_COLOR: Record<string, string> = {
  todo: "#8A93A3", in_progress: "#2F6BEF", review: "#F59E0B", done: "#10B981", blocked: "#EF4444",
};
const money = (n: number) => `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const initials = (n?: string | null) =>
  (n ?? "?").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
const dkey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ============================ EQUIPE ============================ */
export function PrjTeamTab({ projectId, tasks }: { projectId: string; tasks: TabTask[] }) {
  const { data: members = [] } = useQuery({
    queryKey: ["prj-team", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_members")
        .select("id,user_id,role,allocation_pct")
        .eq("project_id", projectId);
      return (data ?? []) as { id: string; user_id: string; role: string | null; allocation_pct: number | null }[];
    },
  });

  const ids = useMemo(() => {
    const s = new Set<string>();
    members.forEach(m => m.user_id && s.add(m.user_id));
    tasks.forEach(t => t.assignee_id && s.add(t.assignee_id));
    return Array.from(s);
  }, [members, tasks]);

  const { data: profiles = [] } = useQuery({
    queryKey: ["prj-team-profiles", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name,display_name,role_title,avatar_url").in("id", ids);
      return (data ?? []) as { id: string; full_name: string | null; display_name: string | null; role_title: string | null; avatar_url: string | null }[];
    },
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["prj-team-time", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("time_entries").select("id,user_id,minutes,task_id").eq("project_id", projectId);
      return (data ?? []) as { id: string; user_id: string | null; minutes: number | null; task_id: string | null }[];
    },
  });

  const rows = ids.map(id => {
    const p = profiles.find(x => x.id === id);
    const mine = tasks.filter(t => t.assignee_id === id);
    const done = mine.filter(t => t.status === "done").length;
    const hours = entries.filter(e => e.user_id === id).reduce((s, e) => s + Number(e.minutes ?? 0), 0) / 60;
    const est = mine.reduce((s, t) => s + Number(t.estimated_hours ?? 0), 0);
    const m = members.find(x => x.user_id === id);
    return {
      id,
      name: p?.display_name || p?.full_name || "Sem nome",
      role: m?.role || p?.role_title || "Colaborador",
      allocation: m?.allocation_pct ?? null,
      total: mine.length, done, hours, est,
      isMember: !!m,
    };
  }).sort((a, b) => b.total - a.total);

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalTasks = tasks.length;
  const totalDone = tasks.filter(t => t.status === "done").length;

  return (
    <div className="prj07">
      <div className="p7-kpis">
        <K icon={Users} color="#2F6BEF" label="Pessoas no projeto" value={String(rows.length)} sub={`${members.length} alocação(ões) formal(is)`} />
        <K icon={ListTodo} color="#8B5CF6" label="Tarefas atribuídas" value={String(totalTasks)} sub={`${tasks.filter(t => !t.assignee_id).length} sem responsável`} />
        <K icon={CheckCircle2} color="#10B981" label="Concluídas" value={String(totalDone)} sub={totalTasks ? `${Math.round((totalDone / totalTasks) * 100)}% do total` : "—"} />
        <K icon={Clock} color="#F59E0B" label="Horas lançadas" value={`${totalHours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`} sub="Timesheet do projeto" />
      </div>

      <section className="p7-card">
        <div className="p7-card-h">
          <div className="p7-ht"><Users /><span className="p7-card-t">Equipe e alocação</span></div>
        </div>
        {rows.length === 0 ? (
          <div className="p7-empty"><b>Ninguém alocado ainda</b>Atribua responsáveis nas tarefas para ver a equipe aqui.</div>
        ) : (
          <table className="p7-table">
            <thead>
              <tr>
                <th>Pessoa</th><th>Papel</th>
                <th style={{ textAlign: "right" }}>Tarefas</th>
                <th style={{ textAlign: "right" }}>Concluídas</th>
                <th style={{ textAlign: "right" }}>Horas est.</th>
                <th style={{ textAlign: "right" }}>Horas reais</th>
                <th style={{ width: 150 }}>Progresso</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
                return (
                  <tr key={r.id}>
                    <td>
                      <div className="p7-who">
                        <span className="p7-av">{initials(r.name)}</span>
                        <div>
                          <div className="p7-strong">{r.name}</div>
                          <div className="p7-sub">{r.isMember ? "Alocado no projeto" : "Via tarefas"}</div>
                        </div>
                      </div>
                    </td>
                    <td>{r.role}{r.allocation != null ? ` · ${r.allocation}%` : ""}</td>
                    <td className="p7-num">{r.total}</td>
                    <td className="p7-num">{r.done}</td>
                    <td className="p7-num">{r.est ? `${r.est.toLocaleString("pt-BR")} h` : "—"}</td>
                    <td className="p7-num">{r.hours ? `${r.hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h` : "—"}</td>
                    <td>
                      <div className="p7-bar"><i style={{ width: `${pct}%`, background: "#2F6BEF" }} /></div>
                      <div className="p7-sub">{pct}%</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

/* ========================== CALENDÁRIO ========================== */
export function PrjCalendarTab({ tasks, onOpen }: { tasks: TabTask[]; onOpen?: (id: string) => void }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const byDay = useMemo(() => {
    const m = new Map<string, TabTask[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const k = t.due_date.slice(0, 10);
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return m;
  }, [tasks]);

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const todayKey = dkey(new Date());
  const inMonth = tasks.filter(t => t.due_date && t.due_date.slice(0, 7) === `${year}-${String(month + 1).padStart(2, "0")}`);

  return (
    <div className="prj07">
      <section className="p7-card" style={{ marginTop: 0 }}>
        <div className="p7-card-h">
          <div>
            <div className="p7-ht"><CalIcon /><span className="p7-card-t">Calendário de conteúdo</span></div>
            <div className="p7-card-s">{inMonth.length} entrega(s) neste mês</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="button" className="p7-iconbtn" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft /></button>
            <b style={{ fontSize: 13.5, minWidth: 140, textAlign: "center", textTransform: "capitalize" }}>
              {cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </b>
            <button type="button" className="p7-iconbtn" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight /></button>
          </div>
        </div>

        <div className="p7-cal">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => <div key={d} className="p7-cal-dow">{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="p7-cal-cell empty" />;
            const k = dkey(d);
            const items = byDay.get(k) ?? [];
            return (
              <div key={i} className={`p7-cal-cell${k === todayKey ? " today" : ""}`}>
                <span className="p7-cal-n">{d.getDate()}</span>
                {items.slice(0, 3).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className="p7-cal-ev"
                    style={{ background: `color-mix(in oklab, ${STATUS_COLOR[t.status] ?? "#2F6BEF"} 16%, transparent)`, color: STATUS_COLOR[t.status] ?? "#2F6BEF" }}
                    onClick={() => onOpen?.(t.id)}
                    title={t.title}
                  >
                    {t.title}
                  </button>
                ))}
                {items.length > 3 && <span className="p7-sub">+{items.length - 3}</span>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/* ============================= GRID ============================= */
export function PrjGridTab({ tasks, onOpen }: { tasks: TabTask[]; onOpen?: (id: string) => void }) {
  const platforms = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach(t => t.platform && s.add(t.platform));
    return ["all", ...Array.from(s)];
  }, [tasks]);
  const [plat, setPlat] = useState("all");

  const items = tasks
    .filter(t => plat === "all" || t.platform === plat)
    .slice()
    .sort((a, b) => (b.due_date ?? "").localeCompare(a.due_date ?? ""));

  return (
    <div className="prj07">
      <section className="p7-card" style={{ marginTop: 0 }}>
        <div className="p7-card-h">
          <div>
            <div className="p7-ht"><Grid3x3 /><span className="p7-card-t">Grid de conteúdo</span></div>
            <div className="p7-card-s">Prévia do feed em ordem de publicação</div>
          </div>
        </div>
        {platforms.length > 1 && (
          <div className="p7-filters">
            {platforms.map(p => (
              <button key={p} type="button" className={`p7-fchip${plat === p ? " on" : ""}`} onClick={() => setPlat(p)}>
                {p === "all" ? "Todas" : p}
              </button>
            ))}
          </div>
        )}
        {items.length === 0 ? (
          <div className="p7-empty"><b>Sem peças ainda</b>Crie tarefas com plataforma definida para montar o grid.</div>
        ) : (
          <div className="p7-grid3">
            {items.map(t => (
              <button key={t.id} type="button" className="p7-tile" onClick={() => onOpen?.(t.id)}>
                <span className="p7-tile-tag" style={{ background: STATUS_COLOR[t.status] ?? "#2F6BEF" }} />
                <span className="p7-tile-plat">{t.platform ?? "Sem plataforma"}</span>
                <span className="p7-tile-t">{t.title}</span>
                <span className="p7-sub">
                  {t.due_date ? new Date(`${t.due_date.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "Sem data"}
                  {" · "}{STATUS_LABEL[t.status] ?? t.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* =========================== TIMELINE =========================== */
export function PrjTimelineTab({
  tasks, startDate, endDate, onOpen,
}: { tasks: TabTask[]; startDate: string | null; endDate: string | null; onOpen?: (id: string) => void }) {
  const dated = tasks.filter(t => t.due_date).slice().sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  const groups = useMemo(() => {
    const m = new Map<string, TabTask[]>();
    for (const t of dated) {
      const k = (t.due_date ?? "").slice(0, 7);
      m.set(k, [...(m.get(k) ?? []), t]);
    }
    return Array.from(m.entries());
  }, [dated]);

  const revenue = tasks.reduce((s, t) => s + Number(t.billing_value ?? 0), 0);

  return (
    <div className="prj07">
      <div className="p7-kpis">
        <K icon={Milestone} color="#2F6BEF" label="Início do projeto" value={startDate ? new Date(`${startDate.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—"} sub="Data cadastrada" />
        <K icon={CalIcon} color="#F59E0B" label="Previsão de término" value={endDate ? new Date(`${endDate.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—"} sub={`${dated.length} entrega(s) datada(s)`} />
        <K icon={CheckCircle2} color="#10B981" label="Concluídas" value={String(tasks.filter(t => t.status === "done").length)} sub={`de ${tasks.length} tarefas`} />
        <K icon={ListTodo} color="#8B5CF6" label="Receita mapeada" value={money(revenue)} sub="Somatório das tarefas" />
      </div>

      <section className="p7-card">
        <div className="p7-card-h">
          <div className="p7-ht"><Milestone /><span className="p7-card-t">Linha do tempo</span></div>
        </div>
        {groups.length === 0 ? (
          <div className="p7-empty"><b>Nenhum marco datado</b>Defina prazos nas tarefas para montar a timeline.</div>
        ) : (
          <div className="p7-tl">
            {groups.map(([month, items]) => (
              <div key={month} className="p7-tl-g">
                <div className="p7-tl-m">
                  {new Date(`${month}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                </div>
                {items.map(t => (
                  <button key={t.id} type="button" className="p7-tl-item" onClick={() => onOpen?.(t.id)}>
                    <span className="p7-tl-dot" style={{ background: STATUS_COLOR[t.status] ?? "#2F6BEF" }} />
                    <span className="p7-tl-day">
                      {new Date(`${(t.due_date ?? "").slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                    <span className="p7-tl-t">{t.title}</span>
                    <span className="p7-badge" style={{ background: `color-mix(in oklab, ${STATUS_COLOR[t.status] ?? "#2F6BEF"} 15%, transparent)`, color: STATUS_COLOR[t.status] ?? "#2F6BEF" }}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function K({ icon: Icon, color, label, value, sub }: { icon: typeof Users; color: string; label: string; value: string; sub: string }) {
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
