import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export async function resolveAvatarUrl(value: string | null | undefined) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(value, 60 * 60);
  return data?.signedUrl ?? null;
}

export function ProfileTab() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", display_name: "", role_title: "" });

  const { data: me } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, role_title, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      const preview = await resolveAvatarUrl((data as { avatar_url?: string | null } | null)?.avatar_url);
      return { userId: user.id, email: user.email ?? "", profile: (data ?? null) as Record<string, string | null> | null, preview };
    },
  });

  useEffect(() => {
    if (!me?.profile) return;
    setForm({
      full_name: me.profile.full_name ?? "",
      display_name: me.profile.display_name ?? "",
      role_title: me.profile.role_title ?? "",
    });
  }, [me?.profile]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-profile"] });
    qc.invalidateQueries({ queryKey: ["topbar-profile"] });
  };

  const onPick = async (file: File | undefined) => {
    if (!file || !me?.userId) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecione um arquivo de imagem.");
    if (file.size > 5 * 1024 * 1024) return toast.error("A imagem deve ter no máximo 5 MB.");
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${me.userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", me.userId);
      if (error) throw error;
      toast.success("Foto atualizada.");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = async () => {
    if (!me?.userId) return;
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", me.userId);
    toast.success("Foto removida.");
    refresh();
  };

  const save = async () => {
    if (!me?.userId) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", me.userId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil salvo.");
    refresh();
  };

  const initials = (form.display_name || form.full_name || me?.email || "C")
    .split(" ").filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join("");

  return (
    <Card className="p-5 space-y-5">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="h-20 w-20 overflow-hidden rounded-full bg-muted grid place-items-center text-xl font-semibold text-muted-foreground">
            {me?.preview
              ? <img src={me.preview} alt="Foto do perfil" className="h-full w-full object-cover" />
              : initials}
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center shadow"
            title="Trocar foto"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Foto do perfil</p>
          <p className="text-xs text-muted-foreground">PNG ou JPG, até 5 MB. Aparece na barra superior e nos comentários.</p>
          {me?.preview && (
            <Button variant="ghost" size="sm" className="gap-1 px-0 text-xs" onClick={removePhoto}>
              <Trash2 className="h-3.5 w-3.5" /> Remover foto
            </Button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => onPick(e.target.files?.[0])} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Nome completo</Label>
          <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Como quer ser chamado</Label>
          <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>Cargo / função</Label>
          <Input value={form.role_title} onChange={e => setForm(f => ({ ...f, role_title: e.target.value }))} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>E-mail</Label>
          <Input value={me?.email ?? ""} readOnly disabled />
        </div>
      </div>

      <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar perfil"}</Button>
    </Card>
  );
}
