"use client";

// Fila de una cita en la vista lista, con su estado y sus acciones.
import { memo } from "react";
import { Ban, CalendarClock, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FilaDeTabla,
  CeldaDeTabla,
  CeldaPrincipal,
  type ColumnaDeTabla,
} from "@/components/ui/tabla-de-registros";
import {
  formatCurrency,
  formatDate,
  formatDateTimeStamp,
  formatTime,
  haComenzado,
} from "@/lib/utils";
import { getAppointmentStatus } from "@/lib/status";
import { etiquetaDeMotivo, type Appointment } from "./schemas";

/** Columnas de la vista lista. El orden lo resuelve el servidor. */
export const COLUMNAS_DE_AGENDA: ColumnaDeTabla<"date">[] = [
  { label: "Cliente" },
  { label: "Servicio", ocultaEnMovil: true },
  { label: "Cuándo", campo: "date" },
  { label: "Profesional", ocultaEnMovil: true },
  { label: "Importe", alineacion: "right" },
  { label: "Estado" },
];

interface AppointmentCardProps {
  appointment: Appointment;
  professionalName: string;
  /** Nombre del cliente; el listado de citas solo trae su id. */
  clientName?: string;
  canConfirm: boolean;
  canCancel: boolean;
  canReschedule: boolean;
  onConfirm: (id: string) => void;
  onComplete: (appointment: Appointment) => void;
  onCancel: (id: string) => void;
  onNoShow: (id: string) => void;
  onReschedule: (appointment: Appointment) => void;
}

/** Estados desde los que la cita todavia puede anularse. */
const ANULABLES = ["PENDING", "CONFIRMED"];

/** Fila de una cita en la agenda, con las acciones que permita su estado. */
export const AppointmentCard = memo(function AppointmentCard({
  appointment,
  professionalName,
  clientName,
  canConfirm,
  canCancel,
  canReschedule,
  onConfirm,
  onComplete,
  onCancel,
  onNoShow,
  onReschedule,
}: AppointmentCardProps) {
  const status = getAppointmentStatus(appointment.status);
  const serviceNames = appointment.appointmentServices
    .map((s) => s.serviceName)
    .join(", ");
  const yaEmpezo = haComenzado(appointment.date, appointment.startTime);
  // Una cita que ya empezó se cierra como "Atendida" o "No asistió".
  const cerrable =
    yaEmpezo &&
    (appointment.status === "PENDING" || appointment.status === "CONFIRMED");
  const anulable = ANULABLES.includes(appointment.status);

  return (
    <FilaDeTabla
      acciones={
        /* Cada accion ocupa siempre su hueco; solo la principal lleva texto. */
        <>
          <span className="flex w-[104px] justify-end">
            {appointment.status === "PENDING" && canConfirm && !yaEmpezo && (
              <Button size="sm" onClick={() => onConfirm(appointment.id)}>
                Confirmar
              </Button>
            )}
            {canConfirm && cerrable && (
              <Button size="sm" onClick={() => onComplete(appointment)}>
                Atendida
              </Button>
            )}
          </span>

          <span className="flex h-8 w-8 items-center justify-center">
            {canConfirm && cerrable && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => onNoShow(appointment.id)}
                aria-label={`Marcar que ${clientName || "el cliente"} no asistió`}
                title="No asistió"
              >
                <UserX className="h-4 w-4" />
              </Button>
            )}
          </span>

          <span className="flex h-8 w-8 items-center justify-center">
            {anulable && canReschedule && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => onReschedule(appointment)}
                aria-label={`Reagendar la cita de ${clientName || "el cliente"}`}
                title="Reagendar"
              >
                <CalendarClock className="h-4 w-4" />
              </Button>
            )}
          </span>

          {/* El rojo de cancelar aparece solo al apuntarla. */}
          <span className="flex h-8 w-8 items-center justify-center">
            {anulable && canCancel && (
              <Button
                size="icon"
                variant="ghost"
                className="hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                onClick={() => onCancel(appointment.id)}
                aria-label={`Cancelar la cita de ${clientName || "el cliente"}`}
                title="Cancelar"
              >
                <Ban className="h-4 w-4" />
              </Button>
            )}
          </span>
        </>
      }
    >
      <CeldaPrincipal
        inicial={(clientName || "C").charAt(0)}
        titulo={clientName || "Cliente"}
        subtitulo={
          appointment.status === "CANCELLED" ? (
            <span className="flex items-start gap-1">
              <Ban className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                {etiquetaDeMotivo(appointment.cancelReasonType)}
                {appointment.cancelReason && `: ${appointment.cancelReason}`}
                {appointment.cancelledAt &&
                  ` · ${formatDateTimeStamp(appointment.cancelledAt)}`}
              </span>
            </span>
          ) : undefined
        }
      />
      <CeldaDeTabla apagada ocultaEnMovil>
        {serviceNames || "—"}
      </CeldaDeTabla>
      <CeldaDeTabla apagada>
        <span className="whitespace-nowrap">
          {formatDate(appointment.date)}
        </span>
        <span className="block whitespace-nowrap text-xs">
          {formatTime(appointment.startTime)} –{" "}
          {formatTime(appointment.endTime)}
        </span>
      </CeldaDeTabla>
      <CeldaDeTabla apagada ocultaEnMovil>
        {professionalName}
      </CeldaDeTabla>
      <CeldaDeTabla alineacion="right" className="font-semibold">
        {formatCurrency(appointment.totalAmount)}
      </CeldaDeTabla>
      <CeldaDeTabla>
        <Badge variant={status.variant}>{status.label}</Badge>
      </CeldaDeTabla>
    </FilaDeTabla>
  );
});
