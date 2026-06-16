/**
 * Format a number as currency using Intl.NumberFormat.
 */
export function formatCurrency(
  amount: number,
  currency = "COP",
  locale = "es-CO",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a Date as a long date string in Spanish.
 */
export function formatDate(date: Date | string, locale = "es-CO"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

/**
 * Convert "HH:MM" to 12-hour AM/PM format.
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Convert minutes to human-readable duration ("1h 30min", "45 min").
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining > 0 ? `${hours}h ${remaining}min` : `${hours}h`;
}

/**
 * Generate a URL-safe slug from text.
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .substring(0, 100);
}

/** Basic email format check. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Basic phone format check (accepts digits, spaces, dashes, parentheses, +). */
export function isValidPhone(phone: string): boolean {
  return /^[+\d\s\-()]{7,20}$/.test(phone);
}

/** Check password strength: min 8 chars, at least 1 uppercase, 1 number. */
export function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password);
}

/** Get JavaScript day of week (0=Sun, 6=Sat) from a Date. */
export function getDayOfWeek(date: Date): number {
  return date.getDay();
}

/** Check if two dates are the same calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Add minutes to a Date and return a new Date. */
export function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

/**
 * Generate time slots between start and end times.
 * Returns array of "HH:MM" strings.
 */
export function getTimeSlots(
  start: string,
  end: string,
  durationMinutes: number,
): string[] {
  const slots: string[] = [];
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  let current = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  while (current + durationMinutes <= endTotal) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    current += durationMinutes;
  }

  return slots;
}

/** Parse pagination parameters from a query object. */
export function parsePaginationQuery(
  query: Record<string, unknown>,
  allowedSortFields: string[] = ["createdAt", "updatedAt"],
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

/** Custom application error with HTTP status code. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = "INTERNAL_ERROR",
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** Convert "HH:MM" to total minutes. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Calculate end time given a start time "HH:MM" and duration in minutes. */
export function calculateEndTime(startTime: string, durationMinutes: number): string {
  const total = timeToMinutes(startTime) + durationMinutes;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/** Check if two time ranges overlap. All times in "HH:MM" format. */
export function timesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  const s1 = timeToMinutes(start1), e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2), e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

/** Escape SQL LIKE wildcards (%, _, \) for safe ILIKE patterns. */
export function escapeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

/** Calculate distance in km between two geographic points using the Haversine formula. */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
