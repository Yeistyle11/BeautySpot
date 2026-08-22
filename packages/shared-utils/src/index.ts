export * from "./zona-horaria";
export * from "./intervalos";
export * from "./texto-buscable";

/**
 * Genera un slug seguro para URLs a partir de un texto: minúsculas, sin acentos,
 * con guiones en lugar de caracteres no alfanuméricos y truncado a 100 caracteres.
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 100);
}

/** Oculta la mayor parte de un correo dejandolo reconocible en el log. */
export function ocultarCorreo(correo: string): string {
  const arroba = correo.indexOf("@");
  if (arroba <= 0) return "***";
  const inicial = correo[0];
  const dominio = correo.slice(arroba);
  return `${inicial}***${dominio}`;
}

/**
 * Página máxima aceptada. Sin tope, `?page=500000&limit=100` genera un OFFSET de
 * 50 millones que Postgres tiene que leer y descartar entero.
 */
export const MAX_PAGE = 1000;

/**
 * Normaliza los parámetros de paginación recibidos por query string: acota página
 * y límite a rangos válidos y solo admite ordenar por campos de la lista permitida.
 */
export function parsePaginationQuery(
  query: Record<string, unknown>,
  allowedSortFields: string[] = ["createdAt", "updatedAt"]
): {
  page: number;
  limit: number;
  offset: number;
  sort: string;
  order: "ASC" | "DESC";
  search?: string;
} {
  const page = Math.min(MAX_PAGE, Math.max(1, Number(query.page) || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const rawSort = typeof query.sort === "string" ? query.sort : "createdAt";
  const sort = allowedSortFields.includes(rawSort) ? rawSort : "createdAt";
  return {
    page,
    limit,
    offset: (page - 1) * limit,
    sort,
    order: query.order === "ASC" ? "ASC" : "DESC",
    search: typeof query.search === "string" ? query.search : undefined,
  };
}

/**
 * Genera los tramos horarios entre una hora de inicio y una de fin, cada uno de
 * `durationMinutes`. Devuelve un arreglo de cadenas "HH:MM".
 */
export function getTimeSlots(
  start: string,
  end: string,
  durationMinutes: number
): string[] {
  const slots: string[] = [];
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  let current = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  while (current + durationMinutes <= endTotal) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(
      `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
    );
    current += durationMinutes;
  }

  return slots;
}

/** Convierte una hora "HH:MM" al total de minutos desde medianoche. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Calcula la hora de fin "HH:MM" a partir de una hora de inicio y una duración en minutos. */
export function calculateEndTime(
  startTime: string,
  durationMinutes: number
): string {
  const total = timeToMinutes(startTime) + durationMinutes;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Minutos de un día completo; el reloj de pared nunca pasa de aquí. */
const MINUTOS_DE_UN_DIA = 24 * 60;

/**
 * Indica si el tramo termina ya en el dia siguiente, lo que se deduce de que
 * el fin venga antes que el inicio. Un tramo de ancho cero cuenta como cruce.
 */
export function cruzaMedianoche(inicio: string, fin: string): boolean {
  return timeToMinutes(fin) <= timeToMinutes(inicio);
}

/**
 * La hora de fin en la escala con la que se calcula: minutos desde la
 * medianoche del dia que abrio, que pasan de 24:00 cuando el tramo cruza.
 */
export function finExtendido(inicio: string, fin: string): string {
  if (!cruzaMedianoche(inicio, fin)) return fin;
  return minutosAHoraExtendida(timeToMinutes(fin) + MINUTOS_DE_UN_DIA);
}

/** La hora tal y como la marca el reloj de la pared: "24:30" es "00:30". */
export function horaDeReloj(hora: string): string {
  return minutosAHoraExtendida(timeToMinutes(hora) % MINUTOS_DE_UN_DIA);
}

/** "HH:MM" a partir de unos minutos, admitiendo horas por encima de 24. */
function minutosAHoraExtendida(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Indica si dos rangos horarios se solapan. Todas las horas en formato "HH:MM". */
export function timesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = timeToMinutes(start1),
    e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2),
    e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

/**
 * Deja un correo en su forma canónica para poder cotejarlo: sin espacios y en
 * minúsculas.
 */
export function normalizarEmail(email?: string | null): string {
  return email?.trim().toLowerCase() ?? "";
}

/**
 * Deja un telefono en su forma canonica para poder cotejarlo: solo digitos,
 * conservando el `+` inicial si lo trae.
 */
export function normalizarTelefono(telefono?: string | null): string {
  const texto = telefono?.trim() ?? "";
  if (!texto) return "";

  const digitos = texto.replace(/\D/g, "");
  if (!digitos) return "";

  return texto.startsWith("+") ? `+${digitos}` : digitos;
}

/** Escapa los comodines de SQL LIKE (%, _, \) para construir patrones ILIKE seguros. */
export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

/**
 * Moneda y formato con los que se presenta el dinero cuando el negocio no dice
 * otra cosa. `business.currency` y `business.locale` guardan los suyos, pero
 * hoy no llegan a quien imprime la factura ni a quien redacta el correo.
 */
export const MONEDA_POR_DEFECTO = "COP";
export const LOCALE_POR_DEFECTO = "es-CO";

/**
 * Presenta un importe como dinero, sin decimales. Es la única forma en que el
 * producto escribe una cifra de cara al cliente —el correo y el PDF de la
 * factura—, así que vive aquí y no en cada uno.
 */
export function formatearDinero(
  monto: number,
  opciones: { currency?: string; locale?: string } = {}
): string {
  const { currency = MONEDA_POR_DEFECTO, locale = LOCALE_POR_DEFECTO } =
    opciones;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(monto);
}
