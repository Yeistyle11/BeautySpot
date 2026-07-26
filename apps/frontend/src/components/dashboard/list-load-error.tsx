"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mensajeDeError } from "@/lib/error-message";

/** Aviso de que la lista no se pudo cargar, con opción de reintentar. */
export function ListLoadError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-center">
      <AlertCircle className="text-destructive h-10 w-10" />
      <div>
        <p className="text-foreground font-medium">
          No se pudo cargar la lista
        </p>
        <p className="mt-1 text-sm">{mensajeDeError(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
