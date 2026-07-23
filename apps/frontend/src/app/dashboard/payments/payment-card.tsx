"use client";
import {
  Banknote,
  CreditCard,
  DollarSign,
  Edit,
  Smartphone,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDateTimeStamp } from "@/lib/utils";
import { METHOD_LABELS, type Payment } from "./schemas";

const METHOD_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = { CASH: Banknote, CARD: CreditCard, TRANSFER: Smartphone };

interface PaymentCardProps {
  payment: Payment;
  canEdit: boolean;
  onEdit: (payment: Payment) => void;
}

/** Fila del historial de pagos. */
export function PaymentCard({ payment, canEdit, onEdit }: PaymentCardProps) {
  const Icon = METHOD_ICONS[payment.method] || DollarSign;
  const amount = formatCurrency(parseFloat(payment.amount));

  return (
    <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="bg-success-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Icon className="text-success h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">{amount}</p>
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
                <span>{formatDateTimeStamp(payment.registeredAt)}</span>
                {payment.appointmentId && (
                  <span className="bg-muted rounded px-1.5 py-0.5 text-xs">
                    Cita: {payment.appointmentId.slice(0, 8)}...
                  </span>
                )}
                {payment.reference && (
                  <span className="bg-muted rounded px-1.5 py-0.5 text-xs">
                    Ref: {payment.reference}
                  </span>
                )}
              </div>
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
            <Badge variant="secondary">
              {METHOD_LABELS[payment.method] || payment.method}
            </Badge>
            <Badge
              variant={payment.status === "COMPLETED" ? "success" : "secondary"}
            >
              {payment.status === "COMPLETED" ? "Completado" : payment.status}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
