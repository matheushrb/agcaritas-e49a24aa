import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: () => <ModulePlaceholder icon={Bell} title="Notificações" description="Central de eventos: mensagens, tarefas atrasadas, propostas visualizadas." />,
});
