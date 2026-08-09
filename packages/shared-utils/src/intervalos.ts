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

/** Hora hasta la que sigue ocupado: el fin más la limpieza de la última línea. */
export function finDeOcupacion(
  startTime: string,
  lineas: LineaDeAgenda[]
): string {
  const fin = calculateEndTime(startTime, duracionDeCliente(lineas));
  if (lineas.length === 0) return fin;

  const ultima = [...lineas].sort(porOrden)[lineas.length - 1];
  return calculateEndTime(fin, ultima.bufferDespues ?? 0);
}

/**
 * Tramos en los que el profesional está ocupado: cada línea partida por su
 * ventana de procesado, más la limpieza final. Sin líneas, un bloque continuo.
 */
export function intervalosDeAgenda(
  startTime: string,
  endTime: string,
  lineas: LineaDeAgenda[]
): Intervalo[] {
  if (lineas.length === 0) return [{ inicio: startTime, fin: endTime }];

  const intervalos: Intervalo[] = [];
  let minuto = timeToMinutes(startTime);

  for (const linea of [...lineas].sort(porOrden)) {
    const inicio = minutosAHora(minuto);
    const fin = calculateEndTime(inicio, linea.duration);

    if (tieneProcesado(linea)) {
      const libreDesde = calculateEndTime(inicio, linea.procesadoDesde ?? 0);
      const libreHasta = calculateEndTime(
        libreDesde,
        linea.procesadoMinutos ?? 0
      );
      if (inicio !== libreDesde) {
        intervalos.push({ inicio, fin: libreDesde });
      }
      if (libreHasta !== fin) {
        intervalos.push({ inicio: libreHasta, fin });
      }
    } else {
      intervalos.push({ inicio, fin });
    }

    minuto += linea.duration;
  }

  const finConBuffer = finDeOcupacion(startTime, lineas);
  const finDeCliente = minutosAHora(minuto);
  if (finConBuffer !== finDeCliente) {
    intervalos.push({ inicio: finDeCliente, fin: finConBuffer });
  }

  return intervalos;
}

/** Indica si alguna pareja de intervalos de las dos listas se pisa. */
export function algunSolape(a: Intervalo[], b: Intervalo[]): boolean {
  return a.some((uno) =>
    b.some((otro) => timesOverlap(uno.inicio, uno.fin, otro.inicio, otro.fin))
  );
}

/** Devuelve los minutos desde medianoche como "HH:MM". */
function minutosAHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
