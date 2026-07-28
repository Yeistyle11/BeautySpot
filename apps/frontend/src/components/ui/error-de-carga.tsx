"use client";

// Estado de error de una lista o panel que no se pudo cargar.
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { mensajeDeError } from "@/lib/error-message";

interface ErrorDeCargaProps {
  error: unknown;
  /** Qué se intentaba cargar, en plural y minúscula: "las citas", "los pagos". */
  recurso: string;
  /** Si se pasa, se ofrece reintentar; normalmente el `mutate` de SWR. */
  onReintentar?: () => void;
}

/**
 * Distingue "no hay datos" de "no se pudieron cargar": sin esto un fallo de red
 * o un desajuste de schema se ven igual que una lista vacía, y el usuario cree
 * que no tiene nada cuando en realidad la pantalla está rota.
 */
export function ErrorDeCarga({
  error,
  recurso,
  onReintentar,
}: ErrorDeCargaProps) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-8 text-center" role="alert">
        <AlertTriangle className="text-destructive mx-auto h-12 w-12 opacity-40" />
        <p className="mt-2 font-medium">No se pudieron cargar {recurso}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          {mensajeDeError(error)}
        </p>
        {onReintentar && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={onReintentar}
          >
            Reintentar
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
