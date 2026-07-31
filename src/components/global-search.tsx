import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, CheckSquare, Building2, FileText, Search } from "lucide-react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";

type Hit = { id: string; label: string; to: string };

/** Busca global real (⌘K) em tarefas, projetos, clientes e propostas. */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = term.trim();
  const { data, isFetching } = useQuery({
    queryKey: ["global-search", q],
    enabled: open && q.length >= 2,
    queryFn: async () => {
      const like = `%${q}%`;
      const [tasks, projects, clients, proposals] = await Promise.all([
        supabase.from("tasks").select("id,title").ilike("title", like).limit(6),
        supabase.from("projects").select("id,name").ilike("name", like).limit(6),
        supabase.from("clients").select("id,name").ilike("name", like).limit(6),
        supabase.from("proposals").select("id,title").ilike("title", like).limit(6),
      ]);
      return {
        tasks: (tasks.data ?? []).map(t => ({ id: t.id, label: t.title, to: `/tasks?open=${t.id}` })) as Hit[],
        projects: (projects.data ?? []).map(p => ({ id: p.id, label: p.name, to: `/projects/${p.id}` })) as Hit[],
        clients: (clients.data ?? []).map(c => ({ id: c.id, label: c.name, to: `/clients/${c.id}` })) as Hit[],
        proposals: (proposals.data ?? []).map(p => ({ id: p.id, label: p.title, to: `/proposals` })) as Hit[],
      };
    },
  });

  const go = (to: string) => {
    setOpen(false);
    setTerm("");
    navigate({ to });
  };

  const groups: { key: string; title: string; icon: typeof Briefcase; items: Hit[] }[] = [
    { key: "tasks", title: "Tarefas", icon: CheckSquare, items: data?.tasks ?? [] },
    { key: "projects", title: "Projetos", icon: Briefcase, items: data?.projects ?? [] },
    { key: "clients", title: "Clientes", icon: Building2, items: data?.clients ?? [] },
    { key: "proposals", title: "Propostas", icon: FileText, items: data?.proposals ?? [] },
  ];
  const total = groups.reduce((s, g) => s + g.items.length, 0);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex w-full max-w-sm items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-[13px] text-muted-foreground hover:border-primary/40 transition-colors"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Buscar tarefas, clientes, projetos...</span>
        <kbd className="ml-auto rounded border border-border px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          value={term}
          onValueChange={setTerm}
          placeholder="Buscar tarefas, clientes, projetos, propostas..."
        />
        <CommandList>
          {q.length < 2 ? (
            <CommandEmpty>Digite ao menos 2 caracteres.</CommandEmpty>
          ) : isFetching && total === 0 ? (
            <CommandEmpty>Buscando...</CommandEmpty>
          ) : total === 0 ? (
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          ) : null}
          {groups.filter(g => g.items.length > 0).map(g => (
            <CommandGroup key={g.key} heading={g.title}>
              {g.items.map(item => (
                <CommandItem key={g.key + item.id} value={g.key + item.label + item.id} onSelect={() => go(item.to)}>
                  <g.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
