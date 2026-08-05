import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, GripVertical, FileText, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import {
  FIELD_TYPE_OPTIONS, TEMPLATE_TYPE_LABEL, fetchBriefingTemplates, getOrgId, slugKey,
  type BriefingField, type BriefingSection, type BriefingTemplate, type BriefingTemplateType,
} from "@/lib/briefing";

const KEY = ["briefing_templates"] as const;

export function BriefingTemplatesEditor() {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useQuery({ queryKey: KEY, queryFn: fetchBriefingTemplates });
  const [editing, setEditing] = useState<BriefingTemplate | null>(null);
  const [open, setOpen] = useState(false);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("briefing_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Modelo excluído"); qc.invalidateQueries({ queryKey: KEY }); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Modelos de briefing</h2>
          <p className="text-sm text-muted-foreground">
            Monte formulários de briefing e ficha técnica com seções e campos próprios. Eles aparecem nas tarefas, projetos e leads.
          </p>
        </div>
        <Button className="gap-2 rounded-full" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Novo modelo
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum modelo criado ainda. Comece com um briefing de conteúdo ou uma ficha técnica de transmissão.
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map(t => {
            const fields = t.sections.reduce((a, s) => a + (s.fields?.length ?? 0), 0);
            const Icon = t.template_type === "ficha_tecnica" ? ClipboardList : FileText;
            return (
              <Card key={t.id} className="p-4 flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{t.name}</p>
                    <Badge variant="secondary" className="text-[10px]">{TEMPLATE_TYPE_LABEL[t.template_type]}</Badge>
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t.sections.length} seção(ões) · {fields} campo(s)
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove.mutate(t.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <TemplateDialog open={open} onOpenChange={setOpen} template={editing} />
    </div>
  );
}

function TemplateDialog({
  open, onOpenChange, template,
}: { open: boolean; onOpenChange: (o: boolean) => void; template: BriefingTemplate | null }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<BriefingTemplateType>("briefing");
  const [sections, setSections] = useState<BriefingSection[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(template?.name ?? "");
    setDescription(template?.description ?? "");
    setType(template?.template_type ?? "briefing");
    setSections(template?.sections ? JSON.parse(JSON.stringify(template.sections)) : []);
  }, [open, template]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        template_type: type,
        sections: JSON.parse(JSON.stringify(sections)),
      };
      if (template) {
        const { error } = await supabase.from("briefing_templates").update(payload as any).eq("id", template.id);
        if (error) throw error;
      } else {
        const organization_id = await getOrgId();
        const { error } = await supabase.from("briefing_templates").insert({ ...payload, organization_id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(template ? "Modelo atualizado" : "Modelo criado");
      qc.invalidateQueries({ queryKey: KEY });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const patchSection = (i: number, patch: Partial<BriefingSection>) =>
    setSections(p => p.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const patchField = (si: number, fi: number, patch: Partial<BriefingField>) =>
    setSections(p => p.map((s, idx) => idx === si
      ? { ...s, fields: s.fields.map((f, j) => (j === fi ? { ...f, ...patch } : f)) }
      : s));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Editar modelo" : "Novo modelo"}</DialogTitle>
          <DialogDescription>
            Cada seção agrupa campos. O formulário é renderizado em 3 colunas — use a largura do campo para ocupar mais espaço.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Label className="text-xs">Nome *</Label>
            <Input className="mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Briefing de Aula Online" />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={type} onValueChange={v => setType(v as BriefingTemplateType)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="briefing">Briefing</SelectItem>
                <SelectItem value="ficha_tecnica">Ficha Técnica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-3">
            <Label className="text-xs">Descrição</Label>
            <Input className="mt-1" value={description} onChange={e => setDescription(e.target.value)} placeholder="Para que serve este modelo" />
          </div>
        </div>

        <div className="space-y-3">
          {sections.map((section, si) => (
            <Card key={si} className="p-3 space-y-3">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-8 w-16 text-center"
                  value={section.emoji ?? ""}
                  onChange={e => patchSection(si, { emoji: e.target.value })}
                  placeholder="📋"
                />
                <Input
                  className="h-8 flex-1"
                  value={section.title}
                  onChange={e => patchSection(si, { title: e.target.value })}
                  placeholder="Título da seção"
                />
                <Button size="icon" variant="ghost" onClick={() => setSections(p => p.filter((_, i) => i !== si))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="space-y-2">
                {section.fields.map((field, fi) => (
                  <div key={fi} className="grid grid-cols-12 gap-2 items-center rounded-xl border border-border/70 p-2">
                    <Input
                      className="col-span-4 h-8"
                      value={field.label}
                      placeholder="Rótulo do campo"
                      onChange={e => patchField(si, fi, { label: e.target.value, key: field.key || slugKey(e.target.value) })}
                    />
                    <Select value={field.type} onValueChange={v => patchField(si, fi, { type: v as BriefingField["type"] })}>
                      <SelectTrigger className="col-span-3 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select
                      value={String(field.colSpan ?? 1)}
                      onValueChange={v => patchField(si, fi, { colSpan: Number(v) as 1 | 2 | 3 })}
                    >
                      <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 coluna</SelectItem>
                        <SelectItem value="2">2 colunas</SelectItem>
                        <SelectItem value="3">Largura total</SelectItem>
                      </SelectContent>
                    </Select>
                    {field.type === "select" ? (
                      <Input
                        className="col-span-2 h-8 text-xs"
                        placeholder="opções, separadas, por vírgula"
                        value={(field.options ?? []).map(o => o.label).join(", ")}
                        onChange={e => patchField(si, fi, {
                          options: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                            .map(l => ({ value: slugKey(l), label: l })),
                        })}
                      />
                    ) : (
                      <Input
                        className="col-span-2 h-8 text-xs"
                        placeholder="Placeholder"
                        value={field.placeholder ?? ""}
                        onChange={e => patchField(si, fi, { placeholder: e.target.value })}
                      />
                    )}
                    <Button
                      size="icon" variant="ghost" className="col-span-1"
                      onClick={() => patchSection(si, { fields: section.fields.filter((_, j) => j !== fi) })}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm" variant="outline" className="rounded-full gap-1"
                  onClick={() => patchSection(si, {
                    fields: [...section.fields, { key: slugKey(`campo ${section.fields.length + 1}`), label: "", type: "text", colSpan: 1 }],
                  })}
                >
                  <Plus className="h-3.5 w-3.5" /> Campo
                </Button>
              </div>
            </Card>
          ))}

          <Button
            variant="outline" className="rounded-full gap-1"
            onClick={() => setSections(p => [...p, { title: "Nova seção", emoji: "📋", fields: [] }])}
          >
            <Plus className="h-4 w-4" /> Seção
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={!name.trim() || save.isPending}
          >
            {save.isPending ? "Salvando…" : template ? "Atualizar" : "Criar modelo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
