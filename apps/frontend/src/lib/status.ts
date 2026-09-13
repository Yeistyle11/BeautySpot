// Etiqueta en espanol y clases de color de cada estado de cita, para los badges
// y para los chips densos del calendario.
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
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "accent"
  | "danger"
  | "muted";

export interface StatusInfo {
  label: string;
  /** Variante del Badge con la que se pinta el estado. */
  variant: BadgeVariant;
  /**
   * Chip denso del calendario, mas saturado y con borde, con los seis tonos
   * crudos y su variante oscura.
   */
  /** Clases del chip del calendario, derivadas del token del estado. */
  calendarColor: string;
}

const APPOINTMENT_STATUS: Record<AppointmentStatus, StatusInfo> = {
  PENDING: {
    label: "Pendiente",
    variant: "warning",
    calendarColor:
      "bg-warning-chip border-warning-chip-border text-warning-chip-foreground",
  },
  CONFIRMED: {
    label: "Confirmada",
    variant: "info",
    calendarColor:
      "bg-info-chip border-info-chip-border text-info-chip-foreground",
  },
  IN_PROGRESS: {
    label: "En proceso",
    variant: "accent",
    calendarColor:
      "bg-accent-chip border-accent-chip-border text-accent-chip-foreground",
  },
  COMPLETED: {
    label: "Completada",
    variant: "success",
    calendarColor:
      "bg-success-chip border-success-chip-border text-success-chip-foreground",
  },
  CANCELLED: {
    label: "Cancelada",
    variant: "danger",
    calendarColor:
      "bg-danger-chip border-danger-chip-border text-danger-chip-foreground",
  },
  NO_SHOW: {
    label: "No asistió",
    variant: "muted",
    calendarColor:
      "bg-neutro-chip border-neutro-chip-border text-neutro-chip-foreground",
  },
};

const DEFAULT_STATUS: StatusInfo = {
  label: "Desconocido",
  variant: "muted",
  calendarColor:
    "bg-neutro-chip border-neutro-chip-border text-neutro-chip-foreground",
};

/** Devuelve la presentación (etiqueta y colores) de un estado de cita; usa un valor por defecto si es desconocido. */
export function getAppointmentStatus(status: string): StatusInfo {
  return APPOINTMENT_STATUS[status as AppointmentStatus] ?? DEFAULT_STATUS;
}
