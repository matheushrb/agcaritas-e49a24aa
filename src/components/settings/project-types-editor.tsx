import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, GripVertical, ListPlus, Clock, CalendarDays, Layers, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconPicker, ColorPicker, IconPreview } from "./icon-color-pickers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

type BaseTask = {
  task_type_id: string;
};

type Row = {
  id: string;
  organization_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  description: string | null;
  sort_order: number;
  active: boolean;
  base_tasks: BaseTask[];
  avg_task_hours: number | null;
  avg_duration_days: number | null;
  platform_ids: string[];
};

export function ProjectTypesEditor() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Partial<Row> | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["project_types"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_types").select("*").order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        base_tasks: (r.base_tasks ?? []).filter((b: any) => b?.task_type_id),
        platform_ids: r.platform_ids ?? [],
      })) as Row[];
    },
  });

  const { data: taskTypes = [] } = useQuery({
    queryKey: ["task_types_lite"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("task_types").select("id,name,color,icon,default_price,default_billing_model").eq("active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: platforms = [] } = useQuery({
    queryKey: ["platforms_lite"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("platforms").select("id,name,color,icon").eq("active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (row: Partial<Row>) => {
      const payload: any = {
        name: row.name,
        color: row.color,
        icon: row.icon,
        description: row.description ?? null,
        active: row.active ?? true,
        base_tasks: (row.base_tasks ?? []).filter(b => b?.task_type_id),
        avg_task_hours: row.avg_task_hours ?? null,
        avg_duration_days: row.avg_duration_days ?? null,
        platform_ids: row.platform_ids ?? [],
      };
      if (row.id) {
        const { error } = await (supabase as any).from("project_types").update(payload).eq("id", row.id);
        if (error) throw error;
      } else {
        const { data: p } = await supabase.from("profiles").select("organization_id").maybeSingle();
        if (!p?.organization_id) throw new Error("Organização não encontrada");
        const { error } = await (supabase as any).from("project_types").insert({
          ...payload,
          organization_id: p.organization_id,
          sort_order: rows.length,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_types"] });
      setDraft(null);
      toast.success("Tipo de projeto salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("project_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_types"] });
      setDraft(null);
      toast.success("Removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const editing = draft;

  function updateBaseTask(idx: number, patch: Partial<BaseTask>) {
    if (!editing) return;
    const list = [...(editing.base_tasks ?? [])];
    list[idx] = { ...list[idx], ...patch };
    setDraft({ ...editing, base_tasks: list });
  }
  function addBaseTask() {
    if (!editing) return;
    const firstAvail = taskTypes.find((tt: any) => !(editing.base_tasks ?? []).some(b => b.task_type_id === tt.id));
    if (!firstAvail) { toast.info("Cadastre mais tipos de tarefa primeiro."); return; }
    setDraft({ ...editing, base_tasks: [...(editing.base_tasks ?? []), { task_type_id: firstAvail.id }] });
  }
  function removeBaseTask(idx: number) {
    if (!editing) return;
    const list = [...(editing.base_tasks ?? [])];
    list.splice(idx, 1);
    setDraft({ ...editing, base_tasks: list });
  }

  const baseCount = (editing?.base_tasks ?? []).length;
  const togglePlatform = (id: string) => {
    if (!editing) return;
    const cur = editing.platform_ids ?? [];
    setDraft({ ...editing, platform_ids: cur.includes(id) ? cur.filter(p => p !== id) : [...cur, id] });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-4">
      <Card className="p-4 rounded-2xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">Tipos de Projeto</h3>
            <p className="text-xs text-muted-foreground">
              Modelos usados ao criar um projeto — cor, ícone, tarefas base e tempo médio.
            </p>
          </div>
          <Button size="sm" className="rounded-full gap-1"
            onClick={() => setDraft({
              name: "", color: "#3B82F6", icon: "FolderKanban", active: true,
              base_tasks: [], avg_task_hours: null, avg_duration_days: null, description: "",
              platform_ids: [],
            })}>
            <Plus className="h-4 w-4" /> Novo tipo
          </Button>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Nenhum tipo cadastrado.</div>
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
                  <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>{(r.base_tasks?.length ?? 0)} tarefas base</span>
                    {r.avg_task_hours != null && <span>{r.avg_task_hours}h por tarefa</span>}
                    {r.avg_duration_days != null && <span>{r.avg_duration_days}d duração</span>}
                  </div>
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
            Selecione um tipo para editar ou clique em <b>Novo tipo</b>.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <IconPreview name={editing.icon ?? null} color={editing.color ?? null} size={44} />
              <div>
                <h3 className="font-semibold leading-tight">{editing.id ? "Editar tipo" : "Novo tipo"}</h3>
                <p className="text-[11px] text-muted-foreground">Aparência e comportamento padrão do projeto.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input value={editing.name ?? ""} placeholder="Ex.: Social Media Mensal"
                onChange={e => setDraft({ ...editing, name: e.target.value })} />
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Cor</Label>
                <ColorPicker value={editing.color ?? "#3B82F6"} onChange={c => setDraft({ ...editing, color: c })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ícone</Label>
                <IconPicker value={editing.icon ?? null} color={editing.color ?? "#3B82F6"}
                  onChange={n => setDraft({ ...editing, icon: n })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea rows={2} value={editing.description ?? ""} placeholder="Quando usar este tipo…"
                onChange={e => setDraft({ ...editing, description: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Tempo médio por tarefa</Label>
                <div className="flex items-center gap-1">
                  <Input type="number" min={0} step={0.5} value={editing.avg_task_hours ?? ""}
                    onChange={e => setDraft({ ...editing, avg_task_hours: e.target.value === "" ? null : Number(e.target.value) })} />
                  <span className="text-xs text-muted-foreground">h</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Duração média</Label>
                <div className="flex items-center gap-1">
                  <Input type="number" min={0} step={1} value={editing.avg_duration_days ?? ""}
                    onChange={e => setDraft({ ...editing, avg_duration_days: e.target.value === "" ? null : Number(e.target.value) })} />
                  <span className="text-xs text-muted-foreground">dias</span>
                </div>
              </div>
            </div>

            {/* Plataformas */}
            <div className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <Layers className="h-4 w-4" /> Plataformas
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Onde este tipo de projeto costuma atuar (pré-seleciona no wizard).
                  </p>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline" className="rounded-full gap-1">
                      <Plus className="h-3.5 w-3.5" /> Selecionar
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-1 max-h-72 overflow-auto">
                    {platforms.length === 0 ? (
                      <div className="text-xs text-muted-foreground p-3 text-center">
                        Nenhuma plataforma cadastrada.
                      </div>
                    ) : platforms.map((p: any) => {
                      const on = (editing.platform_ids ?? []).includes(p.id);
                      return (
                        <button key={p.id} onClick={() => togglePlatform(p.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted text-left text-sm">
                          <IconPreview name={p.icon} color={p.color} iconUrl={p.icon_url} size={22} />
                          <span className="flex-1 truncate">{p.name}</span>
                          {on && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              </div>
              {(editing.platform_ids ?? []).length === 0 ? (
                <div className="text-xs text-muted-foreground py-2 text-center">
                  Nenhuma plataforma selecionada.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {(editing.platform_ids ?? []).map(pid => {
                    const p = platforms.find((x: any) => x.id === pid);
                    if (!p) return null;
                    return (
                      <Badge key={pid} variant="secondary" className="gap-1 pl-1 pr-1.5 py-0.5">
                        <IconPreview name={p.icon} color={p.color} size={16} />
                        <span className="text-[11px]">{p.name}</span>
                        <button onClick={() => togglePlatform(pid)} className="ml-0.5 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Tarefas base */}
            <div className="rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <ListPlus className="h-4 w-4" /> Tarefas base
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Cada linha é um <b>tipo de tarefa</b> — ao criar o projeto, as tarefas são geradas
                    herdando as etapas, checklist e preço sugerido do tipo escolhido.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="rounded-full gap-1" onClick={addBaseTask}>
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>

              {(editing.base_tasks ?? []).length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  Nenhuma tarefa base — clique em Adicionar.
                </div>
              ) : (
                <div className="space-y-2">
                  {(editing.base_tasks ?? []).map((t, idx) => {
                    const tt = taskTypes.find((x: any) => x.id === t.task_type_id);
                    return (
                      <div key={idx} className="grid grid-cols-[24px_1fr_auto] gap-2 items-center">
                        <IconPreview name={tt?.icon ?? null} color={tt?.color ?? null} size={22} />
                        <Select
                          value={t.task_type_id}
                          onValueChange={v => updateBaseTask(idx, { task_type_id: v })}
                        >
                          <SelectTrigger className="h-8"><SelectValue placeholder="Tipo de tarefa" /></SelectTrigger>
                          <SelectContent>
                            {taskTypes.map((x: any) => (
                              <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                          onClick={() => removeBaseTask(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  <div className="text-[11px] text-muted-foreground text-right pt-1">
                    {baseCount} modelo{baseCount === 1 ? "" : "s"} disponíve{baseCount === 1 ? "l" : "is"} ao criar tarefas
                  </div>
                </div>
              )}
            </div>


            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div className="text-xs">Ativo</div>
              <Switch checked={editing.active ?? true} onCheckedChange={c => setDraft({ ...editing, active: c })} />
            </div>

            <div className="flex items-center justify-between pt-1">
              {editing.id ? (
                <Button variant="ghost" size="sm" className="text-destructive"
                  onClick={() => { if (confirm("Remover este tipo?")) remove.mutate(editing.id!); }}>
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
