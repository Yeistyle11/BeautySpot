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
  calendarColor: string;
}

const APPOINTMENT_STATUS: Record<AppointmentStatus, StatusInfo> = {
  PENDING: {
    label: "Pendiente",
    variant: "warning",
    calendarColor:
      "bg-yellow-200 border-yellow-400 text-yellow-900 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-100",
  },
  CONFIRMED: {
    label: "Confirmada",
    variant: "info",
    calendarColor:
      "bg-blue-200 border-blue-400 text-blue-900 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-100",
  },
  IN_PROGRESS: {
    label: "En proceso",
    variant: "accent",
    calendarColor:
      "bg-purple-200 border-purple-400 text-purple-900 dark:bg-purple-900 dark:border-purple-700 dark:text-purple-100",
  },
  COMPLETED: {
    label: "Completada",
    variant: "success",
    calendarColor:
      "bg-green-200 border-green-400 text-green-900 dark:bg-green-900 dark:border-green-700 dark:text-green-100",
  },
  CANCELLED: {
    label: "Cancelada",
    variant: "danger",
    calendarColor:
      "bg-red-200 border-red-400 text-red-900 dark:bg-red-900 dark:border-red-700 dark:text-red-100",
  },
  NO_SHOW: {
    label: "No asistió",
    variant: "muted",
    calendarColor:
      "bg-gray-200 border-gray-400 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200",
  },
};

const DEFAULT_STATUS: StatusInfo = {
  label: "Desconocido",
  variant: "muted",
  calendarColor:
    "bg-gray-200 border-gray-400 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200",
};

/** Devuelve la presentación (etiqueta y colores) de un estado de cita; usa un valor por defecto si es desconocido. */
export function getAppointmentStatus(status: string): StatusInfo {
  return APPOINTMENT_STATUS[status as AppointmentStatus] ?? DEFAULT_STATUS;
}
