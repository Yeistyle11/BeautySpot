"use client";

// Detalle de una factura: sus lineas, el desglose y lo que se puede hacer con ella.
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ACCIONES_DE_ESTADO,
  ESTADOS,
  SIGUIENTES_ESTADOS,
  porcentajeDeImpuesto,
  type Invoice,
} from "./schemas";

interface InvoiceDetailDialogProps {
  invoice: Invoice | null;
  onClose: () => void;
  onDescargar: (invoice: Invoice) => void;
  onCambiarEstado: (invoice: Invoice, estado: string) => void;
  /** Nombre del cliente al que se le facturó. */
  cliente?: string;
  /** Cambiar el estado es de dueño y administrador; recepción solo consulta. */
  puedeCambiarEstado: boolean;
  cambiando: boolean;
}

/** Ficha de una factura emitida, con su desglose tal como se congeló al emitir. */
export function InvoiceDetailDialog({
  invoice,
  onClose,
  onDescargar,
  onCambiarEstado,
  cliente,
  puedeCambiarEstado,
  cambiando,
}: InvoiceDetailDialogProps) {
  if (!invoice) return null;

  const estado = ESTADOS[invoice.status] ?? {
    label: invoice.status,
    variant: "secondary" as const,
  };
  const siguientes = SIGUIENTES_ESTADOS[invoice.status] ?? [];

  return (
    <Dialog open onClose={onClose} title={`Factura ${invoice.number}`} wide>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={estado.variant}>{estado.label}</Badge>
          <span className="text-muted-foreground text-sm">
            Emitida el {formatDate(invoice.date)} · vence el{" "}
            {formatDate(invoice.dueDate)}
          </span>
        </div>

        <p className="text-sm">
          <span className="font-medium">Cliente:</span> {cliente || "—"}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="py-2 font-medium">Concepto</th>
                <th className="py-2 text-right font-medium">Cantidad</th>
                <th className="py-2 text-right font-medium">Precio</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((linea, i) => (
                <tr key={linea.id ?? i} className="border-b last:border-0">
                  <td className="py-2">{linea.description}</td>
                  <td className="py-2 text-right">{linea.quantity}</td>
                  <td className="py-2 text-right">
                    {formatCurrency(linea.unitPrice)}
                  </td>
                  <td className="py-2 text-right">
                    {formatCurrency(linea.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-muted/50 space-y-1 rounded-lg p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Base</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            {/* El tipo va con la factura y no con la configuración de hoy: una
                factura de ayer no se reimprime con el impuesto de mañana. */}
            <span className="text-muted-foreground">
              Impuesto ({porcentajeDeImpuesto(invoice.taxRate)})
            </span>
            <span>{formatCurrency(invoice.tax)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>Total</span>
            <span>{formatCurrency(invoice.total)}</span>
          </div>
        </div>

        {invoice.notes && (
          <p className="text-muted-foreground text-sm">{invoice.notes}</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onDescargar(invoice)}>
            <Download className="mr-1 h-4 w-4" /> Descargar PDF
          </Button>
          {puedeCambiarEstado &&
            siguientes.map((estadoSiguiente) => (
              <Button
                key={estadoSiguiente}
                variant={
                  estadoSiguiente === "CANCELLED" ? "destructive" : "default"
                }
                disabled={cambiando}
                onClick={() => onCambiarEstado(invoice, estadoSiguiente)}
              >
                {ACCIONES_DE_ESTADO[estadoSiguiente] ?? estadoSiguiente}
              </Button>
            ))}
          {siguientes.length === 0 && (
            <span className="text-muted-foreground self-center text-sm">
              {invoice.status === "PAID"
                ? "Una factura pagada ya no cambia de estado."
                : "Una factura anulada ya no cambia de estado."}
            </span>
          )}
        </div>
      </div>
    </Dialog>
  );
}
