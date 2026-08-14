import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Megaphone, Plus, Trash2, Copy, Pin, PinOff, ShieldAlert, Palette, Info, Sparkles } from "lucide-react";

export type ProjectNotice = {
  id: string;
  title: string;
  text: string;
  kind: "legal" | "brand" | "info";
  pinned: boolean;
};

const KIND_META: Record<ProjectNotice["kind"], { label: string; icon: typeof Info }> = {
  legal: { label: "Obrigatório / legal", icon: ShieldAlert },
  brand: { label: "Marca / identidade", icon: Palette },
  info: { label: "Informativo", icon: Info },
};

const uid = () => Math.random().toString(36).slice(2, 10);

export const ELECTORAL_PRESETS: Omit<ProjectNotice, "id">[] = [
  { title: "Identificação do responsável", text: "Toda peça deve conter a identificação do candidato/partido responsável pela veiculação, conforme exigência da legislação eleitoral.", kind: "legal", pinned: true },
  { title: "Número e cargo", text: "Sempre exibir o número do candidato e o cargo disputado com legibilidade mínima definida no manual da campanha.", kind: "legal", pinned: true },
  { title: "CNPJ da campanha", text: "Incluir o CNPJ da campanha nas peças impressas e materiais de propaganda.", kind: "legal", pinned: true },
  { title: "Tiragem e gráfica (impressos)", text: "Impressos devem trazer CNPJ/CPF da gráfica, do contratante e a tiragem do material.", kind: "legal", pinned: false },
  { title: "Paleta e tipografia oficiais", text: "Usar exclusivamente as cores e fontes do manual da campanha. Não aplicar filtros ou variações de logo.", kind: "brand", pinned: false },
  { title: "Aprovação obrigatória", text: "Nenhuma peça vai ao ar sem aprovação do coordenador de campanha e do jurídico.", kind: "info", pinned: false },
];

export const GENERIC_PRESETS: Omit<ProjectNotice, "id">[] = [
  { title: "Assinatura da marca", text: "Toda peça deve conter a logo oficial na versão aprovada e área de respiro mínima.", kind: "brand", pinned: true },
  { title: "Redes e contato", text: "Incluir @perfil oficial e telefone/site de contato no rodapé das peças.", kind: "info", pinned: false },
  { title: "Revisão ortográfica", text: "Peça só é publicada após revisão de texto por outra pessoa.", kind: "info", pinned: false },
];

export function parseNotices(raw: unknown): ProjectNotice[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((n: any) => ({
      id: String(n?.id ?? uid()),
      title: String(n?.title ?? ""),
      text: String(n?.text ?? ""),
      kind: (["legal", "brand", "info"].includes(n?.kind) ? n.kind : "info") as ProjectNotice["kind"],
      pinned: !!n?.pinned,
    }))
    .filter(n => n.title || n.text);
}

