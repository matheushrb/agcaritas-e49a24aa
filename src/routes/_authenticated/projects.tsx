import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Briefcase } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects")({
  component: () => <ModulePlaceholder icon={Briefcase} title="Projetos" description="Projetos gerados pelos planos de marketing aprovados." />,
});
