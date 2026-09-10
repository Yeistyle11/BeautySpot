/**
 * Fechas de la siembra. Todo el escenario transcurre en `America/Bogota`, la
 * zona por defecto de un negocio, y Colombia no cambia la hora: por eso el
 * desfase se escribe fijo y una fecha suelta basta para volverse instante.
 */

const DESFASE_BOGOTA = "-05:00";

/** El día de hoy en Bogotá, en `YYYY-MM-DD`. */
export function hoy(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** La fecha desplazada los días que se indiquen; en negativo, hacia atrás. */
export function sumarDias(fecha: string, dias: number): string {
  const base = new Date(`${fecha}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Día de la semana de una fecha, con el 0 en domingo, como `BusinessHours`. */
export function diaDeLaSemana(fecha: string): number {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay();
}

/** Instante exacto de una fecha y una hora de pared bogotanas. */
export function instante(fecha: string, hora: string): Date {
  return new Date(`${fecha}T${hora}:00${DESFASE_BOGOTA}`);
}

/** `HH:MM` a minutos desde medianoche. */
export function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/** Minutos desde medianoche a `HH:MM`. */
export function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Los días entre dos fechas, ambos incluidos. */
export function rangoDeDias(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) dias.push(f);
  return dias;
}
