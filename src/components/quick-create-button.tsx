import { Link } from "@tanstack/react-router";
import { Plus, Briefcase, CheckSquare, Calendar, DollarSign, Users, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const ITEMS = [
  { to: "/projects",  icon: Briefcase,  label: "Novo projeto",       desc: "Cadastrar projeto do zero" },
  { to: "/tasks",     icon: CheckSquare, label: "Nova tarefa",       desc: "Task avulsa ou vinculada" },
  { to: "/calendar",  icon: Calendar,    label: "Novo compromisso",  desc: "Reunião, entrega ou interno" },
  { to: "/finance",   icon: DollarSign,  label: "Novo lançamento",   desc: "Receita ou despesa" },
  { to: "/crm",       icon: Users,       label: "Novo lead",         desc: "Oportunidade no funil" },
  { to: "/proposals", icon: FileText,    label: "Nova proposta",     desc: "Documento comercial" },
] as const;

export function QuickCreateButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cv-button cv-primary"
        >
          <Plus className="h-4 w-4" /> Novo
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2 rounded-2xl">
        <div className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground px-2 pt-1 pb-2">
          Criar rápido
        </div>
        {ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              search={{ new: 1 } as any}
              className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted"
            >
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-[11px] text-muted-foreground">{item.desc}</div>
              </div>
            </Link>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
