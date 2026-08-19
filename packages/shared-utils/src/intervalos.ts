/** Reparto de la agenda de un profesional dentro de una cita. */
import { calculateEndTime, timeToMinutes, timesOverlap } from "./index";

/** Tramo ocupado de la agenda, semiabierto: `[inicio, fin)`, horas "HH:MM". */
export interface Intervalo {
  inicio: string;
  fin: string;
}

/** Línea de servicio con lo que hace falta para repartir la agenda. */
export interface LineaDeAgenda {
  duration: number;
  orden: number;
  /** Minuto de la línea en que el profesional queda libre; nulo = no lo queda. */
  procesadoDesde?: number | null;
  procesadoMinutos?: number | null;
  /** Limpieza posterior, en la que sigue ocupado sin cliente delante. */
  bufferDespues?: number | null;
  /** Quién atiende la línea; nulo = el titular de la cita. */
  professionalId?: string | null;
}

/** Lo que una cita ocupa en la agenda de uno de sus profesionales. */
export interface OcupacionDeProfesional {
  professionalId: string;
  intervalos: Intervalo[];
  /** Hora a la que empieza su primera línea. */
  inicio: string;
  /** Hora a la que termina su última línea. */
  finDeCliente: string;
  /** `finDeCliente` más la limpieza de esa última línea. */
  fin: string;
}

/** Ordena las líneas por su posición dentro de la cita. */
function porOrden(a: LineaDeAgenda, b: LineaDeAgenda): number {
  return a.orden - b.orden;
}

/** Indica si la línea define una ventana de procesado utilizable. */
function tieneProcesado(linea: LineaDeAgenda): boolean {
  const desde = linea.procesadoDesde ?? null;
  const minutos = linea.procesadoMinutos ?? null;
  if (desde === null || minutos === null || minutos <= 0) return false;
  return desde >= 0 && desde + minutos <= linea.duration;
}

/** Minutos que la clienta pasa en el salón. No incluye la limpieza posterior. */
export function duracionDeCliente(lineas: LineaDeAgenda[]): number {
  return lineas.reduce((total, linea) => total + linea.duration, 0);
}

/**
 * Reparte la cita entre los profesionales que la atienden: las líneas se
 * encadenan una tras otra y cada una ocupa la agenda de quien la hace.
 */
export function repartoPorProfesional(
  startTime: string,
  endTime: string,
  lineas: LineaDeAgenda[],
  titular: string
): OcupacionDeProfesional[] {
  if (lineas.length === 0) {
    return [
      {
        professionalId: titular,
        intervalos: [{ inicio: startTime, fin: endTime }],
        inicio: startTime,
        finDeCliente: endTime,
        fin: endTime,
      },
    ];
  }

  const porProfesional = new Map<string, OcupacionDeProfesional>();
  // Limpieza de la última línea de cada profesional.
  const limpieza = new Map<string, number>();
  let minuto = timeToMinutes(startTime);

  for (const linea of [...lineas].sort(porOrden)) {
    const professionalId = linea.professionalId ?? titular;
    const inicio = minutosAHora(minuto);
    const fin = calculateEndTime(inicio, linea.duration);

    const acumulado = porProfesional.get(professionalId) ?? {
      professionalId,
      intervalos: [],
      inicio,
      finDeCliente: fin,
      fin,
    };
    acumulado.intervalos.push(...intervalosDeLinea(linea, inicio, fin));
    acumulado.finDeCliente = fin;
    porProfesional.set(professionalId, acumulado);
    limpieza.set(professionalId, linea.bufferDespues ?? 0);

    minuto += linea.duration;
  }

  for (const ocupacion of porProfesional.values()) {
    const minutos = limpieza.get(ocupacion.professionalId) ?? 0;
    ocupacion.fin = calculateEndTime(ocupacion.finDeCliente, minutos);
    if (minutos > 0) {
      ocupacion.intervalos.push({
        inicio: ocupacion.finDeCliente,
        fin: ocupacion.fin,
      });
    }
  }

  return [...porProfesional.values()];
}

