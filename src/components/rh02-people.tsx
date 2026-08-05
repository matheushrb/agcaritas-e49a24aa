import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Pencil, Mail, Phone, LayoutGrid, List } from "lucide-react";
import {
  CONTRACT_TYPES, STATUS_META, LEVEL_LABEL, initialsOf, costSummary, hourCost, brl2, fmtFull,
  type HrMember, type HrContractType,
} from "@/lib/hr";

type TabKey = "all" | HrContractType;

export function Rh02People({ members, onEdit }: { members: HrMember[]; onEdit: (m: HrMember) => void }) {
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [area, setArea] = useState<string>("all");
  const [view, setView] = useState<"table" | "cards">("table");

  const areas = useMemo(
    () => [...new Set(members.map(m => m.area?.trim()).filter(Boolean) as string[])].sort(),
    [members],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: members.length };
    (Object.keys(CONTRACT_TYPES) as HrContractType[]).forEach(k => {
      c[k] = members.filter(m => m.contract_type === k).length;
    });
    return c;
  }, [members]);

  const filtered = useMemo(() => members.filter(m => {
    if (tab !== "all" && m.contract_type !== tab) return false;
    if (status !== "all" && (m.status ?? "active") !== status) return false;
    if (area !== "all" && (m.area?.trim() || "") !== area) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [m.name, m.role, m.specialty, m.email, m.area].some(v => v?.toLowerCase().includes(q));
  }), [members, tab, status, area, search]);

  return (
    <div className="space-y-4">
      {/* RH02-02 · abas por vínculo */}
      <div className="flex flex-wrap items-center gap-1.5">
        <TabChip active={tab === "all"} onClick={() => setTab("all")} label="Todos" count={counts.all} />
        {(Object.keys(CONTRACT_TYPES) as HrContractType[]).map(k => (
          <TabChip
            key={k} active={tab === k} onClick={() => setTab(k)}
            label={CONTRACT_TYPES[k].short} count={counts[k]} dot={CONTRACT_TYPES[k].dot}
          />
        ))}
      </div>

      {/* RH02-03 · filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, cargo, área…" className="pl-9 rounded-full" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px] rounded-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger className="w-[160px] rounded-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as áreas</SelectItem>
            {areas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1 rounded-full border border-border p-0.5">
          <button onClick={() => setView("table")} className={`p-1.5 rounded-full ${view === "table" ? "bg-muted" : ""}`} title="Tabela"><List className="size-4" /></button>
          <button onClick={() => setView("cards")} className={`p-1.5 rounded-full ${view === "cards" ? "bg-muted" : ""}`} title="Cards"><LayoutGrid className="size-4" /></button>
        </div>
      </div>

      {view === "table" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="text-left font-medium px-4 py-2.5">Pessoa</th>
                  <th className="text-left font-medium px-3 py-2.5">Vínculo</th>
                  <th className="text-left font-medium px-3 py-2.5">Área / cargo</th>
                  <th className="text-left font-medium px-3 py-2.5">Contato</th>
                  <th className="text-right font-medium px-3 py-2.5">Custo</th>
                  <th className="text-right font-medium px-3 py-2.5">Custo/h</th>
                  <th className="text-left font-medium px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const ch = hourCost(m);
                  return (
                    <tr key={m.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40 transition">
                      <td className="px-4 py-2.5">
                        <Link to="/team/$memberId" params={{ memberId: m.id }} className="flex items-center gap-2.5">
                          <span className="size-8 rounded-full bg-muted flex items-center justify-center text-[11px] font-medium">{initialsOf(m.name)}</span>
                          <span className="font-medium">{m.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${CONTRACT_TYPES[m.contract_type].tone}`}>
                          <span className={`size-1.5 rounded-full ${CONTRACT_TYPES[m.contract_type].dot}`} />
                          {CONTRACT_TYPES[m.contract_type].label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div>{m.area || "—"}</div>
                        <div className="text-[11px] text-muted-foreground">{m.role || "—"}{m.level ? ` · ${LEVEL_LABEL[m.level]}` : ""}</div>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-[12px]">
                        <div className="truncate max-w-[180px]">{m.email || "—"}</div>
                        <div>{m.phone || ""}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{costSummary(m)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{ch ? brl2(ch) : "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_META[m.status ?? "active"]?.tone}`}>
                          {STATUS_META[m.status ?? "active"]?.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={() => onEdit(m)} className="p-1.5 rounded-md hover:bg-muted" title="Editar"><Pencil className="size-3.5" /></button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhuma pessoa encontrada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(m => (
            <Card key={m.id} className="p-4 group relative">
              <button onClick={() => onEdit(m)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition p-1.5 rounded-md hover:bg-muted" title="Editar">
                <Pencil className="size-3.5" />
              </button>
              <Link to="/team/$memberId" params={{ memberId: m.id }} className="flex items-start gap-3">
                <div className="size-12 rounded-full bg-muted flex items-center justify-center font-medium">{initialsOf(m.name)}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{m.name}</div>
                  <div className="text-[12px] text-muted-foreground truncate">{m.role || "—"}{m.area ? ` · ${m.area}` : ""}</div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${CONTRACT_TYPES[m.contract_type].tone}`}>
                      {CONTRACT_TYPES[m.contract_type].label}
                    </span>
                    <Badge className={`text-[10px] ${STATUS_META[m.status ?? "active"]?.tone}`} variant="secondary">
                      {STATUS_META[m.status ?? "active"]?.label}
                    </Badge>
                  </div>
                </div>
              </Link>
              <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                {m.email && <div className="flex items-center gap-1.5 truncate"><Mail className="size-3" />{m.email}</div>}
                {m.phone && <div className="flex items-center gap-1.5"><Phone className="size-3" />{m.phone}</div>}
                <div>Custo: <span className="text-foreground">{costSummary(m)}</span></div>
                {m.admitted_on && <div>Desde {fmtFull(m.admitted_on)}</div>}
              </div>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full">Nenhuma pessoa encontrada.</p>}
        </div>
      )}
    </div>
  );
}

function TabChip({ active, onClick, label, count, dot }: { active: boolean; onClick: () => void; label: string; count?: number; dot?: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] transition ${
        active ? "border-primary bg-primary/10 text-primary font-medium" : "border-border bg-card hover:bg-muted/60"
      }`}
    >
      {dot && <span className={`size-1.5 rounded-full ${dot}`} />}
      {label}
      <span className="text-[11px] text-muted-foreground tabular-nums">{count ?? 0}</span>
    </button>
  );
}
