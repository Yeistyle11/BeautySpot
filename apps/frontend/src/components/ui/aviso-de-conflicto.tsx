"use client";

// Aviso de que lo que se esta editando cambio mientras tanto.
import { Button } from "@/components/ui/button";

interface AvisoDeConflictoProps {
  /** Motivo, tal como lo redacta el servidor. */
  mensaje: string;
  onRecargar: () => void;
  recargando?: boolean;
}

/**
 * Va dentro del formulario y no en un aviso efimero: el que se va solo deja a
 * quien guardaba sin saber que paso con lo que escribio, y aqui hay algo que
 * decidir. Lo escrito sigue en pantalla hasta que se pulsa Recargar, que es lo
 * que lo cambia por la version guardada.
 */
export function AvisoDeConflicto({
  mensaje,
  onRecargar,
  recargando,
}: AvisoDeConflictoProps) {
  return (
    <div
      role="alert"
      className="border-warning/40 bg-warning-soft/40 space-y-2 rounded-lg border p-3"
    >
      <p className="text-sm">{mensaje}</p>
      <p className="text-muted-foreground text-xs">
        Al recargar veras lo que hay guardado y se descartara lo que has
        escrito.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRecargar}
        disabled={recargando}
      >
        {recargando ? "Recargando..." : "Recargar"}
      </Button>
    </div>
  );
}
