import { fechaDeHoyEn } from "@beautyspot/shared-utils";

/**
 * Día en curso en el huso del negocio, en formato YYYY-MM-DD, que es como se
 * guardan las métricas diarias y las citas.
 */
export function fechaDeHoy(zona: string, fecha: Date = new Date()): string {
  return fechaDeHoyEn(zona, fecha);
}

/** Fecha de hace N días, en el mismo formato que {@link fechaDeHoy}. */
export function fechaHaceDias(
  zona: string,
  dias: number,
  desde: Date = new Date()
): string {
  // Se resta sobre el instante y luego se lee el reloj del negocio.
  const fecha = new Date(desde);
  fecha.setDate(fecha.getDate() - dias);
  return fechaDeHoy(zona, fecha);
}
