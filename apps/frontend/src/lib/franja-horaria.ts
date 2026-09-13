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
 * Minutos de cierre contando la madrugada como continuación del mismo día: quien
 * abre a las 20:00 y cierra a las 02:00 cierra en el minuto 1560. Es la
 * convención del selector de cierre, y la que pinta «24:30» como 12:30 am.
 */
function cierreEnMinutos(horario: HorarioDelNegocio): number {
  const apertura = timeToMinutes(horario.openTime);
  const cierre = timeToMinutes(horario.closeTime);
  return cierre <= apertura ? cierre + 24 * 60 : cierre;
}

/**
 * Horas que hay que pintar para que quepa todo lo que hay que enseñar: las
 * citas, los bloqueos y la jornada que el negocio declara. Sin el horario, una
 * rejilla fija deja fuera al negocio que abre de noche.
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

/** Horas de la jornada del negocio, con una hora de margen a cada lado. */
export function franjaDeJornada(horarios: HorarioDelNegocio[] = []): number[] {
  let desde = HORA_INICIO_MINIMA;
  let hasta = HORA_FIN_MINIMA;

  const abiertos = horarios.filter((h) => h.active);
  if (abiertos.length > 0) {
    desde = 24;
    hasta = 0;
    for (const horario of abiertos) {
      desde = Math.min(desde, Math.floor(timeToMinutes(horario.openTime) / 60));
      hasta = Math.max(hasta, Math.ceil(cierreEnMinutos(horario) / 60));
    }
  }

  // El cierre puede pasar de 24 —quien cierra a las 02:00 cierra en la hora
  // 26—, asi que el margen de arriba no se recorta al dia.
  desde = Math.max(0, desde - 1);
  hasta = hasta + 1;
  return Array.from({ length: hasta - desde }, (_, i) => i + desde);
}

/**
 * Los huecos del día ordenados por jornada y no por reloj: la jornada empieza
 * después del hueco más largo, que es el tiempo en que el negocio cierra.
 */
export function ordenarPorJornada(horas: string[]): {
  enJornada: string[];
  deMadrugada: string[];
} {
  const ordenadas = [...horas].sort();
  if (ordenadas.length < 2) return { enJornada: ordenadas, deMadrugada: [] };

  const DIA = 24 * 60;
  let inicio = 0;
  let mayorHueco = -1;
  for (let i = 0; i < ordenadas.length; i++) {
    const previa = timeToMinutes(
      ordenadas[(i - 1 + ordenadas.length) % ordenadas.length]
    );
    const hueco = (timeToMinutes(ordenadas[i]) - previa + DIA) % DIA;
    if (hueco > mayorHueco) {
      mayorHueco = hueco;
      inicio = i;
    }
  }

  return {
    enJornada: ordenadas.slice(inicio),
    deMadrugada: ordenadas.slice(0, inicio),
  };
}
