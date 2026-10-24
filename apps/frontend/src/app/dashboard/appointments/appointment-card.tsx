"use client";

// Fila de una cita en la vista lista, con su estado y sus acciones.
import { memo } from "react";
import { Ban, CalendarClock, Check, CheckCircle2, UserX } from "lucide-react";
import { AccionesDeFila } from "@/components/ui/acciones-de-fila";
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
  // En movil el cuando y el estado van bajo el nombre del cliente.
  { label: "Cuándo", campo: "date", ocultaEnMovil: true },
  { label: "Profesional", ocultaEnMovil: true },
  { label: "Importe", alineacion: "right", ocultaEnMovil: true },
  { label: "Estado", ocultaEnMovil: true },
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
  const confirmable =
    appointment.status === "PENDING" && canConfirm && !yaEmpezo;
  const completable = canConfirm && cerrable;

  return (
    <FilaDeTabla
      acciones={
        <AccionesDeFila
          sobre={`la cita de ${clientName || "el cliente"}`}
          principal={
            /* Cada accion ocupa siempre su hueco; solo la principal lleva texto. */
            <span className="flex w-[104px] justify-end">
              {confirmable && (
                <Button size="sm" onClick={() => onConfirm(appointment.id)}>
                  Confirmar
                </Button>
              )}
              {completable && (
                <Button size="sm" onClick={() => onComplete(appointment)}>
                  Atendida
                </Button>
              )}
            </span>
          }
          acciones={[
            confirmable && {
              etiqueta: "Confirmar",
              descripcion: `Confirmar la cita de ${clientName || "el cliente"}`,
              icono: Check,
              alElegir: () => onConfirm(appointment.id),
              soloEnMenu: true,
            },
            completable && {
              etiqueta: "Atendida",
              descripcion: `Marcar como atendida la cita de ${clientName || "el cliente"}`,
              icono: CheckCircle2,
              alElegir: () => onComplete(appointment),
              soloEnMenu: true,
            },
            {
              etiqueta: "No asistió",
              descripcion: `Marcar que ${clientName || "el cliente"} no asistió`,
              icono: UserX,
              alElegir: () => onNoShow(appointment.id),
              visible: completable,
            },
            {
              etiqueta: "Reagendar",
              descripcion: `Reagendar la cita de ${clientName || "el cliente"}`,
              icono: CalendarClock,
              alElegir: () => onReschedule(appointment),
              visible: anulable && canReschedule,
            },
            // El rojo de cancelar aparece solo al apuntarla.
            {
              etiqueta: "Cancelar",
              descripcion: `Cancelar la cita de ${clientName || "el cliente"}`,
              icono: Ban,
              tono: "destructivo",
              alElegir: () => onCancel(appointment.id),
              visible: anulable && canCancel,
            },
          ]}
        />
      }
    >
      <CeldaPrincipal
        inicial={(clientName || "C").charAt(0)}
        titulo={clientName || "Cliente"}
        subtitulo={
          <>
            <span className="flex items-center gap-1.5 md:hidden">
              <span className="truncate">
                {formatDate(appointment.date)} ·{" "}
                {formatTime(appointment.startTime)}
              </span>
              <Badge variant={status.variant} className="shrink-0">
                {status.label}
              </Badge>
            </span>
            {appointment.status === "CANCELLED" && (
              <span className="flex items-start gap-1">
                <Ban className="mt-0.5 h-3 w-3 shrink-0" />
                <span>
                  {etiquetaDeMotivo(appointment.cancelReasonType)}
                  {appointment.cancelReason && `: ${appointment.cancelReason}`}
                  {appointment.cancelledAt &&
                    ` · ${formatDateTimeStamp(appointment.cancelledAt)}`}
                </span>
              </span>
            )}
          </>
        }
      />
      <CeldaDeTabla apagada ocultaEnMovil>
        {serviceNames || "—"}
      </CeldaDeTabla>
      <CeldaDeTabla apagada ocultaEnMovil>
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
      <CeldaDeTabla alineacion="right" className="font-semibold" ocultaEnMovil>
        {formatCurrency(appointment.totalAmount)}
      </CeldaDeTabla>
      <CeldaDeTabla ocultaEnMovil>
        <Badge variant={status.variant}>{status.label}</Badge>
      </CeldaDeTabla>
    </FilaDeTabla>
  );
});
