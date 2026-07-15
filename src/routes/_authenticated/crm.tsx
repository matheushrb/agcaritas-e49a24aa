import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/crm")({
  component: () => <ModulePlaceholder icon={Users} title="CRM / Prospecção" description="Pipeline em kanban com leads, contato, proposta, negociação e fechado. Em construção — próxima fase." />,
});
