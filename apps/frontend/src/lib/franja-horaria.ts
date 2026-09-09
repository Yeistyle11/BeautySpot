import { timeToMinutes } from "@beautyspot/shared-utils";

/** Franja de jornada que se pinta cuando nada pide más. */
export const HORA_INICIO_MINIMA = 7;
export const HORA_FIN_MINIMA = 21;

/** Tramo de la rejilla: dos horas "HH:MM", con el fin después del inicio. */
export interface Tramo {
  inicio: string;
  fin: string;
}

/** Horario de apertura de un día, tal como lo guarda el negocio. */
export interface HorarioDelNegocio {
  openTime: string;
  closeTime: string;
  active: boolean;
}

/**
 * Minutos de cierre contando la madrugada como continuación del mismo día: un
 * negocio que abre a las 20:00 y cierra a las 02:00 cierra en el minuto 1560,
 * no en el 120. Es la misma convención que usa el selector de hora de cierre, y
 * la que deja que la rejilla pinte «24:30» como las 12:30 am.
 */
function cierreEnMinutos(horario: HorarioDelNegocio): number {
  const apertura = timeToMinutes(horario.openTime);
  const cierre = timeToMinutes(horario.closeTime);
  return cierre <= apertura ? cierre + 24 * 60 : cierre;
}

/**
 * Horas que hay que pintar para que quepa todo lo que hay que enseñar: las
 * citas, los bloqueos y la jornada que el negocio declara.
 *
 * Sin el horario, una rejilla fija deja fuera al negocio que abre de noche y le
 * enseña una semana vacía con aspecto de disponible, que es peor que no servir.
 */
export function franjaDeHoras(
  tramos: Tramo[],
  horarios: HorarioDelNegocio[] = []
): number[] {
  let desde = HORA_INICIO_MINIMA;
  let hasta = HORA_FIN_MINIMA;

  for (const horario of horarios) {
    if (!horario.active) continue;
    desde = Math.min(desde, Math.floor(timeToMinutes(horario.openTime) / 60));
    hasta = Math.max(hasta, Math.ceil(cierreEnMinutos(horario) / 60));
  }

  for (const tramo of tramos) {
    desde = Math.min(desde, Math.floor(timeToMinutes(tramo.inicio) / 60));
    hasta = Math.max(hasta, Math.ceil(timeToMinutes(tramo.fin) / 60));
  }

  return Array.from({ length: hasta - desde }, (_, i) => i + desde);
}
