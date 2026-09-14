"use client";

import { memo } from "react";
import { Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CeldaDeTabla,
  CeldaPrincipal,
  FilaDeTabla,
  type ColumnaDeTabla,
} from "@/components/ui/tabla-de-registros";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ESTADOS, type Invoice } from "./schemas";

export const COLUMNAS_DE_FACTURAS: ColumnaDeTabla[] = [
  { label: "Factura" },
  { label: "Cliente" },
  { label: "Fecha", ocultaEnMovil: true },
  { label: "Total", alineacion: "right" },
  { label: "Estado" },
];

interface InvoiceRowProps {
  invoice: Invoice;
  /** Nombre del cliente; la factura solo trae su id. */
  cliente?: string;
  onVerDetalle: (invoice: Invoice) => void;
  onDescargar: (invoice: Invoice) => void;
}

/** Fila de una factura emitida, con su cliente, su total y su estado. */
export const InvoiceRow = memo(function InvoiceRow({
  invoice,
  cliente,
  onVerDetalle,
  onDescargar,
}: InvoiceRowProps) {
  const badge = ESTADOS[invoice.status] ?? {
    label: invoice.status,
    variant: "secondary" as const,
  };

  return (
    <FilaDeTabla
      acciones={
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={() => onDescargar(invoice)}
          aria-label={`Descargar la factura ${invoice.number}`}
          title="Descargar PDF"
        >
          <Download className="h-4 w-4" />
        </Button>
      }
    >
      <CeldaPrincipal
        icono={FileText}
        titulo={
          /* El numero abre el desglose, tambien con teclado. */
          <button
            type="button"
            onClick={() => onVerDetalle(invoice)}
            aria-label={`Ver la factura ${invoice.number}`}
            className="focus-visible:ring-ring hover:text-primary rounded-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
          >
            {invoice.number}
          </button>
        }
      />
      <CeldaDeTabla apagada>{cliente || "Cliente"}</CeldaDeTabla>
      <CeldaDeTabla apagada ocultaEnMovil>
        <span className="whitespace-nowrap">{formatDate(invoice.date)}</span>
      </CeldaDeTabla>
      <CeldaDeTabla alineacion="right" className="font-semibold">
        {formatCurrency(invoice.total)}
      </CeldaDeTabla>
      <CeldaDeTabla>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </CeldaDeTabla>
    </FilaDeTabla>
  );
});
