import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(amount);
}

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

// Clave "YYYY-MM-DD" en horario local. `toISOString()` convierte a UTC, asi
// que en timezones negativos (es-CO, UTC-5) a partir de las 19:00 devolveria
// ya el dia siguiente y descuadraria el agrupamiento por dia.
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "pm" : "am";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export function formatDateTime(date: string, time: string): string {
  return `${formatDate(date)} ${formatTime(time)}`;
}

export function formatDateTimeStamp(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTimeStamp(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getErrorMessage(err: unknown, fallback = "Error"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return fallback;
}
