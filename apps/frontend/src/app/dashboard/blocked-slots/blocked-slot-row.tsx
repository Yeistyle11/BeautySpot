"use client";

import { memo } from "react";
import { Repeat, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CeldaDeTabla,
  CeldaPrincipal,
  FilaDeTabla,
  type ColumnaDeTabla,
} from "@/components/ui/tabla-de-registros";
import { formatDate, formatTime } from "@/lib/utils";
import type { BlockedSlot } from "./schemas";

export const COLUMNAS_DE_BLOQUEOS: ColumnaDeTabla[] = [
  { label: "Profesional" },
  { label: "Día" },
  { label: "Franja" },
  { label: "Motivo", ocultaEnMovil: true },
  { label: "Repetición" },
];

interface BlockedSlotRowProps {
  bloqueo: BlockedSlot;
  /** Nombre del profesional; el bloqueo solo trae su id. */
  profesional?: string;
  puedeBorrar: boolean;
  onBorrar: (bloqueo: BlockedSlot) => void;
}

/** Fila de un bloqueo de agenda, con su franja, su motivo y su repeticion. */
export const BlockedSlotRow = memo(function BlockedSlotRow({
  bloqueo,
  profesional,
  puedeBorrar,
  onBorrar,
}: BlockedSlotRowProps) {
  const nombre = profesional || bloqueo.professionalId.slice(0, 8);

  return (
    <FilaDeTabla
      acciones={
        puedeBorrar && (
          <Button
            variant="ghost"
            size="icon"
            className="hover:text-destructive hover:bg-destructive/10 h-8 w-8"
            onClick={() => onBorrar(bloqueo)}
            aria-label={`Eliminar el bloqueo del ${formatDate(bloqueo.date)}`}
            title="Eliminar bloqueo"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )
      }
    >
      <CeldaPrincipal inicial={nombre.charAt(0)} titulo={nombre} />
      <CeldaDeTabla apagada>{formatDate(bloqueo.date)}</CeldaDeTabla>
      <CeldaDeTabla apagada>
        <span className="whitespace-nowrap">
          {formatTime(bloqueo.startTime)}–{formatTime(bloqueo.endTime)}
        </span>
      </CeldaDeTabla>
      <CeldaDeTabla apagada ocultaEnMovil>
        {bloqueo.reason || "—"}
      </CeldaDeTabla>
      <CeldaDeTabla>
        {bloqueo.serieId && (
          <Badge variant="secondary">
            <Repeat className="mr-1 h-3 w-3" />
            Se repite
          </Badge>
        )}
      </CeldaDeTabla>
    </FilaDeTabla>
  );
});
