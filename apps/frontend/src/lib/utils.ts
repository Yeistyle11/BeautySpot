import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina clases condicionales (clsx) y resuelve conflictos de Tailwind (twMerge). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formatea un monto como moneda colombiana (COP) sin decimales. */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Formatea una fecha "YYYY-MM-DD" o ISO como "5 mar 2026" en locale es-CO. */
export function formatDate(date: string): string {
  // Las fechas sin hora ("YYYY-MM-DD") se parsean como medianoche UTC; sin
  // el mediodia fijo, en timezones negativos se mostraria el dia anterior.
  const parsed = date.includes("T")
    ? new Date(date)
    : new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Fecha corta "5 mar", para ejes y etiquetas donde el ano se sobreentiende y no
 * cabe la fecha completa.
 */
export function formatDayMonth(date: string): string {
  const parsed = date.includes("T")
    ? new Date(date)
    : new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  });
}

// Clave "YYYY-MM-DD" en horario local. `toISOString()` convierte a UTC, asi
// que en timezones negativos (es-CO, UTC-5) a partir de las 19:00 devolveria
// ya el dia siguiente y descuadraria el agrupamiento por dia.
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Indica si una cita ("YYYY-MM-DD" + "HH:MM") ya ha empezado.
 *
 * Ambos formatos son de ancho fijo y con ceros a la izquierda, asi que
 * compararlos como texto ordena igual que compararlos como instantes, y evita
 * construir una fecha que el navegador interpretaria en su propio huso.
 */
export function haComenzado(date: string, startTime: string): boolean {
  const ahora = new Date();
  const hora = `${String(ahora.getHours()).padStart(2, "0")}:${String(
    ahora.getMinutes()
  ).padStart(2, "0")}`;
  return `${date} ${startTime}` <= `${toLocalDateKey(ahora)} ${hora}`;
}

/** Convierte una hora "HH:MM" (24h) a formato de 12h con am/pm. */
export function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "pm" : "am";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

/** Combina fecha y hora ya formateadas en una sola cadena legible. */
export function formatDateTime(date: string, time: string): string {
  return `${formatDate(date)} ${formatTime(time)}`;
}

/** Formatea un timestamp ISO como fecha + hora local (es-CO). */
export function formatDateTimeStamp(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formatea solo la hora (HH:MM local) de un timestamp ISO. */
export function formatTimeStamp(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Años de experiencia en singular o plural: "1 año", "4 años". */
export function formatAniosExperiencia(anios: number): string {
  return `${anios} ${anios === 1 ? "año" : "años"} de experiencia`;
}

/** Extrae un mensaje legible de un error de tipo desconocido, con texto de reserva. */
export function getErrorMessage(err: unknown, fallback = "Error"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
}
