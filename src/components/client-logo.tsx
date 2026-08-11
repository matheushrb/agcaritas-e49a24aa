import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const CLIENT_LOGO_BUCKET = "client-logos";

export async function resolveClientLogoUrl(value: string | null | undefined) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const { data } = await supabase.storage.from(CLIENT_LOGO_BUCKET).createSignedUrl(value, 60 * 60);
  return data?.signedUrl ?? null;
}

export function useClientLogoUrl(value: string | null | undefined) {
  const { data } = useQuery({
    queryKey: ["client-logo", value],
    enabled: !!value,
    staleTime: 30 * 60 * 1000,
    queryFn: () => resolveClientLogoUrl(value),
  });
  return data ?? null;
}

function initials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Avatar da empresa: mostra a logo quando existir, senão as iniciais. */
export function ClientLogo({
  value,
  name,
  size = 40,
  rounded = "rounded-xl",
  className,
}: {
  value?: string | null;
  name?: string | null;
  size?: number;
  rounded?: string;
  className?: string;
}) {
  const url = useClientLogoUrl(value);
  return (
    <div
      className={cn(
        "shrink-0 overflow-hidden border flex items-center justify-center",
        rounded,
        className,
      )}
      style={{
        width: size,
        height: size,
        background: "var(--surface-2, #f1f3f7)",
        borderColor: "var(--border, #e5e7eb)",
      }}
      title={name ?? undefined}
    >
      {url ? (
        <img src={url} alt={name ? `Logo ${name}` : "Logo da empresa"} className="h-full w-full object-contain" />
      ) : (
        <span className="font-semibold" style={{ fontSize: Math.max(10, size * 0.34), color: "var(--muted, #6b7280)" }}>
          {initials(name)}
        </span>
      )}
    </div>
  );
}

/** Campo de upload da logo (usa storage privado + URL assinada). */
export function ClientLogoPicker({
  value,
  onChange,
  name,
}: {
  value?: string | null;
  onChange: (path: string | null) => void;
  name?: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecione um arquivo de imagem.");
    if (file.size > 5 * 1024 * 1024) return toast.error("A imagem deve ter no máximo 5 MB.");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(CLIENT_LOGO_BUCKET).upload(path, file, { upsert: true });
      if (error) throw error;
      onChange(path);
      toast.success("Logo carregada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar a logo.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-3">
      <ClientLogo value={value} name={name} size={64} />
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            <span className="ml-1.5">{value ? "Trocar logo" : "Enviar logo"}</span>
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">PNG ou JPG, fundo transparente de preferência. Máx. 5 MB.</span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => pick(e.target.files?.[0])}
      />
    </div>
  );
}
