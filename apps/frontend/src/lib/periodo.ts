// Periodos con los que se consultan los reportes. La cuenta vive aqui, y no en
// la pantalla, porque es aritmetica de calendario y se puede comprobar sola.
import { toLocalDateKey } from "./utils";

/** Periodo cerrado, con los dos extremos incluidos, como lo espera la API. */
export interface Periodo {
  from: string;
  to: string;
}

/** Periodos que ofrece el selector, en el orden en que se listan. */
export type PeriodoId =
  | "hoy"
  | "ayer"
  | "semana"
  | "mes"
  | "mesPasado"
  | "ultimos30"
  | "anio"
  | "personalizado";

/** Etiqueta de cada periodo, tal como se lee en el selector. */
export const ETIQUETAS_DE_PERIODO: Record<PeriodoId, string> = {
  hoy: "Hoy",
  ayer: "Ayer",
  semana: "Esta semana",
  mes: "Este mes",
  mesPasado: "Mes pasado",
  ultimos30: "Últimos 30 días",
  anio: "Este año",
  personalizado: "Personalizado",
};

/**
 * Periodo con el que se abre la pantalla.
 *
 * El mes natural y no una ventana movil de treinta dias: el dueño factura, paga
 * nomina y declara por meses, asi que una cifra que empieza el dia 18 no cuadra
 * con ningun papel que tenga sobre la mesa.
 */
export const PERIODO_POR_DEFECTO: PeriodoId = "mes";

/** Dia de calendario resultante de sumar (o restar) dias a otro. */
function sumarDias(fecha: Date, dias: number): Date {
  const movida = new Date(fecha);
  movida.setDate(movida.getDate() + dias);
  return movida;
}

/**
 * Lunes de la semana de esa fecha.
 *
 * La semana empieza en lunes porque asi la cuenta un negocio de este sector:
 * el domingo es cierre o jornada corta, no apertura.
 */
function lunesDe(fecha: Date): Date {
  const dia = fecha.getDay();
  // getDay() da 0 para domingo, que pertenece a la semana que empezo hace seis.
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia);
}

/**
 * Resuelve un periodo con nombre a sus dos fechas.
 *
 * `personalizado` no se resuelve aqui: lo eligen dos campos de fecha, y hasta
 * que el usuario los rellena no hay periodo que calcular.
 */
export function resolverPeriodo(id: PeriodoId, hoy = new Date()): Periodo {
  const clave = (fecha: Date) => toLocalDateKey(fecha);
  const primeroDelMes = (fecha: Date) =>
    new Date(fecha.getFullYear(), fecha.getMonth(), 1);

  switch (id) {
    case "hoy":
      return { from: clave(hoy), to: clave(hoy) };
    case "ayer": {
      const ayer = clave(sumarDias(hoy, -1));
      return { from: ayer, to: ayer };
    }
    case "semana":
      return { from: clave(lunesDe(hoy)), to: clave(hoy) };
    case "mes":
      return { from: clave(primeroDelMes(hoy)), to: clave(hoy) };
    case "mesPasado": {
      const primeroDeEste = primeroDelMes(hoy);
      const ultimoDelPasado = sumarDias(primeroDeEste, -1);
      return {
        from: clave(primeroDelMes(ultimoDelPasado)),
        to: clave(ultimoDelPasado),
      };
    }
    case "ultimos30":
      // Veintinueve hacia atras, porque hoy tambien cuenta.
      return { from: clave(sumarDias(hoy, -29)), to: clave(hoy) };
    case "anio":
      return {
        from: clave(new Date(hoy.getFullYear(), 0, 1)),
        to: clave(hoy),
      };
    case "personalizado":
      return { from: clave(primeroDelMes(hoy)), to: clave(hoy) };
  }
}

/** Dias que abarca el periodo, extremos incluidos. */
export function diasDelPeriodo({ from, to }: Periodo): number {
  const unDia = 24 * 60 * 60 * 1000;
  const inicio = Date.parse(`${from}T00:00:00Z`);
  const fin = Date.parse(`${to}T00:00:00Z`);
  return Math.round((fin - inicio) / unDia) + 1;
}

/** Indica si el periodo tiene los dos extremos y no esta al reves. */
export function periodoValido({ from, to }: Periodo): boolean {
  return Boolean(from) && Boolean(to) && from <= to;
}

/**
 * Variacion porcentual de una cifra respecto a la del periodo anterior.
 *
 * Devuelve `null` cuando antes no habia nada: pasar de cero a cinco no es un
 * quinientos por ciento, es que antes no habia con que comparar, y una flecha
 * ahi solo confunde.
 */
export function variacion(
  ahora: number,
  antes: number | null | undefined
): number | null {
  if (antes == null || antes === 0) return null;
  return Math.round(((ahora - antes) / antes) * 100);
}

/** Texto del periodo para una cabecera o un nombre de archivo. */
export function nombreDelPeriodo({ from, to }: Periodo): string {
  return from === to ? from : `${from}_${to}`;
}
