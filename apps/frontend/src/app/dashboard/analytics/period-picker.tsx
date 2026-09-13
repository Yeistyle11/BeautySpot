"use client";

// Selector del periodo sobre el que se leen los reportes.
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  ETIQUETAS_DE_PERIODO,
  diasDelPeriodo,
  periodoValido,
  type Periodo,
  type PeriodoId,
} from "@/lib/periodo";

/** Periodos con nombre, en el orden en que se ofrecen. */
const ATAJOS: PeriodoId[] = [
  "hoy",
  "ayer",
  "semana",
  "mes",
  "mesPasado",
  "ultimos30",
  "anio",
];

interface PeriodPickerProps {
  seleccionado: PeriodoId;
  periodo: Periodo;
  onSeleccionar: (id: PeriodoId) => void;
  onPersonalizar: (periodo: Periodo) => void;
}

/** Un atajo con nombre y las dos fechas del periodo, siempre a la vista. */
export function PeriodPicker({
  seleccionado,
  periodo,
  onSeleccionar,
  onPersonalizar,
}: PeriodPickerProps) {
  const id = useId();
  const invertido = !periodoValido(periodo);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label
          htmlFor={`${id}-atajo`}
          className="text-muted-foreground mb-1 block text-xs"
        >
          Periodo
        </label>
        <Select
          id={`${id}-atajo`}
          className="w-[180px]"
          value={seleccionado}
          onChange={(e) => onSeleccionar(e.target.value as PeriodoId)}
        >
          {ATAJOS.map((atajo) => (
            <option key={atajo} value={atajo}>
              {ETIQUETAS_DE_PERIODO[atajo]}
            </option>
          ))}
          <option value="personalizado">
            {ETIQUETAS_DE_PERIODO.personalizado}
          </option>
        </Select>
      </div>

      {/* Las fechas se muestran resueltas para cualquier atajo. Escribir en
          ellas pasa el periodo a medida. */}
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
          className="w-[170px]"
          value={periodo.from}
          max={periodo.to || undefined}
          onChange={(e) => onPersonalizar({ ...periodo, from: e.target.value })}
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
          className="w-[170px]"
          value={periodo.to}
          min={periodo.from || undefined}
          onChange={(e) => onPersonalizar({ ...periodo, to: e.target.value })}
        />
      </div>

      {/* El rango invertido se avisa, no se corrige. */}
      {invertido ? (
        <p role="alert" className="text-destructive pb-2 text-sm">
          La fecha de inicio tiene que ser anterior a la de fin.
        </p>
      ) : (
        <p className="text-muted-foreground pb-2.5 text-sm">
          {diasDelPeriodo(periodo)} días
        </p>
      )}
    </div>
  );
}
