import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  /** Frase principal: que no hay. */
  titulo: string;
  /** Que puede hacer el usuario para que deje de estar vacio. */
  descripcion?: string;
  /** Boton o enlace de la accion sugerida. */
  accion?: React.ReactNode;
  /** Sin tarjeta, para cuando ya se pinta dentro de una. */
  sinTarjeta?: boolean;
  className?: string;
}

/** Hueco de una lista sin resultados. */
export function EmptyState({
  icon: Icon,
  titulo,
  descripcion,
  accion,
  sinTarjeta,
  className,
}: EmptyStateProps) {
  const contenido = (
    <div className={cn("p-8 text-center", className)}>
      <Icon
        className="text-muted-foreground/40 mx-auto h-12 w-12"
        aria-hidden="true"
      />
      <p className="mt-3 font-medium">{titulo}</p>
      {descripcion && (
        <p className="text-muted-foreground mt-1 text-sm">{descripcion}</p>
      )}
      {accion && <div className="mt-4 flex justify-center">{accion}</div>}
    </div>
  );

  if (sinTarjeta) return contenido;

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-0">{contenido}</CardContent>
    </Card>
  );
}
