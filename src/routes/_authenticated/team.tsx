import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { UsersRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team")({
  component: () => <ModulePlaceholder icon={UsersRound} title="Time" description="Cadastro de colaboradores, cargos e alocação em projetos." />,
});
