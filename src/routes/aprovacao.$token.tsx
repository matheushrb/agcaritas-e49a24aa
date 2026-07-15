import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/aprovacao/$token")({
  head: () => ({ meta: [
    { title: "Aprovação de conteúdo" },
    { name: "robots", content: "noindex" },
  ]}),
  component: PublicApproval,
});

function PublicApproval() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const [dialogMode, setDialogMode] = useState<"approve" | "changes" | null>(null);

  const { data: item, isLoading, error } = useQuery({
    queryKey: ["approval", token],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_items" as any)
        .select("id,title,platform,content_type,publish_date,publish_time,status,copy_text,approval_token,approved_at,approved_by_name,approved_by_email,notes,organization_id")
        .eq("approval_token", token)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  if (isLoading) {
    return <Center><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></Center>;
  }

  if (error || !item) {
    return <Center>
      <Card className="rounded-3xl p-10 max-w-md text-center">
        <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <div className="text-lg font-semibold">Link inválido ou expirado</div>
        <p className="text-sm text-muted-foreground mt-2">Solicite um novo link à agência.</p>
      </Card>
    </Center>;
  }

  if (item.approved_at) {
    return <Center>
      <Card className="rounded-3xl p-10 max-w-md text-center">
        <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
        <div className="text-lg font-semibold">Conteúdo já aprovado</div>
        <p className="text-sm text-muted-foreground mt-2">Aprovado em {new Date(item.approved_at).toLocaleString("pt-BR")}{item.approved_by_name ? ` por ${item.approved_by_name}` : ""}.</p>
      </Card>
    </Center>;
  }

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center"><Sparkles className="h-4 w-4" /></div>
          <div className="font-display text-lg font-bold">Caritas Agência</div>
        </div>

        <Card className="rounded-3xl p-8 space-y-5">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Aprovação de conteúdo</div>
            <h1 className="text-2xl font-bold tracking-tight mt-1">{item.title}</h1>
            <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              {item.platform && <Badge variant="outline" className="rounded-full">{item.platform}</Badge>}
              {item.content_type && <Badge variant="outline" className="rounded-full">{item.content_type}</Badge>}
              {item.publish_date && <span>Publicação: {new Date(item.publish_date).toLocaleDateString("pt-BR")}</span>}
            </div>
          </div>

          {item.copy_text && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Copy / Legenda</div>
              <div className="rounded-2xl bg-muted p-4 text-sm whitespace-pre-wrap">{item.copy_text}</div>
            </div>
          )}

          {item.notes && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Observações</div>
              <div className="text-sm text-muted-foreground">{item.notes}</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
            <Button size="lg" className="rounded-2xl gap-2 h-14 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setDialogMode("approve")}>
              <CheckCircle2 className="h-5 w-5" /> Aprovar conteúdo
            </Button>
            <Button size="lg" variant="outline" className="rounded-2xl gap-2 h-14" onClick={() => setDialogMode("changes")}>
              ✏️ Solicitar ajustes
            </Button>
          </div>
        </Card>
      </div>

      <ActionDialog
        mode={dialogMode}
        onClose={() => setDialogMode(null)}
        item={item}
        onDone={() => { qc.invalidateQueries({ queryKey: ["approval", token] }); setDialogMode(null); }}
      />
    </div>
  );
}

function Center({ children }: { children: any }) {
  return <div className="min-h-screen bg-muted/30 grid place-items-center px-4">{children}</div>;
}

function ActionDialog({ mode, onClose, item, onDone }: { mode: "approve" | "changes" | null; onClose: () => void; item: any; onDone: () => void }) {
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (!mode) { setName(""); setEmail(""); setComment(""); } }, [mode]);

  const submit = async () => {
    if (!name.trim() || !email.trim()) { toast.error("Nome e e-mail obrigatórios"); return; }
    if (mode === "changes" && !comment.trim()) { toast.error("Descreva os ajustes"); return; }
    setSaving(true);
    try {
      if (mode === "approve") {
        const { error } = await supabase.from("content_items" as any).update({
          status: "approved", approved_at: new Date().toISOString(),
          approved_by_name: name, approved_by_email: email,
        }).eq("approval_token", item.approval_token);
        if (error) throw error;
        toast.success("Conteúdo aprovado!");
      } else {
        await supabase.from("approval_comments" as any).insert({
          organization_id: item.organization_id, content_item_id: item.id,
          comment, commenter_name: name, commenter_email: email,
        });
        await supabase.from("content_items" as any).update({ status: "review" }).eq("approval_token", item.approval_token);
        toast.success("Ajustes enviados à agência");
      }
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl max-w-md">
        <DialogTitle className={cn(mode === "approve" ? "text-emerald-600" : "")}>
          {mode === "approve" ? "Aprovar conteúdo" : "Solicitar ajustes"}
        </DialogTitle>
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-xs text-muted-foreground">Seu nome *</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="rounded-xl mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Seu e-mail *</label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="rounded-xl mt-1" />
          </div>
          {mode === "changes" && (
            <div>
              <label className="text-xs text-muted-foreground">Ajustes solicitados *</label>
              <Textarea rows={5} value={comment} onChange={e => setComment(e.target.value)} className="rounded-xl mt-1" />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" className="rounded-full" onClick={onClose}>Cancelar</Button>
          <Button className={cn("rounded-full", mode === "approve" && "bg-emerald-600 hover:bg-emerald-700 text-white")} onClick={submit} disabled={saving}>
            {saving ? "Enviando..." : mode === "approve" ? "Confirmar aprovação" : "Enviar solicitação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
