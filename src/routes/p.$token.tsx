import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Página pública de proposta (T21 do documento).
 * URL: /p/:token — acessada por link enviado ao cliente, sem login.
 * Neste MVP, o `token` é o próprio proposal.id (público via policy dedicada
 * a ser adicionada; sem policy anon, mostra tela de acesso restrito).
 */
export const Route = createFileRoute("/p/$token")({
  head: ({ loaderData }) => {
    const p = loaderData as { number?: string } | undefined;
    return {
      meta: [
        { title: p?.number ? `Proposta ${p.number} · Caritas` : "Proposta · Caritas" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: PublicProposalPage,
});

type Proposal = {
  id: string;
  number: string;
  status: string;
  total_value: number;
  billing_model: string;
  items: any;
  valid_until: string | null;
  created_at: string;
};

function PublicProposalPage() {
  const { token } = Route.useParams();

  const { data, isLoading, error } = useQuery<Proposal | null>({
    queryKey: ["public-proposal", token],
    queryFn: async () => {
      const { data, error } = await supabase.from("proposals")
        .select("id,number,status,total_value,billing_model,items,valid_until,created_at")
        .eq("id", token).maybeSingle();
      if (error) throw error;
      return data as Proposal | null;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="font-display font-bold">Caritas Agência</div>
            <div className="text-xs text-muted-foreground">Proposta comercial</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {isLoading && <div className="text-sm text-muted-foreground">Carregando proposta…</div>}
        {(error || (!isLoading && !data)) && (
          <Card className="rounded-3xl p-12 text-center border-dashed">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <div className="font-medium">Proposta indisponível</div>
            <p className="text-sm text-muted-foreground mt-1">O link expirou ou está incorreto.</p>
          </Card>
        )}

        {data && <ProposalView p={data} />}
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © Caritas Agência — proposta gerada em {data ? new Date(data.created_at).toLocaleDateString("pt-BR") : "—"}
      </footer>
    </div>
  );
}

function ProposalView({ p }: { p: Proposal }) {
  const items = Array.isArray(p.items) ? p.items : [];
  const total = Number(p.total_value ?? 0);

  const statusColor: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    sent: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    rejected: "bg-red-500/15 text-red-600 dark:text-red-400",
    negotiating: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Proposta</div>
          <h1 className="font-display text-3xl font-bold">#{p.number}</h1>
          {p.valid_until && (
            <p className="text-sm text-muted-foreground mt-1">
              Válida até {new Date(p.valid_until).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
        <Badge className={cn("rounded-full", statusColor[p.status] ?? "bg-muted")}>{p.status}</Badge>
      </div>

      <Card className="rounded-3xl p-6 space-y-4">
        <div className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Escopo</div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem itens cadastrados.</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item: any, i: number) => (
              <li key={i} className="py-3 flex items-start gap-3">
                <div className="mt-1 grid h-5 w-5 place-items-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{item.title ?? item.name ?? `Item ${i + 1}`}</div>
                  {item.description && <div className="text-sm text-muted-foreground">{item.description}</div>}
                </div>
                {item.value != null && (
                  <div className="text-sm font-semibold shrink-0">
                    R$ {Number(item.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4 bg-primary/5 border-primary/20">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Modelo</div>
          <div className="font-medium capitalize">{p.billing_model}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Total</div>
          <div className="font-display text-3xl font-bold text-primary">
            R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" className="rounded-full">Solicitar ajustes</Button>
        <Button className="rounded-full gap-1.5"><Check className="h-4 w-4" /> Aceitar proposta</Button>
      </div>

      <p className="text-xs text-muted-foreground text-center pt-4">
        Ao aceitar, você concorda com os termos comerciais desta proposta. Um contrato será gerado automaticamente.
      </p>
    </div>
  );
}
