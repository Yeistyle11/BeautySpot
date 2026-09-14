"use client";

import { memo } from "react";
import {
  ArrowDown,
  ArrowDownCircle,
  ArrowUp,
  ArrowUpCircle,
  History,
} from "lucide-react";
import {
  CeldaDeTabla,
  CeldaPrincipal,
  FilaDeTabla,
  type ColumnaDeTabla,
} from "@/components/ui/tabla-de-registros";
import { formatCurrency, formatDate, formatTimeStamp } from "@/lib/utils";
import type { CashMovement, CashSession } from "./schemas";

export const COLUMNAS_DE_MOVIMIENTOS: ColumnaDeTabla[] = [
  { label: "Concepto" },
  { label: "Cliente" },
  { label: "Hora", ocultaEnMovil: true },
  { label: "Importe", alineacion: "right" },
];

export const COLUMNAS_DE_SESIONES: ColumnaDeTabla[] = [
  { label: "Sesión" },
  { label: "Apertura", alineacion: "right", ocultaEnMovil: true },
  { label: "Cierre", alineacion: "right", ocultaEnMovil: true },
  { label: "Descuadre", alineacion: "right" },
];

/** Tonos del descuadre, compartidos por el arqueo y el historial. */
export function clasesDeDescuadre(diferencia: number): string {
  return diferencia < 0
    ? "bg-danger-chip text-danger-chip-foreground"
    : "bg-warning-soft text-warning-soft-foreground";
}

/** Fila de un movimiento del cajón: su concepto, su hora y su importe con signo. */
export const MovementRow = memo(function MovementRow({
  movimiento,
}: {
  movimiento: CashMovement;
}) {
  const entra = movimiento.type === "IN";

  return (
    <FilaDeTabla>
      <CeldaPrincipal
        icono={entra ? ArrowUpCircle : ArrowDownCircle}
        colorDelIcono={entra ? "#157E3C" : "#C81E1E"}
        titulo={movimiento.concept}
      />
      {/* Quien registro cada entrada. */}
      <CeldaDeTabla apagada>{movimiento.clientName || "—"}</CeldaDeTabla>
      <CeldaDeTabla apagada ocultaEnMovil>
        <span className="whitespace-nowrap">
          {formatTimeStamp(movimiento.createdAt)}
        </span>
      </CeldaDeTabla>
      <CeldaDeTabla
        alineacion="right"
        className={
          entra
            ? "text-success font-semibold"
            : "text-destructive font-semibold"
        }
      >
        {entra ? "+" : "-"}
        {formatCurrency(movimiento.amount)}
      </CeldaDeTabla>
    </FilaDeTabla>
  );
});

/** Fila del historial: una sesión de caja con su apertura, cierre y descuadre. */
export const SessionRow = memo(function SessionRow({
  sesion,
}: {
  sesion: CashSession;
}) {
  return (
    <FilaDeTabla>
      <CeldaPrincipal
        icono={History}
        titulo={`${formatDate(sesion.openedAt)} – ${
          sesion.closedAt ? formatDate(sesion.closedAt) : "En curso"
        }`}
        subtitulo={sesion.notes || undefined}
      />
      <CeldaDeTabla alineacion="right" apagada ocultaEnMovil>
        {formatCurrency(sesion.openingAmount)}
      </CeldaDeTabla>
      <CeldaDeTabla alineacion="right" apagada ocultaEnMovil>
        {sesion.closingAmount != null
          ? formatCurrency(sesion.closingAmount)
          : "—"}
      </CeldaDeTabla>
      {/* El descuadre de cada sesion. */}
      <CeldaDeTabla alineacion="right">
        {sesion.difference ? (
          <span
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-base font-semibold ${clasesDeDescuadre(sesion.difference)}`}
          >
            {/* El icono lleva el signo: si falta o si sobra. */}
            {sesion.difference < 0 ? (
              <ArrowDown className="h-4 w-4" aria-hidden />
            ) : (
              <ArrowUp className="h-4 w-4" aria-hidden />
            )}
            {sesion.difference < 0 ? "Faltaron " : "Sobraron "}
            {formatCurrency(Math.abs(sesion.difference))}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </CeldaDeTabla>
    </FilaDeTabla>
  );
});
