"use client";

// Dialogo para completar una cita registrando el pago (metodo y monto).
import {
  Banknote,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { RadioGroup } from "@/components/ui/radio-group";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import type { Appointment } from "./schemas";

export const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "Efectivo", icon: <Banknote className="h-5 w-5" /> },
  {
    value: "CARD",
    label: "Datáfono",
    icon: <CreditCard className="h-5 w-5" />,
  },
  {
    value: "TRANSFER",
    label: "Transferencia",
    icon: <Smartphone className="h-5 w-5" />,
  },
];

export interface PaymentDraft {
  method: string;
  reference: string;
  notes: string;
}

export const emptyPaymentDraft: PaymentDraft = {
  method: "CASH",
  reference: "",
  notes: "",
};

interface CompleteAppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  payment: PaymentDraft;
  onPaymentChange: (payment: PaymentDraft) => void;
  /** `true` registra ademas el pago; `false` solo cierra la cita. */
  onComplete: (registerPayment: boolean) => void;
  pending: boolean;
}

/**
 * Cierre de una cita. Ofrece registrar el cobro en el mismo paso porque es lo
 * habitual en mostrador, pero permite completar sin pago (cortesias, cobros ya
 * registrados aparte).
 */
export function CompleteAppointmentDialog({
  open,
  onClose,
  appointment,
  payment,
  onPaymentChange,
  onComplete,
  pending,
}: CompleteAppointmentDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Completar cita" wide>
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
                    {s.serviceName} ({s.duration} min)
                  </span>
                  <span className="font-medium">
                    {formatCurrency(parseFloat(s.price))}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span>
                  {formatCurrency(parseFloat(appointment.totalAmount))}
                </span>
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

          <div
            className="space-y-3"
            role="group"
            aria-labelledby="payment-method-label"
          >
            <p id="payment-method-label" className="text-base font-semibold">
              Metodo de pago
            </p>
            <RadioGroup
              options={PAYMENT_METHOD_OPTIONS}
              value={payment.method}
              onChange={(method) => onPaymentChange({ ...payment, method })}
            />
          </div>

          {payment.method === "TRANSFER" && (
            <Field label="Referencia de la transferencia">
              <Input
                placeholder="Ej: #123456789"
                value={payment.reference}
                onChange={(e) =>
                  onPaymentChange({ ...payment, reference: e.target.value })
                }
              />
            </Field>
          )}

          <Field label="Notas adicionales">
            <Textarea
              placeholder="Notas sobre el pago..."
              value={payment.notes}
              onChange={(e) =>
                onPaymentChange({ ...payment, notes: e.target.value })
              }
              rows={2}
            />
          </Field>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={() => onComplete(true)} disabled={pending}>
              <CheckCircle className="mr-2 h-4 w-4" />
              {pending ? "Procesando..." : "Completar y registrar pago"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onComplete(false)}
              disabled={pending}
            >
              {pending ? "Procesando..." : "Completar sin pago"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
