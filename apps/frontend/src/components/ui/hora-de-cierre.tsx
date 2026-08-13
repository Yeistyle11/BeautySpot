// Selector de la hora a la que se cierra o se sale, madrugada incluida.
import * as React from "react";
import { Select } from "@/components/ui/select";
import { formatTime } from "@/lib/utils";

/** Paso de la rejilla de horas que se ofrece. */
const PASO_MINUTOS = 30;

/** Minutos que tiene un día: la última hora que se puede ofrecer. */
const MINUTOS_DEL_DIA = 24 * 60;

/**
 * Hasta dónde llega la madrugada que se ofrece: las 08:00. Es el mismo techo
 * que valida el backend.
 */
const TOPE_DE_MADRUGADA = 8 * 60;

/** Hora "HH:MM" a partir de los minutos desde la medianoche. */
function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Todas las horas de cierre que se ofrecen, del final del día a la madrugada. */
const HORAS = Array.from(
  { length: MINUTOS_DEL_DIA / PASO_MINUTOS },
  (_, i) => (i + 1) * PASO_MINUTOS
).map(aHora);

/** Minutos desde la medianoche de una hora "HH:MM". */
function enMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Cómo se lee la hora de cierre según cuándo se abrió.
 *
 * Cerrar a las dos con el negocio abierto desde las ocho de la tarde es la
 * madrugada del día siguiente; con el negocio abierto desde la una, no habría
 * jornada. La etiqueta lo dice para que nadie tenga que deducirlo.
 */
function etiquetaDe(hora: string, apertura?: string): string {
  if (hora === "24:00") return "12:00 am (medianoche)";
  if (apertura && enMinutos(hora) <= enMinutos(apertura)) {
    return `${formatTime(hora)} (madrugada)`;
  }
  return formatTime(hora);
}

interface HoraDeCierreProps extends Omit<
  React.ComponentProps<typeof Select>,
  "onChange" | "children"
> {
  value: string;
  onValueChange: (hora: string) => void;
  /** Hora de apertura del tramo, para saber qué horas caen ya en la madrugada. */
  apertura?: string;
}

/**
 * Desplegable de la hora de cierre.
 *
 * No puede ser un `<input type="time">`: hace falta distinguir el cierre a
 * medianoche (24:00) del arranque del día, y avisar de qué horas caen ya en la
 * madrugada siguiente. Si el valor guardado no cae en la rejilla se añade como
 * opción, para no perderlo al editar.
 */
export function HoraDeCierre({
  value,
  onValueChange,
  apertura,
  ...props
}: HoraDeCierreProps) {
  const horas = HORAS.includes(value) ? HORAS : [value, ...HORAS];
  // Con el negocio abierto desde las 20:00, valen las horas posteriores del
  // mismo día y la madrugada hasta las 08:00. Lo de en medio no es una jornada,
  // es un dedazo, y el backend lo rechaza.
  const ofrecidas = horas.filter(
    (hora) =>
      hora === value ||
      !apertura ||
      enMinutos(hora) > enMinutos(apertura) ||
      enMinutos(hora) <= TOPE_DE_MADRUGADA
  );

  return (
    <Select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      {...props}
    >
      {ofrecidas.map((hora) => (
        <option key={hora} value={hora}>
          {etiquetaDe(hora, apertura)}
        </option>
      ))}
    </Select>
  );
}
