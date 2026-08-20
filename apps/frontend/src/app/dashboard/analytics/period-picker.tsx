"use client";

// Selector del periodo sobre el que se leen los reportes.
import { useId } from "react";
import { Input } from "@/components/ui/input";
import {
  ETIQUETAS_DE_PERIODO,
  periodoValido,
  type Periodo,
  type PeriodoId,
} from "@/lib/periodo";
import { cn } from "@/lib/utils";

/** Periodos con nombre, en el orden en que se ofrecen. */
const ATAJOS: PeriodoId[] = [
  "hoy",
  "ayer",
  "semana",
  "mes",
  "mesPasado",
  "ultimos30",
  "anio",
  "personalizado",
];

interface PeriodPickerProps {
  seleccionado: PeriodoId;
  periodo: Periodo;
  onSeleccionar: (id: PeriodoId) => void;
  onPersonalizar: (periodo: Periodo) => void;
}

/** Atajos de periodo y, si se elige "personalizado", sus dos fechas. */
export function PeriodPicker({
  seleccionado,
  periodo,
  onSeleccionar,
  onPersonalizar,
}: PeriodPickerProps) {
  const id = useId();
  const invertido = !periodoValido(periodo);

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Periodo del reporte"
      >
        {ATAJOS.map((atajo) => (
          <button
            key={atajo}
            type="button"
            onClick={() => onSeleccionar(atajo)}
            aria-pressed={seleccionado === atajo}
            className={cn(
              "focus-visible:ring-ring rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
              seleccionado === atajo
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            {ETIQUETAS_DE_PERIODO[atajo]}
          </button>
        ))}
      </div>

      {seleccionado === "personalizado" && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor={`${id}-desde`}
              className="text-muted-foreground mb-1 block text-xs"
            >
              Desde
            </label>
            <Input
              id={`${id}-desde`}
              type="date"
              value={periodo.from}
              max={periodo.to || undefined}
              onChange={(e) =>
                onPersonalizar({ ...periodo, from: e.target.value })
              }
            />
          </div>
          <div>
            <label
              htmlFor={`${id}-hasta`}
              className="text-muted-foreground mb-1 block text-xs"
            >
              Hasta
            </label>
            <Input
              id={`${id}-hasta`}
              type="date"
              value={periodo.to}
              min={periodo.from || undefined}
              onChange={(e) =>
                onPersonalizar({ ...periodo, to: e.target.value })
              }
            />
          </div>
          {/*
            Se avisa y no se corrige: dar la vuelta a las fechas devolvería
            cifras de un periodo que nadie pidió, y quien las lea no lo sabrá.
          */}
          {invertido && (
            <p role="alert" className="text-sm text-red-600">
              La fecha de inicio tiene que ser anterior a la de fin.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
