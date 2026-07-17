import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical } from "lucide-react";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  organization_id: string;
  name: string;
  slug: string | null;
  color: string | null;
  icon: string | null;
  category?: string | null;
  description?: string | null;
  sort_order: number;
  active: boolean;
};

function IconPreview({ name, color }: { name: string | null; color: string | null }) {
  const Comp = (name && (Icons as any)[name]) || Icons.Circle;
  return (
    <div
      className="grid h-8 w-8 place-items-center rounded-lg shrink-0"
      style={{ backgroundColor: (color ?? "#3B82F6") + "22", color: color ?? "#3B82F6" }}
    >
      <Comp className="h-4 w-4" />
    </div>
  );
}

export function CatalogEditor({
  table,
  title,
  hint,
  showCategory = false,
}: {
  table: "project_types" | "platforms";
  title: string;
  hint: string;
  showCategory?: boolean;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<Row> | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [table],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(table)
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (row: Partial<Row>) => {
      if (row.id) {
        const { error } = await (supabase as any).from(table).update({
          name: row.name, color: row.color, icon: row.icon,
          category: row.category, active: row.active,
          sort_order: row.sort_order,
        }).eq("id", row.id);
        if (error) throw error;
      } else {
        const { data: p } = await supabase.from("profiles").select("organization_id").maybeSingle();
        if (!p?.organization_id) throw new Error("Organização não encontrada");
        const { error } = await (supabase as any).from(table).insert({
          organization_id: p.organization_id,
          name: row.name,
          color: row.color ?? "#3B82F6",
          icon: row.icon ?? (table === "platforms" ? "Globe" : "Folder"),
          category: row.category ?? null,
          sort_order: rows.length,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      setDraft(null);
      toast.success("Salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success("Removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editing = draft;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      <Card className="p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          <Button size="sm" className="rounded-full gap-1"
            onClick={() => setDraft({ name: "", color: "#3B82F6", icon: table === "platforms" ? "Globe" : "Folder", active: true })}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Nenhum item cadastrado.</div>
        ) : (
          <div className="space-y-1">
            {rows.map(r => (
              <button
                key={r.id}
                onClick={() => setDraft(r)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left border border-transparent hover:bg-muted/60 transition",
                  editing?.id === r.id && "border-primary bg-primary/5",
                )}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <IconPreview name={r.icon} color={r.color} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  {r.category && <div className="text-[11px] text-muted-foreground">{r.category}</div>}
                </div>
                {!r.active && <span className="text-[10px] uppercase text-muted-foreground">Inativo</span>}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 rounded-2xl h-fit">
        {!editing ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            Selecione um item para editar ou clique em <b>Novo</b>.
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="font-semibold">{editing.id ? "Editar" : "Novo item"}</h3>
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input value={editing.name ?? ""} onChange={e => setDraft({ ...editing, name: e.target.value })} />
            </div>
            {showCategory && (
              <div className="space-y-1.5">
                <Label className="text-xs">Categoria</Label>
                <Input value={editing.category ?? ""} placeholder="Ex.: Rede social, Mídia paga…"
                  onChange={e => setDraft({ ...editing, category: e.target.value })} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cor</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editing.color ?? "#3B82F6"}
                    onChange={e => setDraft({ ...editing, color: e.target.value })}
                    className="h-9 w-12 rounded-md border border-border bg-transparent cursor-pointer" />
                  <Input value={editing.color ?? "#3B82F6"} onChange={e => setDraft({ ...editing, color: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ícone (Lucide)</Label>
                <Input value={editing.icon ?? ""} placeholder="Instagram, Target, Globe…"
                  onChange={e => setDraft({ ...editing, icon: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div className="text-xs">Ativo</div>
              <Switch checked={editing.active ?? true} onCheckedChange={c => setDraft({ ...editing, active: c })} />
            </div>

            <div className="flex items-center justify-between pt-2">
              {editing.id ? (
                <Button variant="ghost" size="sm" className="text-destructive"
                  onClick={() => { if (confirm("Remover este item?")) remove.mutate(editing.id!); }}>
                  <Trash2 className="h-4 w-4 mr-1" /> Remover
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Cancelar</Button>
                <Button size="sm" disabled={upsert.isPending || !editing.name?.trim()}
                  onClick={() => upsert.mutate(editing)}>Salvar</Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
