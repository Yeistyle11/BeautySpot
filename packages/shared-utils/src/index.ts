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
  const page = Math.max(1, Number(query.page) || 1);
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

/** Escapa los comodines de SQL LIKE (%, _, \) para construir patrones ILIKE seguros. */
export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}
