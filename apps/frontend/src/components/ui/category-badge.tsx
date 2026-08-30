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
 * Categoria de un servicio o de un profesional. La categoria del catalogo se
 * pinta como insignia; la etiqueta heredada, como texto con su rotulo, para que
 * no se lea como una clasificacion que el filtro no reconoce.
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

  // Sin forma de insignia: pintada como una categoría, el dueño ve sus fichas
  // clasificadas, intenta filtrar por ellas y el filtro dice «Sin categoría».
  // Como texto con su rótulo se lee por lo que es, una etiqueta de la ficha.
  return (
    <p
      className={cn("text-muted-foreground text-xs", className)}
      title={`"${nombre}" es una etiqueta antigua y no se puede filtrar por ella. Crea la categoría para poder usarla.`}
    >
      Sin categoría · etiqueta: {nombre}
    </p>
  );
}
