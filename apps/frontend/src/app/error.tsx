"use client";

// Error boundary de la app: pantalla de error generica con opcion de reintentar.

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function Error({
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="text-destructive h-10 w-10" />
      <div>
        <h1 className="text-xl font-semibold">Algo salió mal</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Ocurrió un error inesperado. Intenta nuevamente.
        </p>
      </div>
      {/* Si el fallo se repite, reintentar no saca de aqui: hace falta una
          salida a una pantalla que si cargue. */}
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Reintentar</Button>
        <Button asChild variant="outline">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
