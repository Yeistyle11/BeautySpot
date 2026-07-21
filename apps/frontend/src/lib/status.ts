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
  variant: BadgeVariant;
}

const APPOINTMENT_STATUS: Record<AppointmentStatus, StatusInfo> = {
  PENDING: {
    label: "Pendiente",
    color: "bg-yellow-100 text-yellow-800",
    variant: "warning",
  },
  CONFIRMED: {
    label: "Confirmada",
    color: "bg-blue-100 text-blue-800",
    variant: "success",
  },
  IN_PROGRESS: {
    label: "En proceso",
    color: "bg-purple-100 text-purple-800",
    variant: "default",
  },
  COMPLETED: {
    label: "Completada",
    color: "bg-green-100 text-green-800",
    variant: "secondary",
  },
  CANCELLED: {
    label: "Cancelada",
    color: "bg-red-100 text-red-800",
    variant: "destructive",
  },
  NO_SHOW: {
    label: "No asistio",
    color: "bg-gray-100 text-gray-800",
    variant: "secondary",
  },
};

const DEFAULT_STATUS: StatusInfo = {
  label: "Desconocido",
  color: "bg-gray-100 text-gray-800",
  variant: "secondary",
};

export function getAppointmentStatus(status: string): StatusInfo {
  return APPOINTMENT_STATUS[status as AppointmentStatus] ?? DEFAULT_STATUS;
}
