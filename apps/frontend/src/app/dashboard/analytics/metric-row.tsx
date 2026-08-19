"use client";

// Fila de una cifra del reporte, con su variación frente al periodo anterior.
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { variacion } from "@/lib/periodo";
import { cn } from "@/lib/utils";

interface MetricRowProps {
  etiqueta: string;
  valor: React.ReactNode;
  /** Cifra en bruto del periodo, para poder compararla. */
  actual?: number | null;
  /** La misma cifra en el periodo anterior, si se pidió comparar. */
  anterior?: number | null;
  /** Si bajar es lo bueno, como en las cancelaciones. */
  bajarEsBueno?: boolean;
  className?: string;
}

/** Etiqueta, cifra y, cuando hay con qué comparar, su variación. */
export function MetricRow({
  etiqueta,
  valor,
  actual,
  anterior,
  bajarEsBueno,
  className,
}: MetricRowProps) {
  const cambio = actual == null ? null : variacion(actual, anterior);

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="flex items-center gap-2">
        <span className={cn("font-semibold", className)}>{valor}</span>
        {cambio !== null && (
          <Variacion porcentaje={cambio} bueno={bajarEsBueno} />
        )}
      </span>
    </div>
  );
}

/** Flecha y porcentaje de la variación frente al periodo anterior. */
function Variacion({
  porcentaje,
  bueno,
}: {
  porcentaje: number;
  bueno?: boolean;
}) {
  const sube = porcentaje > 0;
  const igual = porcentaje === 0;
  const mejora = bueno ? !sube : sube;

  const Icono = igual ? ArrowRight : sube ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        igual
          ? "text-muted-foreground"
          : mejora
            ? "text-success"
            : "text-red-600"
      )}
      title="Frente al periodo anterior"
    >
      <Icono className="h-3 w-3" aria-hidden="true" />
      {porcentaje > 0 ? "+" : ""}
      {porcentaje}%
    </span>
  );
}
