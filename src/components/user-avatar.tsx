import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveAvatarUrl } from "@/components/settings/profile-tab";
import { cn } from "@/lib/utils";

export type DirectoryPerson = {
  id: string;
  userId: string | null;
  name: string;
  avatar: string | null;
};

export function personInitials(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map(p => p[0]!.toUpperCase()).join("") || "?";
}

export function personColor(name?: string | null) {
  const palette = ["#2F6BEF", "#0E9F6E", "#E79015", "#7E57D8", "#14A9A0", "#E4473A", "#3659E3"];
  const s = (name ?? "?").toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
  return palette[h % palette.length]!;
}

/**
 * Diretório único de pessoas (perfis + equipe do RH) com as fotos já
 * resolvidas em URL assinada. Serve para qualquer lugar do sistema que
 * precise mostrar a foto de quem está marcado num projeto ou tarefa.
 */
export function usePeopleDirectory() {
  return useQuery({
    queryKey: ["people-directory"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<{ byKey: Record<string, DirectoryPerson>; byName: Record<string, DirectoryPerson> }> => {
      const [profilesRes, membersRes] = await Promise.all([
        supabase.from("profiles").select("id,full_name,display_name,avatar_url"),
        supabase.from("team_members").select("id,user_id,name,avatar_url"),
      ]);

      const raw: DirectoryPerson[] = [];
      for (const p of (profilesRes.data ?? []) as any[]) {
        raw.push({
          id: p.id,
          userId: p.id,
          name: (p.display_name || p.full_name || "").trim(),
          avatar: p.avatar_url ?? null,
        });
      }
      for (const m of (membersRes.data ?? []) as any[]) {
        raw.push({ id: m.id, userId: m.user_id ?? null, name: (m.name ?? "").trim(), avatar: m.avatar_url ?? null });
      }

      const resolved = await Promise.all(
        raw.map(async p => ({ ...p, avatar: await resolveAvatarUrl(p.avatar).catch(() => null) })),
      );

      const byKey: Record<string, DirectoryPerson> = {};
      const byName: Record<string, DirectoryPerson> = {};
      for (const p of resolved) {
        const prev = byKey[p.id];
        if (!prev || (!prev.avatar && p.avatar)) byKey[p.id] = p;
        if (p.userId) {
          const prevU = byKey[p.userId];
          if (!prevU || (!prevU.avatar && p.avatar)) byKey[p.userId] = p;
        }
        if (p.name) {
          const key = p.name.toLowerCase();
          const prevN = byName[key];
          if (!prevN || (!prevN.avatar && p.avatar)) byName[key] = p;
        }
      }
      return { byKey, byName };
    },
  });
}

/** Foto (ou iniciais) de uma pessoa, resolvida por id de usuário/membro ou pelo nome. */
export function UserAvatar({
  userId,
  name,
  size = 28,
  className,
  style,
  title,
}: {
  userId?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  const { data } = usePeopleDirectory();
  const person =
    (userId ? data?.byKey[userId] : undefined) ??
    (name ? data?.byName[name.trim().toLowerCase()] : undefined);
  const label = (person?.name || name || "").trim();
  const url = person?.avatar ?? null;

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", className)}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        background: url ? "var(--surface-2, #f1f3f7)" : personColor(label),
        color: "#fff",
        fontSize: Math.max(9, Math.round(size * 0.38)),
        fontWeight: 700,
        lineHeight: 1,
        ...style,
      }}
      title={title ?? label ?? undefined}
    >
      {url ? (
        <img src={url} alt={label || "Foto"} className="h-full w-full object-cover" />
      ) : (
        personInitials(label)
      )}
    </span>
  );
}
