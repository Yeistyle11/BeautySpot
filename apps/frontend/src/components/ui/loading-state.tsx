import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  /** Que se esta cargando, en plural y minuscula: "las citas", "los pagos". */
  recurso?: string;
  className?: string;
}

/**
 * Espera de una lista o panel. Anuncia el estado por el role del spinner, que
 * es lo que un parrafo suelto de "Cargando..." no hacia.
 */
export function LoadingState({ recurso, className }: LoadingStateProps) {
  return (
    <div
      className={cn(
        "text-muted-foreground flex items-center justify-center gap-2 p-8 text-sm",
        className
      )}
    >
      <Spinner variant="inline" className="h-4 w-4" />
      {recurso ? `Cargando ${recurso}...` : "Cargando..."}
    </div>
  );
}
