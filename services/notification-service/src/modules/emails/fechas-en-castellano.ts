import { LOCALE_POR_DEFECTO } from "@beautyspot/shared-utils";

/** Cómo se escriben la fecha y la hora en los correos: «5 de sept de 2026», «20:00». */

/** Fecha "YYYY-MM-DD" como «5 de sept de 2026»; el valor tal cual si no lo es. */
export function fechaEnCastellano(fecha?: unknown): string {
  if (typeof fecha !== "string" && !(fecha instanceof Date)) return "";

  // El mediodía evita que un huso negativo corra la fecha un día atrás, igual
  // que hace el panel.
  const valor =
    fecha instanceof Date
      ? fecha
      : new Date(fecha.includes("T") ? fecha : `${fecha}T12:00:00`);
  if (Number.isNaN(valor.getTime())) return String(fecha);

  return valor.toLocaleDateString(LOCALE_POR_DEFECTO, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Hora "HH:MM" en reloj de 24 horas, bajando las que pasan de 24 —«24:30» son
 * las «00:30»—, que es la convención con la que se guarda la madrugada.
 */
export function horaEnCastellano(hora?: unknown): string {
  if (typeof hora !== "string") return "";

  const [h, m] = hora.split(":");
  const numero = Number.parseInt(h, 10);
  if (Number.isNaN(numero) || m === undefined) return hora;

  const enReloj = numero % 24;
  return `${String(enReloj).padStart(2, "0")}:${m}`;
}

/** Fecha y hora juntas: «5 de sept de 2026, 20:00». */
export function fechaYHoraEnCastellano(
  fecha?: unknown,
  hora?: unknown
): string {
  const dia = fechaEnCastellano(fecha);
  const reloj = horaEnCastellano(hora);
  return reloj ? `${dia}, ${reloj}` : dia;
}
