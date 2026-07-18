import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Newspaper, Plus, Trash2, ImagePlus, Loader2, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NewsRow {
  id: string;
  title: string;
  body: string | null;
  image_url: string | null;
  link_url: string | null;
  active: boolean;
  sort_order: number;
  published_at: string;
}

export function NewsEditor() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", link_url: "", image_url: "" });
  const [uploading, setUploading] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["dashboard-news-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dashboard_news" as any)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("published_at", { ascending: false });
      return (data as any as NewsRow[]) ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["dashboard-news-admin"] });
    qc.invalidateQueries({ queryKey: ["dashboard-news-active"] });
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id ?? "anon";
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${uid}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("dashboard-news").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("dashboard-news").createSignedUrl(path, 60 * 60 * 24 * 365);
      return signed?.signedUrl ?? null;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Título é obrigatório");
      const { data: p } = await supabase.from("profiles").select("organization_id").maybeSingle();
      const { data: userRes } = await supabase.auth.getUser();
      if (!p?.organization_id) throw new Error("Organização não encontrada");
      const maxOrder = Math.max(0, ...rows.map(r => r.sort_order));
      const { error } = await supabase.from("dashboard_news" as any).insert({
        organization_id: p.organization_id,
        created_by: userRes.user?.id,
        title: form.title.trim(),
        body: form.body.trim() || null,
        link_url: form.link_url.trim() || null,
        image_url: form.image_url || null,
        active: true,
        sort_order: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notícia publicada");
      setForm({ title: "", body: "", link_url: "", image_url: "" });
      setCreating(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<NewsRow> }) => {
      const { error } = await supabase.from("dashboard_news" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dashboard_news" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Notícia removida"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= rows.length) return;
    const a = rows[idx], b = rows[target];
    update.mutate({ id: a.id, patch: { sort_order: b.sort_order } });
    update.mutate({ id: b.id, patch: { sort_order: a.sort_order } });
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-medium">
              <Newspaper className="h-4 w-4 text-primary" /> Painel de notícias
            </div>
            <p className="text-xs text-muted-foreground mt-1">Comunicados que aparecem em carrossel no dashboard de todos os membros.</p>
          </div>
          {!creating && (
            <Button className="rounded-full" size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nova notícia
            </Button>
          )}
        </div>

        {creating && (
          <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input placeholder="Ex.: Nova cliente na casa!" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Texto</Label>
              <Textarea rows={3} placeholder="Corpo da notícia..." value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Link (opcional)</Label>
              <Input placeholder="https://..." value={form.link_url}
                onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Imagem (opcional)</Label>
              {form.image_url ? (
                <div className="relative h-32 w-full overflow-hidden rounded-lg bg-muted">
                  <img src={form.image_url} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => setForm(f => ({ ...f, image_url: "" }))}
                    className="absolute top-1 right-1 h-7 w-7 rounded-full bg-background/90 inline-flex items-center justify-center hover:bg-background">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className={cn("flex flex-col items-center justify-center gap-1 border border-dashed rounded-lg py-6 cursor-pointer hover:bg-muted/50 transition", uploading && "opacity-60 pointer-events-none")}>
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5 text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground">{uploading ? "Enviando..." : "Enviar imagem"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const url = await uploadImage(file);
                    if (url) setForm(f => ({ ...f, image_url: url }));
                  }} />
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" className="rounded-full" size="sm" onClick={() => { setCreating(false); setForm({ title: "", body: "", link_url: "", image_url: "" }); }}>Cancelar</Button>
              <Button className="rounded-full" size="sm" disabled={create.isPending || !form.title.trim()} onClick={() => create.mutate()}>
                Publicar
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Carregando...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Nenhuma notícia publicada.</div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((n, idx) => (
              <li key={n.id} className="py-3 flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} className="h-5 w-5 rounded hover:bg-muted disabled:opacity-30 inline-flex items-center justify-center"><ArrowUp className="h-3 w-3" /></button>
                  <button onClick={() => move(idx, 1)} disabled={idx === rows.length - 1} className="h-5 w-5 rounded hover:bg-muted disabled:opacity-30 inline-flex items-center justify-center"><ArrowDown className="h-3 w-3" /></button>
                </div>
                {n.image_url ? (
                  <img src={n.image_url} alt="" className="h-12 w-16 object-cover rounded-lg bg-muted shrink-0" />
                ) : (
                  <div className="h-12 w-16 rounded-lg bg-muted shrink-0 inline-flex items-center justify-center">
                    <Newspaper className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground truncate">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.published_at).toLocaleDateString("pt-BR")}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Switch checked={n.active} onCheckedChange={v => update.mutate({ id: n.id, patch: { active: v } })} />
                    <span className="text-xs text-muted-foreground w-14">{n.active ? "Ativo" : "Oculto"}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { if (confirm("Remover esta notícia?")) remove.mutate(n.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
