import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finance")({
  component: () => <ModulePlaceholder icon={DollarSign} title="Financeiro" description="Faturamento, cobranças, receita recorrente e controle de pagamentos." />,
});
