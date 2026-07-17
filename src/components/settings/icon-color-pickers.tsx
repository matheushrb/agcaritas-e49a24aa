import { useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/** Curated set of outline/2D Lucide icons useful for project & task types. */
export const CURATED_ICONS = [
  // Projetos / trabalho
  "Folder", "FolderKanban", "FolderOpen", "Briefcase", "Building2", "Layers", "LayoutGrid",
  "Package", "Boxes", "Box", "Kanban", "ClipboardList", "FileText", "Files", "BookOpen",
  // Design / criativo
  "Palette", "Brush", "PenTool", "Feather", "Wand2", "Sparkles", "Camera", "Image", "Film",
  "Video", "Music", "Mic", "Aperture", "Scissors", "Type", "Shapes",
  // Marketing / mídia
  "Megaphone", "Target", "TrendingUp", "BarChart3", "LineChart", "PieChart", "Globe", "Rocket",
  "Send", "Mail", "MessageCircle", "MessageSquare", "Radio", "Rss", "Speaker", "Bell",
  // Redes sociais / plataformas
  "Instagram", "Facebook", "Twitter", "Youtube", "Linkedin", "Twitch", "Github", "Slack",
  "Chrome", "Figma",
  // Dev / técnico
  "Code2", "Terminal", "Cpu", "Database", "Cloud", "Server", "Wrench", "Settings", "Cog",
  "Plug", "Zap", "Bot",
  // Comércio / financeiro
  "ShoppingCart", "ShoppingBag", "Store", "DollarSign", "Banknote", "CreditCard", "Receipt",
  "Wallet", "Coins", "Percent", "Tag", "Ticket",
  // Pessoas / times
  "Users", "User", "UserCog", "UserPlus", "HeartHandshake", "Handshake",
  // Genéricos
  "Star", "Heart", "Flag", "Bookmark", "Award", "Trophy", "Crown", "Gem", "Gift",
  "Lightbulb", "Compass", "Map", "MapPin", "Calendar", "Clock", "CheckCircle2", "Circle",
  "Home", "Coffee", "Leaf", "Flame", "Sun", "Moon",
];

export const CURATED_COLORS = [
  "#3B82F6", "#2563EB", "#1E40AF", "#0EA5E9", "#06B6D4", "#0891B2",
  "#10B981", "#059669", "#22C55E", "#84CC16", "#EAB308", "#F59E0B",
  "#F97316", "#EF4444", "#DC2626", "#EC4899", "#D946EF", "#A855F7",
  "#8B5CF6", "#6366F1", "#64748B", "#334155", "#0F172A", "#111827",
];

export function ColorDot({
  color,
  size = 28,
  className,
}: { color: string | null | undefined; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-block rounded-full border border-border/60 shadow-sm shrink-0", className)}
      style={{ width: size, height: size, backgroundColor: color ?? "#3B82F6" }}
    />
  );
}

export function ColorPicker({
  value,
  onChange,
}: { value: string | null; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex items-center gap-2 rounded-full border border-border px-2 py-1 hover:bg-muted/60 transition"
          aria-label="Escolher cor"
        >
          <ColorDot color={value} />
          <span className="text-xs text-muted-foreground pr-1">{value ?? "#3B82F6"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="text-xs font-medium mb-2">Escolha uma cor</div>
        <div className="grid grid-cols-8 gap-2 mb-3">
          {CURATED_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); }}
              className={cn(
                "h-7 w-7 rounded-full border transition hover:scale-110",
                value === c ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-transparent" : "border-border/60",
              )}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value ?? "#3B82F6"}
            onChange={e => onChange(e.target.value)}
            className="h-8 w-10 rounded-md border border-border cursor-pointer bg-transparent"
          />
          <Input
            value={value ?? "#3B82F6"}
            onChange={e => onChange(e.target.value)}
            className="h-8"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function IconPreview({
  name, color, size = 32,
}: { name: string | null | undefined; color: string | null | undefined; size?: number }) {
  const Comp = (name && (Icons as any)[name]) || Icons.Circle;
  return (
    <span
      className="grid place-items-center rounded-full shrink-0 border border-border/40"
      style={{ width: size, height: size, backgroundColor: (color ?? "#3B82F6") + "1F", color: color ?? "#3B82F6" }}
    >
      <Comp className="h-[55%] w-[55%]" strokeWidth={1.75} />
    </span>
  );
}

export function IconPicker({
  value, color, onChange,
}: { value: string | null; color: string | null; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return CURATED_ICONS;
    return CURATED_ICONS.filter(n => n.toLowerCase().includes(term));
  }, [q]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border px-2 py-1 hover:bg-muted/60 transition"
          aria-label="Escolher ícone"
        >
          <IconPreview name={value} color={color} size={28} />
          <span className="text-xs text-muted-foreground pr-1">{value ?? "Ícone"}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="text-xs font-medium mb-2">Escolha um ícone</div>
        <Input placeholder="Buscar…" value={q} onChange={e => setQ(e.target.value)} className="h-8 mb-2" />
        <ScrollArea className="h-64 pr-2">
          <div className="grid grid-cols-6 gap-1.5">
            {filtered.map(n => {
              const Comp = (Icons as any)[n] || Icons.Circle;
              const active = value === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => { onChange(n); setOpen(false); }}
                  title={n}
                  className={cn(
                    "aspect-square rounded-lg grid place-items-center border transition",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent hover:bg-muted text-foreground/70",
                  )}
                >
                  <Comp className="h-4 w-4" strokeWidth={1.75} />
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-6 text-xs text-muted-foreground py-6 text-center">Nenhum ícone encontrado.</div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
