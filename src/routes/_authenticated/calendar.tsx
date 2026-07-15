import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/calendar")({
  component: () => <ModulePlaceholder icon={Calendar} title="Agenda" description="Todos os compromissos e reuniões da agência." />,
});
