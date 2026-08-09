import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SwotBoard } from "@/components/strategy/swot-board";
import { RoadmapTimeline } from "@/components/strategy/roadmap-timeline";
import { PersonasBoard } from "@/components/strategy/personas-board";
import { KpisTool } from "@/components/strategy/kpis-tool";
import { ActionsList } from "@/components/strategy/actions-list";
import { toast } from "sonner";
import "@/windows.css";

const sb = supabase as any;

export const Route = createFileRoute("/_authenticated/strategy/$planId")({
  head: () => ({ meta: [{ title: "Plano de ação · Caritas" }] }),
  component: StrategyPlanPage,
});

type Plan = {
  id: string;
  name: string;
  tools: string[];
  lead_id: string;
  leads: { name: string } | null;
};

const TOOLS: { key: string; label: string; render: (planId: string) => JSX.Element }[] = [
  { key: "swot", label: "SWOT", render: id => <SwotBoard planId={id} /> },
  { key: "roadmap", label: "Roadmap", render: id => <RoadmapTimeline planId={id} /> },
  { key: "personas", label: "Personas", render: id => <PersonasBoard planId={id} /> },
  { key: "kpis", label: "KPIs", render: id => <KpisTool planId={id} /> },
  { key: "actions", label: "Ações", render: id => <ActionsList planId={id} /> },
];

function StrategyPlanPage() {
  const { planId } = Route.useParams();
  const qc = useQueryClient();
  const key = ["strategic_plan", planId];

  const { data: plan, isLoading } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Plan | null> => {
      const { data, error } = await sb
        .from("strategic_plans")
        .select("id,name,tools,lead_id,leads(name)")
        .eq("id", planId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Plan | null;
    },
  });

  const renamePlan = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await sb.from("strategic_plans").update({ name }).eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["strategic_plans"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao renomear"),
  });

  if (isLoading) return <div className="cw p-4 text-sm text-muted-foreground">Carregando…</div>;
  if (!plan) return <div className="cw p-4 text-sm text-muted-foreground">Plano não encontrado.</div>;

  const tools = TOOLS.filter(t => (plan.tools ?? []).includes(t.key));
  const active = tools[0]?.key ?? "swot";

  return (
    <div className="cw space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <input
            className="cw-input text-base font-semibold"
            defaultValue={plan.name}
            onBlur={e => {
              const v = e.target.value.trim();
              if (v && v !== plan.name) renamePlan.mutate(v);
            }}
            onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          />
          <p className="mt-1 text-xs text-muted-foreground">{plan.leads?.name ?? "Lead"}</p>
        </div>
        <Link to="/crm" className="cw-btn cw-btn-secondary">← Voltar</Link>
      </div>

      <Tabs defaultValue={active}>
        <TabsList className="w-full">
          {tools.map(t => (
            <TabsTrigger key={t.key} value={t.key} className="flex-1">{t.label}</TabsTrigger>
          ))}
        </TabsList>
        {tools.map(t => (
          <TabsContent key={t.key} value={t.key} className="mt-4">
            {t.render(plan.id)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
