import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/messages")({
  component: () => <ModulePlaceholder icon={MessageCircle} title="Mensagens" description="Conversas internas do time e com clientes." />,
});
