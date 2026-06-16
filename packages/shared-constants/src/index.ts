import { Role, AppointmentStatus, PaymentMethod, BusinessType } from "@beautyspot/shared-types";

export const APP_NAME = "BeautySpot" as const;
export const APP_DESCRIPTION = "Plataforma de gestión para barberías y centros de belleza" as const;
export const DEFAULT_CURRENCY = "COP" as const;
export const DEFAULT_LOCALE = "es-CO" as const;

export const ROLES: Record<Role, { label: string; description: string }> = {
  SUPER_ADMIN: { label: "Super Admin", description: "Administrador de la plataforma" },
  OWNER: { label: "Dueño", description: "Dueño del negocio con acceso total" },
  ADMIN: { label: "Administrador", description: "Administrador del negocio" },
  PROFESSIONAL: { label: "Profesional", description: "Barbero, estilista o técnico" },
  RECEPTIONIST: { label: "Recepcionista", description: "Gestión de citas y clientes" },
  CLIENT: { label: "Cliente", description: "Cliente final" },
};

export const APPOINTMENT_STATUSES: Record<AppointmentStatus, { label: string; color: string }> = {
  PENDING: { label: "Pendiente", color: "#F59E0B" },
  CONFIRMED: { label: "Confirmada", color: "#10B981" },
  IN_PROGRESS: { label: "En Progreso", color: "#3B82F6" },
  COMPLETED: { label: "Completada", color: "#6366F1" },
  CANCELLED: { label: "Cancelada", color: "#EF4444" },
  NO_SHOW: { label: "No Asistió", color: "#6B7280" },
};

export const SERVICE_CATEGORIES = [
  "Cortes",
  "Barba",
  "Paquetes",
  "Tratamientos",
  "Otros",
] as const;

export const PROFESSIONAL_CATEGORIES = [
  "Barbero",
  "Estilista",
  "Colorista",
  "Manicurista",
  "Pedicurista",
  "Maquillador",
  "Cosmetólogo",
  "Masajista",
  "Barbero Senior",
  "Estilista Senior",
  "Otro",
] as const;

export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; icon: string }> = {
  CASH: { label: "Efectivo", icon: "banknote" },
  CARD: { label: "Tarjeta", icon: "credit-card" },
  TRANSFER: { label: "Transferencia", icon: "arrow-right-left" },
  OTHER: { label: "Otro", icon: "circle-dot" },
};

export const BUSINESS_TYPES: Record<BusinessType, { label: string; icon: string }> = {
  BARBERIA: { label: "Barbería", icon: "scissors" },
  SALON_BELLEZA: { label: "Salón de Belleza", icon: "sparkles" },
  SPA: { label: "Spa", icon: "leaf" },
  CENTRO_ESTETICO: { label: "Centro Estético", icon: "heart" },
  UNISEX: { label: "Unisex", icon: "users" },
};

export const DAYS_OF_WEEK = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

// ─── Configuración de negocio ──────────────────────────────────────

export const LOYALTY_POINTS_RATE = 0.10;
export const DASHBOARD_DEFAULT_DAYS = 30;
export const DASHBOARD_DEFAULT_TOP_PROFESSIONALS = 10;
export const HISTORY_DEFAULT_LIMIT = 50;
export const PROXY_TIMEOUT_MS = 10_000;

// ─── Rate Limiting ─────────────────────────────────────────────────

export const RATE_LIMIT_AUTH_REQUESTS = 5;
export const RATE_LIMIT_GENERAL_REQUESTS = 100;
export const RATE_LIMIT_WINDOW_SECONDS = 60;

export enum ErrorCode {
  AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS",
  AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED",
  AUTH_UNAUTHORIZED = "AUTH_UNAUTHORIZED",
  AUTH_FORBIDDEN = "AUTH_FORBIDDEN",
  AUTH_USER_NOT_FOUND = "AUTH_USER_NOT_FOUND",
  AUTH_USER_ALREADY_EXISTS = "AUTH_USER_ALREADY_EXISTS",
  AUTH_INVALID_REFRESH_TOKEN = "AUTH_INVALID_REFRESH_TOKEN",
  BUSINESS_NOT_FOUND = "BUSINESS_NOT_FOUND",
  BUSINESS_SLUG_EXISTS = "BUSINESS_SLUG_EXISTS",
  BRANCH_NOT_FOUND = "BRANCH_NOT_FOUND",
  PROFESSIONAL_NOT_FOUND = "PROFESSIONAL_NOT_FOUND",
  SERVICE_NOT_FOUND = "SERVICE_NOT_FOUND",
  CLIENT_NOT_FOUND = "CLIENT_NOT_FOUND",
  APPOINTMENT_NOT_FOUND = "APPOINTMENT_NOT_FOUND",
  APPOINTMENT_SLOT_UNAVAILABLE = "APPOINTMENT_SLOT_UNAVAILABLE",
  APPOINTMENT_CANNOT_CANCEL = "APPOINTMENT_CANNOT_CANCEL",
  APPOINTMENT_INVALID_STATUS = "APPOINTMENT_INVALID_STATUS",
  PAYMENT_NOT_FOUND = "PAYMENT_NOT_FOUND",
  INVOICE_NOT_FOUND = "INVOICE_NOT_FOUND",
  CASH_SESSION_ALREADY_OPEN = "CASH_SESSION_ALREADY_OPEN",
  CASH_SESSION_NOT_FOUND = "CASH_SESSION_NOT_FOUND",
  CASH_SESSION_ALREADY_CLOSED = "CASH_SESSION_ALREADY_CLOSED",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NOT_FOUND = "NOT_FOUND",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  TENANT_NOT_FOUND = "TENANT_NOT_FOUND",
}
