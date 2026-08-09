/**
 * Reloj del negocio.
 *
 * Las citas guardan `date` (columna `date`) y `startTime` (`HH:mm`) como hora de
 * pared del local, sin huso: una cita de las 10:00 son las 10:00 allí, viva
 * donde viva el servidor.
 *
 * La lógica vive en `@beautyspot/shared-utils`, compartida con analytics y
 * payment. Aquí quedan los envoltorios que usan el huso **por defecto**, para lo
 * que no tiene un negocio al que preguntar. Todo lo que sí conoce su
 * `businessId` —agenda, reservas, reagendado, recordatorios— resuelve el huso
 * con `ZonaDelNegocioService`.
 */
import {
  ahoraEnLaZona,
  esFechaPasadaEn,
  esInstantePasadoEn,
  ZONA_POR_DEFECTO,
} from "@beautyspot/shared-utils";

/** Huso que se usa cuando no hay un negocio concreto del que resolverlo. */
const ZONA = process.env.BUSINESS_TIMEZONE ?? ZONA_POR_DEFECTO;

/** Fecha `YYYY-MM-DD` y hora `HH:mm` actuales en el huso por defecto. */
export function ahoraEnElNegocio(): { fecha: string; hora: string } {
  return ahoraEnLaZona(ZONA);
}

/** Indica si la fecha de calendario es anterior a hoy en el huso por defecto. */
export function esFechaPasada(date: string): boolean {
  return esFechaPasadaEn(ZONA, date);
}

/** Indica si el instante ya pasó en el huso por defecto. */
export function esInstantePasado(date: string, startTime: string): boolean {
  return esInstantePasadoEn(ZONA, date, startTime);
}
