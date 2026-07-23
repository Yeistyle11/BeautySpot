export type AppointmentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "warning"
  | "outline";

export interface StatusInfo {
  label: string;
  color: string;
  /** Variante mas saturada y con borde, para los chips densos del calendario. */
  calendarColor: string;
  variant: BadgeVariant;
}

const APPOINTMENT_STATUS: Record<AppointmentStatus, StatusInfo> = {
  PENDING: {
    label: "Pendiente",
    color: "bg-warning-soft text-warning-soft-foreground",
    calendarColor: "bg-yellow-200 border-yellow-400 text-yellow-900",
    variant: "warning",
  },
  CONFIRMED: {
    label: "Confirmada",
    color: "bg-info-soft text-info-soft-foreground",
    calendarColor: "bg-blue-200 border-blue-400 text-blue-900",
    variant: "success",
  },
  IN_PROGRESS: {
    label: "En proceso",
    color: "bg-primary/10 text-primary",
    calendarColor: "bg-purple-200 border-purple-400 text-purple-900",
    variant: "default",
  },
  COMPLETED: {
    label: "Completada",
    color: "bg-success-soft text-success-soft-foreground",
    calendarColor: "bg-green-200 border-green-400 text-green-900",
    variant: "secondary",
  },
  CANCELLED: {
    label: "Cancelada",
    color: "bg-destructive/10 text-destructive",
    calendarColor: "bg-red-200 border-red-400 text-red-900",
    variant: "destructive",
  },
  NO_SHOW: {
    label: "No asistio",
    color: "bg-muted text-muted-foreground",
    calendarColor: "bg-gray-200 border-gray-400 text-gray-700",
    variant: "secondary",
  },
};

const DEFAULT_STATUS: StatusInfo = {
  label: "Desconocido",
  color: "bg-muted text-muted-foreground",
  calendarColor: "bg-gray-200 border-gray-400 text-gray-700",
  variant: "secondary",
};

export function getAppointmentStatus(status: string): StatusInfo {
  return APPOINTMENT_STATUS[status as AppointmentStatus] ?? DEFAULT_STATUS;
}
