/**
 * Reloj del negocio: las citas guardan `date` y `startTime` como hora de pared
 * del local. Aquí quedan los envoltorios del huso por defecto; lo que conoce su
 * `businessId` resuelve el huso con `ZonaDelNegocioService`.
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
