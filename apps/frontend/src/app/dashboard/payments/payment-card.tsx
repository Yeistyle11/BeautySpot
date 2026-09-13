"use client";

// Fila de un cobro en la lista, con su metodo, estado y acciones.
import {
  Banknote,
  CreditCard,
  DollarSign,
  Edit,
  RotateCcw,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FilaDeTabla,
  CeldaDeTabla,
  CeldaPrincipal,
  type ColumnaDeTabla,
  type IconoDeFila,
} from "@/components/ui/tabla-de-registros";
import { formatCurrency, formatDateTimeStamp } from "@/lib/utils";
import { nombreDelMetodo } from "@/lib/metodos-de-pago";
import {
  estadoDeDevolucion,
  METHOD_LABELS,
  STATUS_LABELS,
  type Payment,
} from "./schemas";

const METHOD_ICONS: Record<string, IconoDeFila> = {
  CASH: Banknote,
  CARD: CreditCard,
  TRANSFER: Smartphone,
};

/** Columnas del listado de cobros. El orden lo fija el servidor por fecha. */
export const COLUMNAS_DE_PAGOS: ColumnaDeTabla[] = [
  { label: "Cobro" },
  { label: "Fecha", ocultaEnMovil: true },
  { label: "Medio", ocultaEnMovil: true },
  { label: "Importe", alineacion: "right" },
  { label: "Estado" },
];

interface PaymentCardProps {
  payment: Payment;
  canEdit: boolean;
  onEdit: (payment: Payment) => void;
  canRefund: boolean;
  onRefund: (payment: Payment) => void;
  /** Nombre del cliente; el listado de cobros solo trae su id. */
  clientName?: string;
}

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

  /*
    El importe de la columna son los servicios. El descuento, la propina, el
    reparto y lo devuelto se dicen aparte, en esta linea.
  */
  const detalle = [
    payment.appointmentId && "Con cita",
    payment.reference && `Ref: ${payment.reference}`,
    descuento > 0 &&
      `Descuento ${formatCurrency(descuento)}${
        payment.motivoDescuento ? ` · ${payment.motivoDescuento}` : ""
      }`,
    propina > 0 && `Propina ${formatCurrency(propina)}`,
    reparto.length > 1 &&
      reparto
        .map(
          (linea) =>
            `${nombreDelMetodo(linea.method)} ${formatCurrency(linea.amount)}`
        )
        .join(" + "),
    // Cuanto se devolvio de un cobro que sigue vivo por el resto.
    devuelto > 0 &&
      `Devuelto ${formatCurrency(devuelto)}${
        payment.refundReason ? ` · ${payment.refundReason}` : ""
      }`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <FilaDeTabla
      acciones={
        <>
          <span className="flex h-8 w-8 items-center justify-center">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(payment)}
                aria-label={`Editar el cobro de ${amount}`}
                title="Editar"
              >
                <Edit className="text-muted-foreground h-4 w-4" />
              </Button>
            )}
          </span>
          <span className="flex h-8 w-8 items-center justify-center">
            {canRefund && devolucion.puede && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onRefund(payment)}
                aria-label={`Devolver el cobro de ${amount}`}
                title="Devolver"
              >
                <RotateCcw className="text-muted-foreground h-4 w-4" />
              </Button>
            )}
          </span>
        </>
      }
    >
      <CeldaPrincipal
        icono={Icon}
        // Hay fichas cuyo nombre son espacios.
        titulo={clientName?.trim() || "Cobro en mostrador"}
        subtitulo={detalle || undefined}
      />
      <CeldaDeTabla apagada ocultaEnMovil>
        <span className="whitespace-nowrap">
          {formatDateTimeStamp(payment.createdAt)}
        </span>
      </CeldaDeTabla>
      <CeldaDeTabla ocultaEnMovil>
        <Badge variant="secondary">
          {METHOD_LABELS[payment.method] || payment.method}
        </Badge>
      </CeldaDeTabla>
      <CeldaDeTabla alineacion="right" className="font-semibold">
        {amount}
      </CeldaDeTabla>
      <CeldaDeTabla>
        <Badge
          variant={payment.status === "COMPLETED" ? "success" : "secondary"}
        >
          {STATUS_LABELS[payment.status] ?? payment.status}
        </Badge>
      </CeldaDeTabla>
    </FilaDeTabla>
  );
}
