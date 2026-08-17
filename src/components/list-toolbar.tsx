import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type ViewOption<T extends string> = { k: T; icon: LucideIcon; label: string };

/** Alternador de visualizações padrão (Lista / Cards / Quadros / Tabela). */
export function ViewSwitch<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly ViewOption<T>[];
}) {
  return (
    <div className="cv-views" role="tablist" aria-label="Visualização">
      {options.map(o => (
        <button
          key={o.k}
          type="button"
          role="tab"
          aria-selected={value === o.k}
          data-active={value === o.k}
          className="cv-view"
          title={o.label}
          onClick={() => onChange(o.k)}
        >
          <o.icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Barra universal de listagem: busca/filtros à esquerda, views e contador à direita. */
export function ListToolbar({
  children, right, count, countLabel = "itens",
}: {
  children?: ReactNode;
  right?: ReactNode;
  count?: number;
  countLabel?: string;
}) {
  return (
    <div className="cv-toolbar">
      {children}
      <div className="cv-toolbar-spacer" />
      {typeof count === "number" && (
        <span className="cv-count">{count} {countLabel}</span>
      )}
      {right}
    </div>
  );
}
