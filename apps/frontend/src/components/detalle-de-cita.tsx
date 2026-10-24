"use client";

// Ficha de la cita elegida en el dia o en la semana, con sus acciones.
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatTime, haComenzado } from "@/lib/utils";
import { getAppointmentStatus } from "@/lib/status";
import type { Appointment } from "@/app/dashboard/appointments/schemas";

/** Estados desde los que la cita todavia puede anularse. */
const ANULABLES = ["PENDING", "CONFIRMED"];

interface DetalleDeCitaProps {
  cita: Appointment;
  cliente: string;
  /** Los servicios, ya escritos como se quieren leer. */
  servicios: string;
  canConfirm: boolean;
  canCancel: boolean;
  onComplete: (appt: Appointment) => void;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onNoShow: (id: string) => void;
}

/**
 * Datos de la cita y las acciones que permite su estado. En movil las acciones
 * bajan debajo de los datos y se reparten el ancho.
 */
export function DetalleDeCita({
  cita,
  cliente,
  servicios,
  canConfirm,
  canCancel,
  onComplete,
  onConfirm,
  onCancel,
  onNoShow,
}: DetalleDeCitaProps) {
  const estado = getAppointmentStatus(cita.status);
  const cerrable =
    cita.status === "CONFIRMED" &&
    canConfirm &&
    haComenzado(cita.date, cita.startTime);

  return (
    <div className="bg-muted/30 mt-4 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h4 className="break-words font-semibold">{cliente}</h4>
        <p className="text-muted-foreground break-words text-sm">{servicios}</p>
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 text-sm">
          <span>
            {formatTime(cita.startTime)} - {formatTime(cita.endTime)}
          </span>
          <span className="font-medium">
            {formatCurrency(cita.totalAmount)}
          </span>
        </div>
        <Badge className="mt-2" variant={estado.variant}>
          {estado.label}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0 [&>button]:flex-1 sm:[&>button]:flex-none">
        {cita.status === "PENDING" && canConfirm && (
          <Button size="sm" onClick={() => onConfirm(cita.id)}>
            Confirmar
          </Button>
        )}
        {cerrable && (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onComplete(cita)}
            >
              Completar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNoShow(cita.id)}
            >
              No asistió
            </Button>
          </>
        )}
        {ANULABLES.includes(cita.status) && canCancel && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onCancel(cita.id)}
          >
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
