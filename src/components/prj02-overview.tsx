import { Link } from "@tanstack/react-router";
import {
  ArrowRight, CheckCircle2, Circle, Mail, Phone, FileText, MoreVertical,
} from "lucide-react";

export type P2Task = {
  id: string; title: string; status: string; due_date: string | null;
  assignee_id: string | null; created_at?: string;
  billing_value: number | null; billing_enabled: boolean;
  deliverables?: { id: string; platform: string; type: string; billing_value: number | null; invoiced?: boolean }[];
};
export type P2Person = { id: string; full_name: string | null; role: string | null };

export const p2Initials = (n?: string | null) =>
  (n ?? "?").trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? "").join("") || "?";

export const p2Money = (v: number) =>
  "R$ " + Math.round(v).toLocaleString("pt-BR");

export const p2Date = (d?: string | null) => {
  if (!d) return "—";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dt = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

function Donut({ segments, center, caption }: {
  segments: { value: number; color: string }[]; center: string; caption: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 52, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="p2-donut">
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle cx="66" cy="66" r={r} fill="none" stroke="#EDF0F5" strokeWidth="15" />
        {segments.filter(s => s.value > 0).map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle key={i} cx="66" cy="66" r={r} fill="none" stroke={s.color} strokeWidth="15"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc}
              transform="rotate(-90 66 66)" strokeLinecap="butt" />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="mid"><span className="pct">{center}</span><span className="cap">{caption}</span></div>
    </div>
  );
}

export function Prj02Overview({
  projectId, description, projectType, category, budget, startDate, tags,
  clientName, clientSince, tasks, people, ownerName, ownerRole,
  stageLabel, stageSince, revenue, invoiced,
}: {
  projectId: string;
  description: string;
  projectType: string;
  category: string;
  budget: number;
  startDate: string | null;
  tags: string[];
  clientName: string;
  clientSince: string | null;
  tasks: P2Task[];
  people: P2Person[];
  ownerName: string;
  ownerRole: string;
  stageLabel: string;
  stageSince: string | null;
  revenue: number;
  invoiced: number;
}) {
  const total = tasks.length;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const done = tasks.filter(t => t.status === "done").length;
  const doing = tasks.filter(t => t.status === "in_progress" || t.status === "review").length;
  const late = tasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== "done").length;
  const todo = Math.max(total - done - doing - late, 0);
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const progress = pct(done);
  const pending = Math.max(revenue - invoiced, 0);
  const margin = revenue > 0 ? Math.round((pending / revenue) * 1000) / 10 : 0;

  const milestones = [...tasks]
    .filter(t => t.due_date)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 4);

  const activity = [...tasks]
    .sort((a, b) => ((b.created_at ?? "") > (a.created_at ?? "") ? 1 : -1))
    .slice(0, 4);

  const files = tasks
    .flatMap(t => (t.deliverables ?? []).map(d => ({ ...d, task: t.title })))
    .slice(0, 5);

  const nameOf = (id: string | null) => people.find(p => p.id === id)?.full_name ?? "Não atribuído";
  const barMax = Math.max(revenue, invoiced, pending, 1);
  const barH = (v: number) => `${Math.max((v / barMax) * 78, 3)}px`;

  return (
    <div className="p2-grid">
      {/* 1 — Visão geral do projeto */}
      <section className="p2-card">
        <div className="p2-card-h"><span className="p2-card-t">1. Visão geral do projeto</span></div>
        <p className="p2-card-body" style={{ marginBottom: 14 }}>
          {description || "Sem descrição cadastrada para este projeto."}
        </p>
        <div className="p2-rows">
          <div className="p2-row"><span className="k">Tipo de projeto</span><span className="v">{projectType}</span></div>
          <div className="p2-row"><span className="k">Categoria</span><span className="v">{category}</span></div>
          <div className="p2-row"><span className="k">Orçamento</span><span className="v">{p2Money(budget)}</span></div>
          <div className="p2-row"><span className="k">Início</span><span className="v">{p2Date(startDate)}</span></div>
        </div>
        <div className="p2-label" style={{ marginTop: 14 }}>Tags</div>
        <div className="p2-tags" style={{ marginTop: 0 }}>
          {tags.length ? tags.map(t => <span key={t} className="p2-tag">{t}</span>) : <span className="p2-tag">—</span>}
        </div>
      </section>

      {/* 2 — Cliente e contatos principais */}
      <section className="p2-card">
        <div className="p2-card-h"><span className="p2-card-t">2. Cliente e contatos principais</span></div>
        <div className="p2-person">
          <div className="av" style={{ background: "#0E9F6E", color: "#fff", borderRadius: 8 }}>{p2Initials(clientName)}</div>
          <div>
            <div className="nm">{clientName}</div>
            <div className="rl">{clientSince ? `Cliente desde ${clientSince}` : "Cliente"}</div>
          </div>
        </div>
        <div className="p2-hr" />
        <div className="p2-label">Contato principal</div>
        <div className="p2-person">
          <div className="av">{p2Initials(ownerName)}</div>
          <div><div className="nm">{ownerName}</div><div className="rl">{ownerRole}</div></div>
          <div className="sp">
            <button className="p2-ico-btn" type="button"><Mail /></button>
            <button className="p2-ico-btn" type="button"><Phone /></button>
          </div>
        </div>
        <Link to="/clients" className="p2-link">Ver ficha do cliente <ArrowRight /></Link>
      </section>

      {/* 3 — Responsável e equipe */}
      <section className="p2-card">
        <div className="p2-card-h"><span className="p2-card-t">3. Responsável e equipe</span></div>
        <div className="p2-label">Responsável</div>
        <div className="p2-person">
          <div className="av">{p2Initials(ownerName)}</div>
          <div><div className="nm">{ownerName}</div><div className="rl">{ownerRole}</div></div>
          <div className="sp"><button className="p2-ico-btn" type="button"><Mail /></button></div>
        </div>
        <div className="p2-hr" />
        <div className="p2-label">Equipe do projeto</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {people.slice(0, 3).map(p => (
            <div className="p2-person" key={p.id}>
              <div className="av" style={{ width: 28, height: 28, fontSize: 10 }}>{p2Initials(p.full_name)}</div>
              <div><div className="nm">{p.full_name ?? "Sem nome"}</div><div className="rl">{p.role ?? "Equipe"}</div></div>
            </div>
          ))}
          {!people.length && <div className="p2-empty">Nenhum membro alocado ainda.</div>}
        </div>
        <Link to="/team" className="p2-link">Ver todos <ArrowRight /></Link>
      </section>

      {/* 4 — Etapa atual, marcos e prazos */}
      <section className="p2-card">
        <div className="p2-card-h"><span className="p2-card-t">4. Etapa atual, marcos e prazos</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <span className="p2-label" style={{ margin: 0 }}>Etapa atual</span>
          <span className="p2-tag" style={{ background: "rgba(16,185,129,.12)", border: 0, color: "#0E9F6E", fontWeight: 600 }}>{stageLabel}</span>
          {stageSince && <span className="p2-label" style={{ margin: 0 }}>Desde {stageSince}</span>}
        </div>
        <div className="p2-label">Próximos marcos</div>
        <div>
          {milestones.length ? milestones.map(m => {
            const isDone = m.status === "done";
            const isLate = !isDone && !!m.due_date && new Date(m.due_date) < now;
            return (
              <div key={m.id} className={`p2-mile ${isDone ? "done" : isLate ? "late" : "cur"}`}>
                {isDone ? <CheckCircle2 className="ic" /> : <Circle className="ic" />}
                <span className="tx">{m.title}</span>
                <span className="dt">{isDone ? "Concluído" : p2Date(m.due_date)}</span>
              </div>
            );
          }) : <div className="p2-empty">Nenhum marco com prazo definido.</div>}
        </div>
        <Link to="/projects/$projectId" params={{ projectId }} className="p2-link">Ver linha do tempo completa <ArrowRight /></Link>
      </section>

      {/* 5 — Progresso do projeto */}
      <section className="p2-card">
        <div className="p2-card-h"><span className="p2-card-t">5. Progresso do projeto</span></div>
        <div className="p2-donut-wrap">
          <Donut
            center={`${progress}%`} caption="concluído"
            segments={[
              { value: done, color: "#10B981" },
              { value: doing, color: "#2F6BEF" },
              { value: todo, color: "#F59E0B" },
              { value: late, color: "#EF4444" },
            ]}
          />
          <div className="p2-legend">
            <div className="li"><span className="sw" style={{ background: "#10B981" }} /><span className="nm">Concluídas</span><span className="vl">{done} ({pct(done)}%)</span></div>
            <div className="li"><span className="sw" style={{ background: "#2F6BEF" }} /><span className="nm">Em andamento</span><span className="vl">{doing} ({pct(doing)}%)</span></div>
            <div className="li"><span className="sw" style={{ background: "#F59E0B" }} /><span className="nm">Pendentes</span><span className="vl">{todo} ({pct(todo)}%)</span></div>
            <div className="li"><span className="sw" style={{ background: "#EF4444" }} /><span className="nm">Atrasadas</span><span className="vl">{late} ({pct(late)}%)</span></div>
          </div>
        </div>
        <Link to="/tasks" className="p2-link">Ver todas as tarefas <ArrowRight /></Link>
      </section>

      {/* 6 — Últimas atividades */}
      <section className="p2-card">
        <div className="p2-card-h"><span className="p2-card-t">6. Últimas atividades</span></div>
        <div>
          {activity.length ? activity.map(a => (
            <div className="p2-act" key={a.id}>
              <div className="av">{p2Initials(nameOf(a.assignee_id))}</div>
              <div className="tx">
                <b>{nameOf(a.assignee_id)}</b> {a.status === "done" ? "concluiu a tarefa" : "está trabalhando em"}
                <span className="l2">{a.title}</span>
              </div>
              <span className="when">{p2Date(a.created_at ?? null)}</span>
            </div>
          )) : <div className="p2-empty">Sem atividades registradas.</div>}
        </div>
        <Link to="/tasks" className="p2-link">Ver todas as atividades <ArrowRight /></Link>
      </section>

      {/* 7 — Resumo financeiro */}
      <section className="p2-card">
        <div className="p2-card-h"><span className="p2-card-t">7. Resumo financeiro</span></div>
        <div className="p2-fin">
          <div className="cell"><div className="k">Receita prevista</div><div className="v">{p2Money(revenue)}</div></div>
          <div className="cell"><div className="k">Faturado</div><div className="v">{p2Money(invoiced)}</div><div className="s">{revenue ? Math.round((invoiced / revenue) * 100) : 0}%</div></div>
          <div className="cell"><div className="k">Pendente</div><div className="v">{p2Money(pending)}</div><div className="s">{revenue ? Math.round((pending / revenue) * 100) : 0}%</div></div>
          <div className="cell"><div className="k">Margem estimada</div><div className="v">{margin}%</div></div>
        </div>
        <div className="p2-bars">
          <div className="b"><span className="val">{p2Money(revenue)}</span><span className="bar" style={{ height: barH(revenue), background: "#10B981" }} /><span className="lb">Previsto</span></div>
          <div className="b"><span className="val">{p2Money(invoiced)}</span><span className="bar" style={{ height: barH(invoiced), background: "#2F6BEF" }} /><span className="lb">Faturado</span></div>
          <div className="b"><span className="val">{p2Money(pending)}</span><span className="bar" style={{ height: barH(pending), background: "#F59E0B" }} /><span className="lb">Pendente</span></div>
        </div>
        <Link to="/invoices" className="p2-link">Ver relatório financeiro <ArrowRight /></Link>
      </section>

      {/* 8 — Entregas e arquivos recentes */}
      <section className="p2-card">
        <div className="p2-card-h"><span className="p2-card-t">8. Entregas e arquivos recentes</span></div>
        <div>
          {files.length ? files.map(f => (
            <div className="p2-file" key={f.id}>
              <FileText className="ic" />
              <span className="nm">{f.type} — {f.task}</span>
              <span className="ext">{(f.platform || "GERAL").slice(0, 6).toUpperCase()}</span>
              <MoreVertical style={{ width: 14, height: 14, color: "#C3CAD6" }} />
            </div>
          )) : <div className="p2-empty">Nenhum entregável cadastrado ainda.</div>}
        </div>
        <Link to="/tasks" className="p2-link">Ver todos os arquivos <ArrowRight /></Link>
      </section>
    </div>
  );
}
