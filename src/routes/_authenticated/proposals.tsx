import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/proposals")({
  component: () => <ModulePlaceholder icon={FileText} title="Propostas" description="Criação, envio e acompanhamento de propostas comerciais." />,
});
