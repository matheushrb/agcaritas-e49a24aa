import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/marketing-plans")({
  component: () => <ModulePlaceholder icon={Target} title="Planos de Marketing" description="Briefing por segmento que se converte em projeto ao ser aprovado." />,
});
