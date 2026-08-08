import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Sparkles, Check, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Página pública de proposta.
 * URL: /p/:token — `token` é o `public_token` da proposta.
 * Leitura e resposta passam por funções SECURITY DEFINER (get_public_proposal /
 * respond_public_proposal); a tabela não é exposta ao papel anônimo.
 */
export const Route = createFileRoute("/p/$token")({
  head: () => ({
    meta: [
      { title: "Proposta comercial · Caritas Agência" },
      { name: "description", content: "Visualize e aprove sua proposta comercial da Caritas Agência." },
      { property: "og:title", content: "Proposta comercial · Caritas Agência" },
      { property: "og:description", content: "Visualize e aprove sua proposta comercial da Caritas Agência." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicProposalPage,
});

type ProposalStatus = "draft" | "sent" | "viewed" | "approved" | "declined";

type Proposal = {
  id: string;
  doc_number: string | null;
  number: string;
  status: ProposalStatus;
  total_value: number;
  billing_model: string;
  items: any;
  valid_until: string | null;
  created_at: string;
  title: string | null;
  scope_text: string | null;
};

const STATUS_META: Record<ProposalStatus, { label: string; tone: string }> = {
  draft:    { label: "Rascunho",    tone: "bg-muted text-muted-foreground" },
  sent:     { label: "Enviada",     tone: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  viewed:   { label: "Visualizada", tone: "bg-violet-500/15 text-violet-600 dark:text-violet-400" },
  approved: { label: "Aprovada",    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  declined: { label: "Recusada",    tone: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

function PublicProposalPage() {
  const { token } = Route.useParams();

  const { data, isLoading, error } = useQuery<Proposal | null>({
    queryKey: ["public-proposal", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_proposal", { p_token: token });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as Proposal | null;
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

        {data && <ProposalView p={data} token={token} />}
      </main>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © Caritas Agência — proposta gerada em {data ? new Date(data.created_at).toLocaleDateString("pt-BR") : "—"}
      </footer>
    </div>
  );
}

function ProposalView({ p, token }: { p: Proposal; token: string }) {
  const qc = useQueryClient();
  const items = Array.isArray(p.items) ? p.items : [];
  const total = Number(p.total_value ?? 0);

  const [dialog, setDialog] = useState<null | "approve" | "decline">(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ProposalStatus | null>(null);

  const status = resolved ?? p.status;
  const isResolved = status === "approved" || status === "declined";
  const expired = !!p.valid_until && new Date(p.valid_until) < new Date(new Date().toDateString());
  const canRespond = !isResolved && (status === "sent" || status === "viewed") && !expired;

  const respond = useMutation({
    mutationFn: async (action: "approve" | "decline") => {
      const { data, error } = await supabase.rpc("respond_public_proposal", {
        p_token: token,
        p_action: action,
        p_name: name.trim() || null,
        p_email: email.trim() || null,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      return data as ProposalStatus;
    },
    onSuccess: (finalStatus) => {
      setResolved(finalStatus);
      setDialog(null);
      qc.invalidateQueries({ queryKey: ["public-proposal", token] });
    },
    onError: (e: any) => setErrMsg(e?.message ?? "Não foi possível registrar sua resposta."),
  });

  const meta = STATUS_META[status] ?? STATUS_META.sent;

  const submitDisabled =
    respond.isPending ||
    (dialog === "approve" && (!name.trim() || !email.trim())) ||
    (dialog === "decline" && !notes.trim());

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Proposta</div>
          <h1 className="font-display text-3xl font-bold">#{p.doc_number || p.number}</h1>
          {p.title && <p className="text-sm text-muted-foreground mt-1">{p.title}</p>}
          {p.valid_until && (
            <p className="text-sm text-muted-foreground mt-1">
              Válida até {new Date(p.valid_until).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
        <Badge className={cn("rounded-full", meta.tone)}>{meta.label}</Badge>
      </div>

      <Card className="rounded-3xl p-6 space-y-4">
        <div className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Escopo</div>
        {p.scope_text && <p className="text-sm whitespace-pre-line">{p.scope_text}</p>}
        {items.length === 0 ? (
          !p.scope_text && <p className="text-sm text-muted-foreground">Sem itens cadastrados.</p>
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

      {status === "approved" && (
        <Card className="rounded-3xl p-6 text-center border-emerald-500/30 bg-emerald-500/5">
          <Check className="h-7 w-7 mx-auto text-emerald-600 dark:text-emerald-400 mb-2" />
          <div className="font-medium">Proposta aprovada!</div>
          <p className="text-sm text-muted-foreground mt-1">Em breve entraremos em contato.</p>
        </Card>
      )}

      {status === "declined" && (
        <Card className="rounded-3xl p-6 text-center border-red-500/30 bg-red-500/5">
          <XCircle className="h-7 w-7 mx-auto text-red-600 dark:text-red-400 mb-2" />
          <div className="font-medium">Ajustes solicitados</div>
          <p className="text-sm text-muted-foreground mt-1">Recebemos sua observação e vamos retornar com uma nova versão.</p>
        </Card>
      )}

      {!isResolved && expired && (
        <p className="text-sm text-muted-foreground text-center">
          O prazo de validade desta proposta expirou. Entre em contato para uma nova versão.
        </p>
      )}

      {canRespond && (
        <>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" className="rounded-full" onClick={() => { setErrMsg(null); setDialog("decline"); }}>
              Solicitar ajustes
            </Button>
            <Button className="rounded-full gap-1.5" onClick={() => { setErrMsg(null); setDialog("approve"); }}>
              <Check className="h-4 w-4" /> Aceitar proposta
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center pt-4">
            Ao aceitar, você concorda com os termos comerciais desta proposta. Um contrato será gerado automaticamente.
          </p>
        </>
      )}

      <Dialog open={dialog !== null} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{dialog === "approve" ? "Aprovar proposta" : "Solicitar ajustes"}</DialogTitle>
            <DialogDescription>
              {dialog === "approve"
                ? "Informe seus dados para registrarmos a aprovação."
                : "Conte o que precisa ser ajustado que retornamos com uma nova versão."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {dialog === "approve" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="p-name">Seu nome</Label>
                  <Input id="p-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-email">E-mail</Label>
                  <Input id="p-email" type="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="p-notes">{dialog === "approve" ? "Observações (opcional)" : "O que precisa ajustar"}</Label>
              <Textarea id="p-notes" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} rows={4} />
            </div>
            {errMsg && <p className="text-sm text-destructive">{errMsg}</p>}
          </div>

          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button
              className="rounded-full"
              disabled={submitDisabled}
              onClick={() => dialog && respond.mutate(dialog)}
            >
              {respond.isPending ? "Enviando…" : dialog === "approve" ? "Confirmar aprovação" : "Enviar solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
