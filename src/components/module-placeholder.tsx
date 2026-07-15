import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export function ModulePlaceholder({
  icon: Icon, title, description,
}: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="grid place-items-center py-16">
      <Card className="card-surface max-w-lg w-full p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <p className="mt-6 text-xs text-muted-foreground">
          Este módulo será construído na próxima fase do Pixie Pro.
        </p>
      </Card>
    </div>
  );
}
