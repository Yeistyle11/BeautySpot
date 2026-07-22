"use client";

import { useEffect } from "react";
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
      <Button onClick={() => reset()}>Reintentar</Button>
    </div>
  );
}
