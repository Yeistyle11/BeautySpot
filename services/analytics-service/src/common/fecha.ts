/**
 * Fecha del servidor en formato YYYY-MM-DD, que es como se guardan las métricas
 * diarias y las citas.
 *
 * Se construye con las partes locales y no con `toISOString()`: en un servidor
 * al oeste de Greenwich, todo lo registrado a partir de las 19:00 caería en el
 * día siguiente y las cifras "de hoy" no cuadrarían con las de la caja.
 */
export function fechaDeHoy(fecha: Date = new Date()): string {
  const mes = `${fecha.getMonth() + 1}`.padStart(2, "0");
  const dia = `${fecha.getDate()}`.padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Fecha de hace N días, en el mismo formato que {@link fechaDeHoy}. */
export function fechaHaceDias(dias: number, desde: Date = new Date()): string {
  const fecha = new Date(desde);
  fecha.setDate(fecha.getDate() - dias);
  return fechaDeHoy(fecha);
}
