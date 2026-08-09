"use client";

import { cn } from "@/lib/utils";

interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  activo: boolean;
  /** `pill` para las barras de filtro; `segment` para los grupos con fondo. */
  variante?: "pill" | "segment";
}

/**
 * Boton de filtro con estado activo. Existe porque cada pagina tenia su propio
 * esquema de "activo/inactivo" y ninguno declaraba aria-pressed ni anillo de
 * foco, de modo que el filtro elegido no llegaba al lector de pantalla.
 */
export function FilterChip({
  activo,
  variante = "pill",
  className,
  ...props
}: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      className={cn(
        "focus-visible:ring-ring text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
        variante === "pill"
          ? "rounded-full px-3 py-1 text-xs"
          : "flex-1 rounded-md px-3 py-2",
        variante === "pill"
          ? activo
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-primary/20"
          : activo
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}