/** Mural compacto exibido no topo do projeto. */
export function NoticeBoard({
  notices,
  onManage,
}: {
  notices: ProjectNotice[];
  onManage: () => void;
}) {
  const sorted = [...notices].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const copyAll = () => {
    navigator.clipboard?.writeText(sorted.map(n => `• ${n.title}: ${n.text}`).join("\n"));
    toast.success("Avisos copiados");
  };

  return (
    <div className="p2-mural">
      <div className="p2-mural-h">
        <span className="p2-mural-t"><Megaphone /> Mural de avisos — obrigatório nas peças</span>
        <div className="p2-mural-a">
          {sorted.length > 0 && (
            <button type="button" className="p2-btn" onClick={copyAll}><Copy /> Copiar</button>
          )}
          <button type="button" className="p2-btn" onClick={onManage}><Plus /> Gerenciar</button>
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="p2-mural-empty">
          Nenhum aviso cadastrado. Registre aqui o que precisa aparecer em toda peça criada neste projeto —
          CNPJ, número do candidato, assinatura da marca, disclaimers legais.
        </p>
      ) : (
        <ul className="p2-mural-list">
          {sorted.map(n => {
            const Icon = KIND_META[n.kind].icon;
            return (
              <li key={n.id} className={cn("p2-note", n.kind)}>
                <Icon className="ic" />
                <div className="tx">
                  <strong>{n.title}</strong>
                  <span>{n.text}</span>
                </div>
                {n.pinned && <Pin className="pin" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function NoticeBoardDialog({
  open,
  onOpenChange,
  notices,
  onSave,
  suggestElectoral,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  notices: ProjectNotice[];
  onSave: (n: ProjectNotice[]) => void;
  suggestElectoral?: boolean;
}) {
  const [items, setItems] = useState<ProjectNotice[]>(notices);
  useEffect(() => { if (open) setItems(notices); }, [open, notices]);

  const patch = (id: string, p: Partial<ProjectNotice>) =>
    setItems(prev => prev.map(n => (n.id === id ? { ...n, ...p } : n)));

  const addPreset = (presets: Omit<ProjectNotice, "id">[]) =>
    setItems(prev => [
      ...prev,
      ...presets
        .filter(p => !prev.some(n => n.title.toLowerCase() === p.title.toLowerCase()))
        .map(p => ({ ...p, id: uid() })),
    ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[820px] p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col rounded-2xl border-0 shadow-2xl [&>button.absolute]:text-primary-foreground [&>button.absolute]:hover:bg-primary-foreground/20 [&>button.absolute]:opacity-100">
        <div className="bg-primary text-primary-foreground px-7 py-6 flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary-foreground/15 inline-flex items-center justify-center shrink-0">
            <Megaphone className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] opacity-75 font-medium">Mural de avisos</div>
            <h2 className="text-2xl font-semibold leading-tight">Obrigatoriedades nas peças</h2>
            <p className="text-xs opacity-80 mt-1">
              Tudo o que estiver aqui aparece no topo do projeto e serve de checklist para a equipe de criação.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-4 bg-muted/30">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-full gap-1.5"
              onClick={() => setItems(prev => [...prev, { id: uid(), title: "", text: "", kind: "info", pinned: false }])}>
              <Plus className="h-3.5 w-3.5" /> Novo aviso
            </Button>
            <Button type="button" variant="outline" size="sm" className="rounded-full gap-1.5" onClick={() => addPreset(GENERIC_PRESETS)}>
              <Sparkles className="h-3.5 w-3.5" /> Modelo padrão
            </Button>
            <Button
              type="button"
              variant={suggestElectoral ? "default" : "outline"}
              size="sm"
              className="rounded-full gap-1.5"
              onClick={() => addPreset(ELECTORAL_PRESETS)}
            >
              <ShieldAlert className="h-3.5 w-3.5" /> Modelo campanha eleitoral
            </Button>
          </div>

          {items.length === 0 && (
            <div className="rounded-xl border border-dashed bg-background/60 p-8 text-center text-sm text-muted-foreground">
              Nenhum aviso ainda. Use um dos modelos acima ou crie o seu.
            </div>
          )}

          {items.map(n => (
            <div key={n.id} className="rounded-xl border bg-background p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={n.title}
                  placeholder="Título do aviso (ex.: CNPJ da campanha)"
                  onChange={e => patch(n.id, { title: e.target.value })}
                  className="flex-1"
                />
                <Select value={n.kind} onValueChange={(v: ProjectNotice["kind"]) => patch(n.id, { kind: v })}>
                  <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(KIND_META).map(([k, m]) => (
                      <SelectItem key={k} value={k}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="ghost" size="icon" aria-label={n.pinned ? "Desafixar" : "Fixar"}
                  onClick={() => patch(n.id, { pinned: !n.pinned })}>
                  {n.pinned ? <Pin className="h-4 w-4 text-primary" /> : <PinOff className="h-4 w-4" />}
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Remover aviso"
                  onClick={() => setItems(prev => prev.filter(x => x.id !== n.id))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <Textarea
                value={n.text}
                placeholder="Descreva exatamente o que precisa constar na peça."
                rows={2}
                onChange={e => patch(n.id, { text: e.target.value })}
              />
            </div>
          ))}
        </div>

        <div className="px-7 py-4 border-t bg-background flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => { onSave(items.filter(n => n.title || n.text)); onOpenChange(false); }}>
            Salvar avisos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
