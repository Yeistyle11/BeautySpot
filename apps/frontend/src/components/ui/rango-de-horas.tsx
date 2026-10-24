"use client";

// Tramo «desde – a – hasta» de un horario, con su boton de quitar opcional.
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoraDeCierre } from "@/components/ui/hora-de-cierre";
import { Input } from "@/components/ui/input";

interface RangoDeHorasProps {
  desde: string;
  hasta: string;
  onDesde: (hora: string) => void;
  onHasta: (hora: string) => void;
  /** Nombres accesibles de cada hora, con el dia y el tramo. */
  etiquetaDesde: string;
  etiquetaHasta: string;
  /** Sin el, el tramo no se puede quitar. */
  alQuitar?: () => void;
  etiquetaQuitar?: string;
}

/**
 * Las dos horas de un tramo. En movil ocupa el ancho y las horas se lo
 * reparten; desde `sm` vuelve a los anchos fijos de escritorio.
 */
export function RangoDeHoras({
  desde,
  hasta,
  onDesde,
  onHasta,
  etiquetaDesde,
  etiquetaHasta,
  alQuitar,
  etiquetaQuitar,
}: RangoDeHorasProps) {
  return (
    <div className="flex w-full items-center gap-2 sm:w-auto">
      <Input
        type="time"
        value={desde}
        onChange={(e) => onDesde(e.target.value)}
        className="min-w-0 flex-1 sm:h-8 sm:w-28 sm:flex-none"
        aria-label={etiquetaDesde}
      />
      <span className="text-muted-foreground text-sm">a</span>
      <HoraDeCierre
        value={hasta}
        apertura={desde}
        onValueChange={onHasta}
        className="min-w-0 flex-[1.4] sm:h-8 sm:w-40 sm:flex-none"
        aria-label={etiquetaHasta}
      />
      {alQuitar && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 sm:h-8 sm:w-8"
          onClick={alQuitar}
          aria-label={etiquetaQuitar}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
