import { useState } from "react";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ArrowDown, ArrowUp, RotateCcw, Settings2 } from "lucide-react";
import {
  CATEGORIES, CATEGORY_ICON, WIDGETS, getWidget, getPresetForRole,
  type UserPref,
} from "@/lib/dashboard-widgets";

interface Props {
  value: UserPref[];
  onChange: (next: UserPref[]) => void;
  roleTitle: string | null | undefined;
}

export function DashboardPersonalize({ value, onChange, roleTitle }: Props) {
  const [open, setOpen] = useState(false);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...value];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const toggle = (id: string, enabled: boolean) => {
    onChange(value.map(p => (p.id === id ? { ...p, enabled } : p)));
  };

  const resetPreset = () => {
    onChange(getPresetForRole(roleTitle));
  };

  // Agrupa a visualização por categoria (mas guarda a ordem global no array `value`)
  const byCategory = CATEGORIES.map(cat => ({
    cat,
    items: value
      .map((p, idx) => ({ pref: p, idx, widget: getWidget(p.id) }))
      .filter(x => x.widget?.category === cat),
  })).filter(g => g.items.length > 0);

  const enabledCount = value.filter(p => p.enabled).length;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="cv-button cv-secondary" size="sm">
          <Settings2 className="h-4 w-4" /> Personalizar
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Personalizar dashboard</SheetTitle>
          <SheetDescription>
            Escolha o que aparece no seu painel e a ordem. {enabledCount} de {WIDGETS.length} widgets ativos.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={resetPreset} className="gap-2 text-xs">
            <RotateCcw className="h-3.5 w-3.5" /> Limpar widgets extras
          </Button>

        </div>

        <div className="mt-2 space-y-6">
          {byCategory.map(group => {
            const Icon = CATEGORY_ICON[group.cat];
            return (
              <div key={group.cat}>
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-2">
                  <Icon className="h-3.5 w-3.5" /> {group.cat}
                </div>
                <div className="space-y-2">
                  {group.items.map(({ pref, idx, widget }) => (
                    <div
                      key={pref.id}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{widget!.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{widget!.description}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          className="grid h-7 w-7 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-30"
                          onClick={() => move(idx, -1)}
                          disabled={idx === 0}
                          aria-label="Mover para cima"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="grid h-7 w-7 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-30"
                          onClick={() => move(idx, 1)}
                          disabled={idx === value.length - 1}
                          aria-label="Mover para baixo"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <Separator orientation="vertical" className="h-6 mx-1" />
                        <Switch
                          checked={pref.enabled}
                          onCheckedChange={(v) => toggle(pref.id, v)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
