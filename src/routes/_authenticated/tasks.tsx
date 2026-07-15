import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: () => <ModulePlaceholder icon={ClipboardList} title="Tarefas" description="Tarefas vinculadas a projetos com 4 modelos de faturamento." />,
});
