import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentMethodOption = {
  id: string;
  label: string;
  rule: string;
};

export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  { id: "PIX", label: "PIX", rule: "Baixa imediata. Chave/QR Code impresso na fatura." },
  { id: "Boleto", label: "Boleto bancário", rule: "Compensação em até 1 dia útil após o pagamento." },
  { id: "Boleto com PIX", label: "Boleto com PIX", rule: "Boleto que também pode ser quitado pelo QR Code PIX, com baixa imediata." },
  { id: "Transferência bancária", label: "Transferência (TED/DOC)", rule: "Enviar comprovante; baixa manual após conferência." },
  { id: "Cartão de crédito", label: "Cartão de crédito", rule: "Sujeito à taxa da operadora e ao prazo de repasse." },
  { id: "Dinheiro", label: "Dinheiro", rule: "Baixa manual mediante recibo." },
  { id: "Outro", label: "Outro", rule: "Combinar a forma diretamente com o cliente." },
];

export function parsePaymentMethods(value?: string | null): string[] {
  if (!value) return [];
  return value.split(/[,;]|\s+\+\s+/).map(s => s.trim()).filter(Boolean);
}

export function serializePaymentMethods(list: string[]): string {
  return list.join(", ");
}

export function PaymentMethodTags({
  value,
  onChange,
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);

  const selected = PAYMENT_METHOD_OPTIONS.filter(o => value.includes(o.id));

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap gap-1.5">
        {PAYMENT_METHOD_OPTIONS.map(opt => {
          const on = value.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              title={opt.rule}
              onClick={() => toggle(opt.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 h-7 text-[11px] font-medium transition-colors",
                on
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              {on && <Check className="h-3 w-3" />}
              {opt.label}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <ul className="space-y-0.5">
          {selected.map(o => (
            <li key={o.id} className="text-[10px] leading-snug text-muted-foreground">
              <b className="text-foreground/80">{o.label}:</b> {o.rule}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
