import { LOCALE_POR_DEFECTO } from "@beautyspot/shared-utils";

/**
 * Cómo escribe el producto una fecha y una hora en los correos: «5 de sept de
 * 2026» y «8:00 pm», y no los valores crudos con los que viajan por el bus.
 */

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
 * Hora "HH:MM" como «8:00 pm», bajando al reloj las que pasan de 24 —«24:30»
 * son las 12:30 am—, que es la convención con la que se guarda la madrugada.
 */
export function horaEnCastellano(hora?: unknown): string {
  if (typeof hora !== "string") return "";

  const [h, m] = hora.split(":");
  const numero = Number.parseInt(h, 10);
  if (Number.isNaN(numero) || m === undefined) return hora;

  const enReloj = numero % 24;
  const sufijo = enReloj >= 12 ? "pm" : "am";
  const doceHoras = enReloj > 12 ? enReloj - 12 : enReloj === 0 ? 12 : enReloj;
  return `${doceHoras}:${m} ${sufijo}`;
}

/** Fecha y hora juntas: «5 de sept de 2026, 8:00 pm». */
export function fechaYHoraEnCastellano(
  fecha?: unknown,
  hora?: unknown
): string {
  const dia = fechaEnCastellano(fecha);
  const reloj = horaEnCastellano(hora);
  return reloj ? `${dia}, ${reloj}` : dia;
}
