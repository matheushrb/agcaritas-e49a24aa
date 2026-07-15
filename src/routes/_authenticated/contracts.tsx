import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { FileSignature } from "lucide-react";

export const Route = createFileRoute("/_authenticated/contracts")({
  component: () => <ModulePlaceholder icon={FileSignature} title="Contratos" description="Geração e controle de contratos vinculados às propostas aprovadas." />,
});
