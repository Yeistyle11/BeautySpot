export const APP_NAME = "Elite Barbershop";
export const APP_DESCRIPTION = "Sistema moderno de gestión para barberías";

export const ROLES = {
  ADMIN: "ADMIN",
  BARBER: "BARBER",
  CLIENT: "CLIENT",
} as const;

export const APPOINTMENT_STATUS = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
} as const;

export const SERVICE_CATEGORIES = [
  "Cortes",
  "Barba",
  "Paquetes",
  "Tratamientos",
  "Otros",
] as const;

export const DAYS_OF_WEEK = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;
