"use client";

// Dialogo para completar una cita registrando su cobro y su factura.
import { Calendar, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BotonDeCancelar, Dialog } from "@/components/ui/dialog";
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatDuracion,
} from "@/lib/utils";
import { CamposDelCobro } from "../payments/campos-del-cobro";
import {
  cobroListo,
  emptyCreateForm,
  type CreateForm,
} from "../payments/schemas";
import type { Appointment } from "./schemas";

export { PAYMENT_METHOD_OPTIONS } from "../payments/campos-del-cobro";

/** El cobro de la cita, con lo mismo que admite un cobro suelto, y su factura. */
export interface PaymentDraft extends CreateForm {
  /** Emite la factura del cobro en el mismo paso. */
  facturar: boolean;
}

export const emptyPaymentDraft: PaymentDraft = {
  ...emptyCreateForm,
  facturar: true,
};

/** Borrador del cobro de una cita: su cliente, la cita y su total. */
export function cobroDeLaCita(cita: Appointment): PaymentDraft {
  return {
    ...emptyPaymentDraft,
    clientId: cita.clientId,
    appointmentId: cita.id,
    amount: String(Number(cita.totalAmount)),
  };
}

interface CompleteAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  payment: PaymentDraft;
  onPaymentChange: (payment: PaymentDraft) => void;
  /** `true` registra ademas el pago; `false` solo cierra la cita. */
  onComplete: (registerPayment: boolean) => void;
  pending: boolean;
  /** Muestra la opción de facturar el cobro. */
  puedeFacturar?: boolean;
  /** Si quien cobra puede además conceder un descuento. */
  puedeDescontar?: boolean;
  /** Saldo de puntos del cliente de la cita. */
  puntosDisponibles?: number;
}

/** Cierre de una cita, con la opcion de cobrarla y facturarla en el mismo paso. */
export function CompleteAppointmentDialog({
  open,
  onClose,
  appointment,
  payment,
  onPaymentChange,
  onComplete,
  pending,
  puedeFacturar = false,
  puedeDescontar = false,
  puntosDisponibles = 0,
}: CompleteAppointmentDialogProps) {
  const conFactura = puedeFacturar && payment.facturar;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Completar cita"
      descripcion="Cierra la cita y, si quieres, registra el cobro en el mismo paso."
      icono={CheckCircle}
      wide
      pie={
        <>
          <BotonDeCancelar disabled={pending} />
          <Button
            variant="outline"
            onClick={() => onComplete(false)}
            disabled={pending}
          >
            {pending ? "Procesando..." : "Completar sin pago"}
          </Button>
          <Button
            onClick={() => onComplete(true)}
            disabled={pending || !cobroListo(payment)}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            {pending
              ? "Procesando..."
              : conFactura
                ? "Completar, cobrar y facturar"
                : "Completar y registrar pago"}
          </Button>
        </>
      }
    >
      {appointment && (
        <div className="space-y-6">
          <div className="bg-muted/50 space-y-3 rounded-lg p-4">
            <h3 className="text-muted-foreground text-sm font-semibold uppercase tracking-wide">
              Resumen de la cita
            </h3>
            <div className="space-y-2">
              {appointment.appointmentServices.map((s, i) => (
                <div
                  key={`${s.serviceName}-${i}`}
                  className="flex justify-between text-sm"
                >
                  <span>
                    {s.serviceName} ({formatDuracion(s.duration)})
                  </span>
                  <span className="font-medium">{formatCurrency(s.price)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span>{formatCurrency(appointment.totalAmount)}</span>
              </div>
            </div>
            <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(appointment.date)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(appointment.startTime)} -{" "}
                {formatTime(appointment.endTime)}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <CamposDelCobro
              form={payment}
              onChange={(cobro) => onPaymentChange({ ...payment, ...cobro })}
              puedeDescontar={puedeDescontar}
              puntosDisponibles={puntosDisponibles}
            />
          </div>

          {puedeFacturar && (
            <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <span className="text-sm font-medium">
                Emitir factura del cobro
              </span>
              <Switch
                checked={payment.facturar}
                onCheckedChange={(facturar) =>
                  onPaymentChange({ ...payment, facturar })
                }
                aria-label="Emitir factura del cobro"
              />
            </label>
          )}
        </div>
      )}
    </Dialog>
  );
}
