"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function MarketplaceError({
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
      {/* Si el fallo se repite, reintentar no saca de aqui: hace falta una
          salida a una pantalla que si cargue. */}
      <div className="flex gap-2">
        <Button onClick={() => reset()} size="sm">
          Reintentar
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/marketplace">Ir al buscador</Link>
        </Button>
      </div>
    </div>
  );
}
