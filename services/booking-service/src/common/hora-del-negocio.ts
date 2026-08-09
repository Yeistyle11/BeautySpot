/**
 * Reloj del negocio.
 *
 * Las citas guardan `date` (columna `date`) y `startTime` (`HH:mm`) como hora de
 * pared del local, sin huso: una cita de las 10:00 son las 10:00 allí, viva
 * donde viva el servidor. Para decidir si una franja ya pasó hay que comparar
 * contra esa misma hora de pared, no contra la del proceso, que en producción
 * corre en UTC.
 */

/** Huso en el que opera el negocio; coincide con el valor por defecto de la entidad. */
const ZONA = process.env.BUSINESS_TIMEZONE ?? "America/Bogota";

const FORMATEADOR = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Fecha `YYYY-MM-DD` y hora `HH:mm` actuales en el huso del negocio. */
export function ahoraEnElNegocio(): { fecha: string; hora: string } {
  const partes = FORMATEADOR.formatToParts(new Date());
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? "";

  return {
    fecha: `${valor("year")}-${valor("month")}-${valor("day")}`,
    hora: `${valor("hour")}:${valor("minute")}`,
  };
}

/** Indica si la fecha de calendario es anterior al día de hoy en el negocio. */
export function esFechaPasada(date: string): boolean {
  return date < ahoraEnElNegocio().fecha;
}

/**
 * Indica si el instante ya pasó. Ambos formatos son de ancho fijo y con ceros a
 * la izquierda, así que la comparación de cadenas ordena igual que la temporal.
 */
export function esInstantePasado(date: string, startTime: string): boolean {
  const ahora = ahoraEnElNegocio();
  return `${date} ${startTime}` < `${ahora.fecha} ${ahora.hora}`;
}
