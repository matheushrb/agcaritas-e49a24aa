import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { Inbox } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inbox")({
  component: () => <ModulePlaceholder icon={Inbox} title="Caixa de entrada" description="Emails, mensagens e briefings recebidos." />,
});
