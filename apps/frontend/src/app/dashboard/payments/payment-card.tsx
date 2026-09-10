"use client";

// Tarjeta de un pago en la lista, con su metodo, estado y accion de editar.
import {
  Banknote,
  CreditCard,
  DollarSign,
  Edit,
  RotateCcw,
  Smartphone,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTimeStamp } from "@/lib/utils";
import { nombreDelMetodo } from "@/lib/metodos-de-pago";
import {
  estadoDeDevolucion,
  METHOD_LABELS,
  STATUS_LABELS,
  type Payment,
} from "./schemas";

const METHOD_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = { CASH: Banknote, CARD: CreditCard, TRANSFER: Smartphone };

interface PaymentCardProps {
  payment: Payment;
  canEdit: boolean;
  onEdit: (payment: Payment) => void;
  /** Devolver es de dueño y administrador, como en el servicio. */
  canRefund: boolean;
  onRefund: (payment: Payment) => void;
  /** Nombre del cliente; el pago solo guarda su id. */
  clientName?: string;
}

/** Fila del historial de pagos. */
export function PaymentCard({
  payment,
  canEdit,
  onEdit,
  canRefund,
  onRefund,
  clientName,
}: PaymentCardProps) {
  const Icon = METHOD_ICONS[payment.method] || DollarSign;
  const amount = formatCurrency(payment.amount);
  const devolucion = estadoDeDevolucion(payment);
  const devuelto = payment.refundAmount ?? 0;
  const descuento = payment.descuentoComercial ?? 0;
  const propina = payment.propina ?? 0;
  const reparto = payment.splits ?? [];

  return (
    <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="bg-success-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Icon className="text-success h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">
                {amount}
                {clientName && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · {clientName}
                  </span>
                )}
              </p>
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                <span>{formatDateTimeStamp(payment.createdAt)}</span>
                {/* El cobro viene de una cita; su identificador no aporta
                    nada en el listado. */}
                {payment.appointmentId && (
                  <span className="bg-muted rounded px-1.5 py-0.5 text-xs">
                    Con cita
                  </span>
                )}
                {payment.reference && (
                  <span className="bg-muted rounded px-1.5 py-0.5 text-xs">
                    Ref: {payment.reference}
                  </span>
                )}
              </div>
              {/* El importe de arriba son los servicios: lo que se regaló, lo
                  que se dejó de propina y por dónde entró el dinero se dicen
                  aparte, o el cobro no se puede reconstruir mirándolo. */}
              {(descuento > 0 || propina > 0 || reparto.length > 1) && (
                <p className="text-muted-foreground mt-1 text-sm">
                  {[
                    descuento > 0 &&
                      `Descuento ${formatCurrency(descuento)}${
                        payment.motivoDescuento
                          ? ` · ${payment.motivoDescuento}`
                          : ""
                      }`,
                    propina > 0 && `Propina ${formatCurrency(propina)}`,
                    reparto.length > 1 &&
                      reparto
                        .map(
                          (linea) =>
                            `${nombreDelMetodo(linea.method)} ${formatCurrency(linea.amount)}`
                        )
                        .join(" + "),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              {/* Una devolución parcial deja el cobro vivo por el resto: sin
                  decir cuánto volvió, la cifra de arriba engaña. */}
              {devuelto > 0 && (
                <p className="text-muted-foreground mt-1 text-sm">
                  Devuelto {formatCurrency(devuelto)}
                  {payment.refundReason ? ` · ${payment.refundReason}` : ""}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(payment)}
                aria-label={`Editar el pago de ${amount}`}
              >
                <Edit className="text-muted-foreground h-4 w-4" />
              </Button>
            )}
            {canRefund && devolucion.puede && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRefund(payment)}
                aria-label={`Devolver el pago de ${amount}`}
              >
                <RotateCcw className="text-muted-foreground h-4 w-4" />
              </Button>
            )}
            <Badge variant="secondary">
              {METHOD_LABELS[payment.method] || payment.method}
            </Badge>
            <Badge
              variant={payment.status === "COMPLETED" ? "success" : "secondary"}
            >
              {STATUS_LABELS[payment.status] ?? payment.status}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
