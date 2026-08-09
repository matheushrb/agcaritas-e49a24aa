import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import "@/windows.css";

const sb = supabase as any;

export const Route = createFileRoute("/_authenticated/strategy")({
  head: () => ({ meta: [{ title: "Planejamento Estratégico · Caritas" }] }),
  component: StrategyListPage,
});

type PlanRow = {
  id: string;
  name: string;
  created_at: string;
  lead_id: string;
  leads: { name: string } | null;
};

function StrategyListPage() {
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["strategic_plans"],
    queryFn: async (): Promise<PlanRow[]> => {
      const { data, error } = await sb
        .from("strategic_plans")
        .select("id,name,created_at,lead_id,leads(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlanRow[];
    },
  });

  return (
    <div className="cw space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Planejamento Estratégico</h1>
        <p className="text-sm text-muted-foreground">Planos de ação criados a partir dos leads.</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && plans.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum plano ainda. Crie um plano dentro de um lead no CRM.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {plans.map(p => (
          <Link key={p.id} to="/strategy/$planId" params={{ planId: p.id }} className="cw-card cw-card-pad block space-y-1">
            <p className="truncate text-sm font-medium">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.leads?.name ?? "Lead removido"}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(p.created_at).toLocaleDateString("pt-BR")}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
