"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
      <AlertTriangle className="text-destructive h-8 w-8" />
      <div>
        <p className="font-medium">No se pudo cargar esta sección</p>
        <p className="text-muted-foreground text-sm">
          Ocurrió un error inesperado. Intenta nuevamente.
        </p>
      </div>
      <Button onClick={() => reset()} size="sm">
        Reintentar
      </Button>
    </div>
  );
}
