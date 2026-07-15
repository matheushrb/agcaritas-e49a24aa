import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Search, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/team")({
  component: TeamPage,
});

type Level = "junior" | "mid" | "senior" | "lead";
type Status = "active" | "inactive" | "away" | "vacation";
type Member = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  specialty: string | null;
  level: Level | null;
  status: Status | null;
  hourly_rate: number | null;
  avatar_url: string | null;
};

const LEVEL_LABEL: Record<string, string> = { junior: "Júnior", mid: "Pleno", senior: "Sênior", lead: "Lead" };
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:   { label: "Ativo",    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  inactive: { label: "Inativo",  color: "bg-muted text-muted-foreground" },
  away:     { label: "Ausente",  color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  vacation: { label: "Férias",   color: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
};

function TeamPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id,name,email,phone,role,specialty,level,status,hourly_rate,avatar_url")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Member[];
    },
  });

  const filtered = useMemo(() =>
    members.filter(m => !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.role?.toLowerCase().includes(search.toLowerCase())),
  [members, search]);

  const kpis = useMemo(() => ({
    total: members.length,
    active: members.filter(m => m.status === "active").length,
    away: members.filter(m => m.status === "away" || m.status === "vacation").length,
  }), [members]);

  const create = useMutation({
    mutationFn: async (input: Partial<Member>) => {
      const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await supabase.from("team_members").insert({
        organization_id: profile.organization_id,
        name: input.name!,
        email: input.email,
        phone: input.phone,
        role: input.role,
        specialty: input.specialty,
        level: input.level,
        status: input.status ?? "active",
        hourly_rate: input.hourly_rate,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team-members"] }); toast.success("Membro adicionado"); setNewOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Users className="size-6" />Equipe</h1>
          <p className="text-sm text-muted-foreground">Time, especialidades e custos por hora.</p>
        </div>
        <Button onClick={() => setNewOpen(true)}><Plus className="size-4 mr-1" />Novo membro</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-xl font-semibold">{kpis.total}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Ativos</div><div className="text-xl font-semibold">{kpis.active}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Onboarding</div><div className="text-xl font-semibold">{kpis.onboarding}</div></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou cargo…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(m => (
          <Card key={m.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center font-medium">
                {m.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium truncate">{m.name}</h3>
                  {m.status && <Badge className={STATUS_LABEL[m.status]?.color}>{STATUS_LABEL[m.status]?.label}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {m.role ?? "—"}{m.level ? ` · ${LEVEL_LABEL[m.level]}` : ""}
                </p>
                {m.specialty && <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.specialty}</p>}
              </div>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {m.email && <div className="flex items-center gap-1.5"><Mail className="size-3" />{m.email}</div>}
              {m.phone && <div className="flex items-center gap-1.5"><Phone className="size-3" />{m.phone}</div>}
              {m.hourly_rate && <div>R$ {Number(m.hourly_rate).toFixed(2)}/h</div>}
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground col-span-full">Nenhum membro.</p>}
      </div>

      <NewMemberDialog open={newOpen} onOpenChange={setNewOpen} onCreate={(v) => create.mutate(v)} />
    </div>
  );
}

function NewMemberDialog({ open, onOpenChange, onCreate }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreate: (v: Partial<Member>) => void;
}) {
  const [f, setF] = useState<Partial<Member>>({ status: "active", level: "mid" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo membro</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Nome completo" value={f.name ?? ""} onChange={e => setF({ ...f, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="E-mail" value={f.email ?? ""} onChange={e => setF({ ...f, email: e.target.value })} />
            <Input placeholder="Telefone" value={f.phone ?? ""} onChange={e => setF({ ...f, phone: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Cargo" value={f.role ?? ""} onChange={e => setF({ ...f, role: e.target.value })} />
            <Input placeholder="Especialidade" value={f.specialty ?? ""} onChange={e => setF({ ...f, specialty: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Select value={f.level ?? undefined} onValueChange={(v) => setF({ ...f, level: v as Level })}>
              <SelectTrigger><SelectValue placeholder="Nível" /></SelectTrigger>
              <SelectContent>{Object.entries(LEVEL_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={f.status ?? undefined} onValueChange={(v) => setF({ ...f, status: v as Status })}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" step="0.01" placeholder="R$/h"
              value={f.hourly_rate ?? ""} onChange={e => setF({ ...f, hourly_rate: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onCreate(f)} disabled={!f.name}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
