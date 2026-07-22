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
