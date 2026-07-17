import { useState } from "react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Video, Film, Clapperboard, Camera, Image as ImageIcon, ImagePlus,
  Play, Mic, Music, Headphones, PenTool, Palette, Brush, Type,
  FileText, FileEdit, ClipboardList, Newspaper, BookOpen, Megaphone,
  Layout, LayoutGrid, MonitorPlay, Smartphone, Share2, AtSign, Hash,
  Instagram, Youtube, Facebook, Linkedin, Twitter, Globe,
  Mail, MessageSquare, Send, Rocket, TrendingUp, LineChart, BarChart3,
  Target, Flag, Lightbulb, Sparkles, Star, Heart, ThumbsUp,
  Package, Box, Truck, ShoppingBag, Tag, Gift,
  Calendar, Clock, CheckSquare, ListChecks, Kanban,
  Users, User, Handshake, Briefcase, Building2,
  Code, Terminal, Bug, Settings, Wrench, Zap,
  Layers, Component, Puzzle, GitBranch, Search, Eye,
} from "lucide-react";

export const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Video, Film, Clapperboard, Camera, Image: ImageIcon, ImagePlus,
  Play, Mic, Music, Headphones, PenTool, Palette, Brush, Type,
  FileText, FileEdit, ClipboardList, Newspaper, BookOpen, Megaphone,
  Layout, LayoutGrid, MonitorPlay, Smartphone, Share2, AtSign, Hash,
  Instagram, Youtube, Facebook, Linkedin, Twitter, Globe,
  Mail, MessageSquare, Send, Rocket, TrendingUp, LineChart, BarChart3,
  Target, Flag, Lightbulb, Sparkles, Star, Heart, ThumbsUp,
  Package, Box, Truck, ShoppingBag, Tag, Gift,
  Calendar, Clock, CheckSquare, ListChecks, Kanban,
  Users, User, Handshake, Briefcase, Building2,
  Code, Terminal, Bug, Settings, Wrench, Zap,
  Layers, Component, Puzzle, GitBranch, Search, Eye,
};

export function TaskTypeIcon({
  name, className, color,
}: { name?: string | null; className?: string; color?: string }) {
  if (!name) return null;
  const Cmp = ICONS[name];
  if (!Cmp) return null;
  return <Cmp className={className} {...(color ? { style: { color } as any } : {})} />;
}

export function IconPicker({
  value, onChange, color,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  color?: string;
}) {
  const [q, setQ] = useState("");
  const names = Object.keys(ICONS).filter(n => n.toLowerCase().includes(q.toLowerCase()));
  const Selected = value ? ICONS[value] : null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-9 w-9 rounded-lg border flex items-center justify-center hover:bg-muted transition-colors"
          title="Escolher ícone"
        >
          {Selected ? (
            <Selected className="h-4 w-4" {...(color ? { style: { color } as any } : {})} />
          ) : (
            <span className="text-[10px] text-muted-foreground">Ícone</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2 rounded-xl">
        <Input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar ícone..."
          className="h-8 rounded-lg mb-2"
        />
        <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto">
          <button
            onClick={() => onChange(null)}
            className={cn(
              "h-8 w-8 rounded-md flex items-center justify-center text-[9px] text-muted-foreground hover:bg-muted",
              !value && "bg-muted"
            )}
          >
            —
          </button>
          {names.map(n => {
            const Cmp = ICONS[n];
            const active = value === n;
            return (
              <button
                key={n}
                onClick={() => onChange(n)}
                title={n}
                className={cn(
                  "h-8 w-8 rounded-md flex items-center justify-center hover:bg-muted transition-colors",
                  active && "bg-muted ring-2 ring-foreground/20"
                )}
              >
                <Cmp className="h-4 w-4" {...(color ? { style: { color } as any } : {})} />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
