// Selector de la hora a la que se cierra o se sale, madrugada incluida.
import * as React from "react";
import { Select } from "@/components/ui/select";
import { formatTime } from "@/lib/utils";

/** Paso de la rejilla de horas que se ofrece. */
const PASO_MINUTOS = 30;

/** Minutos que tiene un día; a partir de ahí la hora ya es de madrugada. */
const MINUTOS_DEL_DIA = 24 * 60;

/**
 * Última hora que se ofrece, en minutos: las 08:00 del día siguiente. Es el
 * mismo techo que valida el backend, una jornada por debajo.
 */
const TOPE_MINUTOS = 32 * 60;

/** Hora "HH:MM" a partir de los minutos desde la medianoche del día que abrió. */
function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Cómo se lee la hora: la madrugada se dice en reloj de pared, no en 26:00. */
function etiquetaDe(minutos: number): string {
  if (minutos < MINUTOS_DEL_DIA) return formatTime(aHora(minutos));
  return `${formatTime(aHora(minutos - MINUTOS_DEL_DIA))} (madrugada)`;
}

const OPCIONES = Array.from(
  { length: TOPE_MINUTOS / PASO_MINUTOS },
  (_, i) => (i + 1) * PASO_MINUTOS
).map((minutos) => ({ valor: aHora(minutos), etiqueta: etiquetaDe(minutos) }));

interface HoraDeCierreProps extends Omit<
  React.ComponentProps<typeof Select>,
  "onChange" | "children"
> {
  value: string;
  onValueChange: (hora: string) => void;
}

/**
 * Desplegable de la hora de cierre.
 *
 * No puede ser un `<input type="time">`: el navegador no acepta "26:00", y esa
 * es justo la forma en que un negocio que cierra de madrugada expresa que sigue
 * abierto pasada la medianoche del día en que abrió. Si el valor guardado no
 * cae en la rejilla se añade como opción, para no perderlo al editar.
 */
export function HoraDeCierre({
  value,
  onValueChange,
  ...props
}: HoraDeCierreProps) {
  const opciones = OPCIONES.some((o) => o.valor === value)
    ? OPCIONES
    : [{ valor: value, etiqueta: value }, ...OPCIONES];

  return (
    <Select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      {...props}
    >
      {opciones.map((opcion) => (
        <option key={opcion.valor} value={opcion.valor}>
          {opcion.etiqueta}
        </option>
      ))}
    </Select>
  );
}
