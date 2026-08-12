/** Lectura del reloj de pared de una zona horaria y conversión a instantes. */

/** Zona que se usa cuando no se conoce la del negocio. */
export const ZONA_POR_DEFECTO = "America/Bogota";

/** Formato de una hora de pared `HH:mm`, de 00:00 a 23:59. */
export const PATRON_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Indica si el texto es una hora de pared válida en formato `HH:mm`. */
export function esHoraValida(hora: string): boolean {
  return PATRON_HORA.test(hora);
}

/**
 * Formato de una hora de cierre `HH:mm`, de 00:00 a 31:59.
 *
 * Un negocio que cierra de madrugada lo hace en la jornada del día que abrió,
 * así que su hora de cierre se cuenta desde la medianoche de *ese* día y pasa de
 * las 24:00: un bar de barbería que cierra a las 2 de la mañana cierra a las
 * 26:00. El tope de las 31:59 son ocho horas de madrugada, suficientes para
 * cualquier jornada real y lo bastante bajo como para que un dedazo no abra un
 * tramo de varios días.
 */
export const PATRON_HORA_DE_CIERRE = /^([0-2]\d|3[01]):[0-5]\d$/;

/** Indica si el texto es una hora de cierre válida, madrugada incluida. */
export function esHoraDeCierreValida(hora: string): boolean {
  return PATRON_HORA_DE_CIERRE.test(hora);
}

/** Formateadores ya construidos, indexados por zona. */
const formateadores = new Map<string, Intl.DateTimeFormat>();

/** Formateador de la zona, reutilizado entre llamadas. */
function formateadorDe(zona: string): Intl.DateTimeFormat {
  const guardado = formateadores.get(zona);
  if (guardado) return guardado;

  const formateador = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  formateadores.set(zona, formateador);
  return formateador;
}

/** Descompone un instante en las partes numéricas que se ven en esa zona. */
function partesEn(
  zona: string,
  instante: Date
): {
  año: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
} {
  const partes = formateadorDe(zona).formatToParts(instante);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(partes.find((p) => p.type === tipo)?.value ?? "0");

  return {
    año: valor("year"),
    mes: valor("month"),
    dia: valor("day"),
    hora: valor("hour"),
    minuto: valor("minute"),
    segundo: valor("second"),
  };
}

/** Rellena a dos dígitos, que es como se guardan fechas y horas. */
function dos(n: number): string {
  return String(n).padStart(2, "0");
}

/** Fecha `YYYY-MM-DD` y hora `HH:mm` que marca el reloj de esa zona. */
export function ahoraEnLaZona(
  zona: string = ZONA_POR_DEFECTO,
  instante: Date = new Date()
): { fecha: string; hora: string } {
  const p = partesEn(zona, instante);
  return {
    fecha: `${p.año}-${dos(p.mes)}-${dos(p.dia)}`,
    hora: `${dos(p.hora)}:${dos(p.minuto)}`,
  };
}

/** Día de calendario en curso en esa zona, en formato `YYYY-MM-DD`. */
export function fechaDeHoyEn(
  zona: string = ZONA_POR_DEFECTO,
  instante: Date = new Date()
): string {
  return ahoraEnLaZona(zona, instante).fecha;
}

/** Indica si la fecha de calendario es anterior al día en curso en esa zona. */
export function esFechaPasadaEn(zona: string, fecha: string): boolean {
  return fecha < fechaDeHoyEn(zona);
}

/** Indica si el instante de pared ya pasó en esa zona. */
export function esInstantePasadoEn(
  zona: string,
  fecha: string,
  hora: string
): boolean {
  const ahora = ahoraEnLaZona(zona);
  return `${fecha} ${hora}` < `${ahora.fecha} ${ahora.hora}`;
}

/** Minutos que esa zona lleva de adelanto sobre UTC en ese instante. */
function desfaseEnMinutos(zona: string, instante: Date): number {
  const p = partesEn(zona, instante);
  const comoSiFueraUtc = Date.UTC(
    p.año,
    p.mes - 1,
    p.dia,
    p.hora,
    p.minuto,
    p.segundo
  );
  // El formateador solo llega al segundo; el instante se trunca igual.
  return (
    (comoSiFueraUtc - Math.floor(instante.getTime() / 1000) * 1000) / 60000
  );
}

/** Convierte una hora de pared de esa zona en el instante que le corresponde. */
export function instanteDe(zona: string, fecha: string, hora: string): Date {
  const comoUtc = Date.parse(`${fecha}T${hora}:00Z`);
  if (Number.isNaN(comoUtc)) {
    throw new RangeError(`Fecha u hora inválidas: ${fecha} ${hora}`);
  }

  // Dos pasadas: el desfase depende del instante, y en el día del cambio de
  // horario la primera cae al otro lado del salto.
  let instante = new Date(comoUtc);
  for (let intento = 0; intento < 2; intento++) {
    instante = new Date(comoUtc - desfaseEnMinutos(zona, instante) * 60000);
  }
  return instante;
}

/** Día siguiente a la fecha dada, en formato `YYYY-MM-DD`. */
export function diaSiguiente(fecha: string): string {
  const dia = new Date(`${fecha}T00:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + 1);
  return dia.toISOString().slice(0, 10);
}

/** Día anterior a la fecha dada, en formato `YYYY-MM-DD`. */
export function diaAnterior(fecha: string): string {
  const dia = new Date(`${fecha}T00:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() - 1);
  return dia.toISOString().slice(0, 10);
}
