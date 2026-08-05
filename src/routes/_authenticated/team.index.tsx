import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Users, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Rh01Overview } from "@/components/rh01-overview";
import { Rh02People } from "@/components/rh02-people";
import { HrMemberDialog } from "@/components/hr-member-dialog";
import { MEMBER_COLUMNS, CONTRACT_TYPES, costSummary, type HrMember } from "@/lib/hr";

const WRITABLE_KEYS = [
  "name","email","phone","role","specialty","level","status","hourly_rate","avatar_url",
  "cost_mode","monthly_salary","monthly_hours","default_task_rate","task_rate_overrides","cost_notes",
  "contract_type","area","admitted_on","birth_date","work_location","hr_notes",
  "company_legal_name","company_tax_id","company_contact",
] as const;

type Tab = "overview" | "people";

export const Route = createFileRoute("/_authenticated/team/")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab; new?: string } => ({
    tab: s.tab === "people" ? "people" : s.tab === "overview" ? "overview" : undefined,
    new: typeof s.new === "string" ? s.new : undefined,
  }),
  component: HrPage,
});

function HrPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/team/" });
  const tab: Tab = search.tab ?? "overview";

  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id ?? null)); }, []);

  const [newOpen, setNewOpen] = useState(search.new === "1");
  const [editing, setEditing] = useState<HrMember | null>(null);

  const { data: members = [] } = useQuery<HrMember[]>({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select(MEMBER_COLUMNS).order("name");
      if (error) throw error;
      return (data ?? []).map((m: any) => ({ ...m, task_rate_overrides: m.task_rate_overrides ?? {} })) as HrMember[];
    },
  });

  const me = useMemo(() => members.find(m => m.user_id && m.user_id === uid) ?? null, [members, uid]);

  const createMe = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) throw new Error("Sessão inválida");
      const { data: profile } = await supabase.from("profiles").select("organization_id,full_name,role_title,avatar_url").maybeSingle();
      if (!profile?.organization_id) throw new Error("Sem organização");
      const { error } = await supabase.from("team_members").insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        name: profile.full_name || user.email?.split("@")[0] || "Eu",
        email: user.email,
        role: profile.role_title || "Administrador",
        avatar_url: profile.avatar_url,
        status: "active",
        cost_mode: "internal_fixed",
        contract_type: "internal",
        monthly_hours: 160,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["team-members"] }); toast.success("Seu cadastro foi criado na equipe"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const upsert = useMutation({
    mutationFn: async (input: Partial<HrMember> & { id?: string }) => {
      const payload: Record<string, any> = {};
      for (const k of WRITABLE_KEYS) if (k in input) payload[k] = (input as any)[k];
      if (input.id) {
        const { error } = await supabase.from("team_members").update(payload as any).eq("id", input.id);
        if (error) throw error;
      } else {
        const { data: profile } = await supabase.from("profiles").select("organization_id").maybeSingle();
        if (!profile?.organization_id) throw new Error("Sem organização");
        const { error } = await supabase.from("team_members").insert({
          organization_id: profile.organization_id,
          ...payload,
          name: input.name!,
          status: input.status ?? "active",
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Salvo");
      setNewOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Users className="size-6" />RH</h1>
          <p className="text-sm text-muted-foreground">Pessoas, vínculos, custo e capacidade da agência.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
            {([["overview", "Visão geral"], ["people", "Pessoas"]] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => navigate({ to: "/team", search: { tab: k } })}
                className={`px-3.5 py-1.5 rounded-full text-[13px] transition ${tab === k ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <Button className="rounded-full" onClick={() => setNewOpen(true)}><Plus className="size-4 mr-1" />Nova pessoa</Button>
        </div>
      </div>

      {uid && !me && (
        <Card className="p-4 flex items-center justify-between gap-4 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="size-5 text-amber-500 mt-0.5" />
            <div>
              <div className="text-sm font-medium">Você ainda não tem cadastro na equipe</div>
              <p className="text-xs text-muted-foreground">Ter login é diferente de ser colaborador. Crie o seu cadastro para registrar salário, custo/hora e entrar nos cálculos de custo dos projetos.</p>
            </div>
          </div>
          <Button className="rounded-full shrink-0" onClick={() => createMe.mutate()} disabled={createMe.isPending}>Criar meu cadastro</Button>
        </Card>
      )}
      {me && (
        <Card className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="size-5 text-emerald-500 mt-0.5" />
            <div>
              <div className="text-sm font-medium">Seu cadastro: {me.name}</div>
              <p className="text-xs text-muted-foreground">{CONTRACT_TYPES[me.contract_type as keyof typeof CONTRACT_TYPES]?.label} · {costSummary(me)}</p>
            </div>
          </div>
          <Button variant="outline" className="rounded-full shrink-0" onClick={() => setEditing(me)}>Editar meus dados e custo</Button>
        </Card>
      )}

      {tab === "overview" ? <Rh01Overview members={members} /> : <Rh02People members={members} onEdit={setEditing} />}

      {(newOpen || editing) && (
        <HrMemberDialog
          open={newOpen || !!editing}
          onOpenChange={(v) => { if (!v) { setNewOpen(false); setEditing(null); } }}
          initial={editing}
          onSave={(v) => upsert.mutate(editing ? { ...v, id: editing.id } : v)}
        />
      )}
    </div>
  );
}
