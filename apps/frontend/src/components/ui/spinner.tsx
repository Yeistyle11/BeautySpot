import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  /** Que se esta cargando; lo lee el lector de pantalla. */
  label?: string;
  /** `page` centra el spinner en un alto de pantalla, para rutas completas. */
  variant?: "inline" | "block" | "page";
}

const TAMANOS = {
  inline: "h-5 w-5 border-2",
  block: "h-8 w-8 border-4",
  page: "h-8 w-8 border-4",
};

/**
 * Indicador de carga. Anuncia el estado con role="status", que la docena de
 * spinners sueltos que habia repartidos por las paginas no hacia.
 */
export function Spinner({
  className,
  label = "Cargando",
  variant = "block",
}: SpinnerProps) {
  const rueda = (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "border-primary inline-block animate-spin rounded-full border-t-transparent",
        TAMANOS[variant],
        className
      )}
    />
  );

  if (variant === "page") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {rueda}
      </div>
    );
  }
  if (variant === "block") {
    return <div className="flex justify-center py-20">{rueda}</div>;
  }
  return rueda;
}
