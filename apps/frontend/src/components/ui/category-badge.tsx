import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  nombre: string;
  /**
   * Si la categoría está dada de alta en la taxonomía del negocio. Cuando no lo
   * está, el nombre es una etiqueta heredada de texto libre.
   */
  delCatalogo: boolean;
  /** Color de la categoría, que cada negocio define en su ficha. */
  color?: string;
  className?: string;
}

/**
 * Categoria de un servicio o de un profesional, distinguiendo la categoria
 * real de la etiqueta heredada, que es solo texto de la ficha.
 */
export function CategoryBadge({
  nombre,
  delCatalogo,
  color,
  className,
}: CategoryBadgeProps) {
  if (!nombre) return null;

  if (delCatalogo) {
    return (
      <Badge
        variant="secondary"
        className={className}
        // El color viene de la base y no de Tailwind; el sufijo "20" es el alfa
        // del fondo en hexadecimal.
        style={color ? { backgroundColor: `${color}20`, color } : undefined}
      >
        {nombre}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn("text-muted-foreground border-dashed", className)}
      title={`"${nombre}" es una etiqueta antigua y no se puede filtrar por ella. Crea la categoría para poder usarla.`}
    >
      {nombre}
    </Badge>
  );
}
