import type { AppointmentStatus } from "@prisma/client";

type StatusString = AppointmentStatus | string;

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  NO_SHOW: "bg-gray-100 text-gray-800",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asistió",
};

export function getStatusColor(status: StatusString): string {
  return STATUS_COLORS[status] ?? "bg-gray-100 text-gray-800";
}

export function getStatusText(status: StatusString): string {
  return STATUS_LABELS[status] ?? status;
}