/**
 * Tramos en los que la cita ocupa a alguien: cada línea partida por su ventana
 * de procesado, más las limpiezas. Sin líneas, un bloque continuo.
 */
export function intervalosDeAgenda(
  startTime: string,
  endTime: string,
  lineas: LineaDeAgenda[]
): Intervalo[] {
  return repartoPorProfesional(startTime, endTime, lineas, TITULAR).flatMap(
    (o) => o.intervalos
  );
}

/** Hora hasta la que la cita ocupa a alguno de sus profesionales. */
export function finDeOcupacion(
  startTime: string,
  lineas: LineaDeAgenda[]
): string {
  const endTime = calculateEndTime(startTime, duracionDeCliente(lineas));

  return repartoPorProfesional(startTime, endTime, lineas, TITULAR).reduce(
    (ultimo, o) =>
      timeToMinutes(o.fin) > timeToMinutes(ultimo) ? o.fin : ultimo,
    endTime
  );
}

/** Indica si alguna pareja de intervalos de las dos listas se pisa. */
export function algunSolape(a: Intervalo[], b: Intervalo[]): boolean {
  return a.some((uno) =>
    b.some((otro) => timesOverlap(uno.inicio, uno.fin, otro.inicio, otro.fin))
  );
}

/** Titular ficticio: quien llama solo mira la cita entera. */
const TITULAR = "";

/** Tramos de una línea: uno solo, o dos si libera al profesional en medio. */
function intervalosDeLinea(
  linea: LineaDeAgenda,
  inicio: string,
  fin: string
): Intervalo[] {
  if (!tieneProcesado(linea)) return [{ inicio, fin }];

  const libreDesde = calculateEndTime(inicio, linea.procesadoDesde ?? 0);
  const libreHasta = calculateEndTime(libreDesde, linea.procesadoMinutos ?? 0);
  const intervalos: Intervalo[] = [];

  if (inicio !== libreDesde) intervalos.push({ inicio, fin: libreDesde });
  if (libreHasta !== fin) intervalos.push({ inicio: libreHasta, fin });

  return intervalos;
}

/** Minutos que tiene un día; una hora mayor pertenece ya al día siguiente. */
export const MINUTOS_DEL_DIA = 24 * 60;

/**
 * La parte de una ocupacion del dia anterior que cae en este dia, recortada al
 * arranque: de 23:30-"24:30" solo entra 00:00-00:30.
 */
export function arrastreDelDiaAnterior(intervalos: Intervalo[]): Intervalo[] {
  return intervalos
    .filter((i) => timeToMinutes(i.fin) > MINUTOS_DEL_DIA)
    .map((i) => ({
      inicio: minutosAHora(
        Math.max(0, timeToMinutes(i.inicio) - MINUTOS_DEL_DIA)
      ),
      fin: minutosAHora(timeToMinutes(i.fin) - MINUTOS_DEL_DIA),
    }));
}

/**
 * La parte de una jornada del dia anterior que cae en este dia: el negocio que
 * abre a las 20:00 y cierra a las "26:00" sigue abierto de 00:00 a 02:00.
 */
export function arrastreDeJornada<
  T extends { startTime: string; endTime: string },
>(tramos: T[]): T[] {
  return tramos
    .filter((t) => timeToMinutes(t.endTime) > MINUTOS_DEL_DIA)
    .map((t) => ({
      ...t,
      startTime: minutosAHora(
        Math.max(0, timeToMinutes(t.startTime) - MINUTOS_DEL_DIA)
      ),
      endTime: minutosAHora(timeToMinutes(t.endTime) - MINUTOS_DEL_DIA),
    }));
}

/** Día de la semana anterior, con la vuelta del domingo (0) al sábado (6). */
export function diaAnteriorDeLaSemana(dayOfWeek: number): number {
  return (dayOfWeek + 6) % 7;
}

/** Devuelve los minutos desde medianoche como "HH:MM". */
function minutosAHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
