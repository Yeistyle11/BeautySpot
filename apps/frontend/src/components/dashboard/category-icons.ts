import type { ComponentType } from "react";
import {
  Crown,
  Droplet,
  Feather,
  Flower2,
  Gem,
  Heart,
  Palette,
  Scissors,
  Sparkles,
  Star,
  Sun,
  Wand2,
} from "lucide-react";

/** Componente de icono que aceptan las tarjetas y el selector. */
export type CategoryIcon = ComponentType<{
  className?: string;
  style?: React.CSSProperties;
}>;

/**
 * Iconos que una categoría puede tener, con su etiqueta en el selector.
 *
 * Es el único origen: de aquí salen tanto las opciones que se ofrecen al
 * elegir como el componente con el que se pinta después, de modo que ofrecer un
 * icono y saber dibujarlo son la misma lista.
 *
 * Se enumeran uno a uno en lugar de indexar `lucide-react` por nombre para que
 * el bundle sólo incluya estos doce y no la librería entera.
 */
const ICONOS: { value: string; label: string; Icon: CategoryIcon }[] = [
  { value: "Scissors", label: "Tijeras", Icon: Scissors },
  { value: "Sparkles", label: "Destellos", Icon: Sparkles },
  { value: "Heart", label: "Corazón", Icon: Heart },
  { value: "Star", label: "Estrella", Icon: Star },
  { value: "Palette", label: "Paleta", Icon: Palette },
  { value: "Wand2", label: "Varita", Icon: Wand2 },
  { value: "Droplet", label: "Gota", Icon: Droplet },
  { value: "Sun", label: "Sol", Icon: Sun },
  { value: "Flower2", label: "Flor", Icon: Flower2 },
  { value: "Gem", label: "Gema", Icon: Gem },
  { value: "Crown", label: "Corona", Icon: Crown },
  { value: "Feather", label: "Pluma", Icon: Feather },
];

/** Opciones del selector de icono. */
export const CATEGORY_ICON_OPTIONS = ICONOS.map(({ value, label }) => ({
  value,
  label,
}));

const POR_NOMBRE = new Map(ICONOS.map(({ value, Icon }) => [value, Icon]));

/**
 * Componente del icono guardado en la categoría.
 *
 * Devuelve `fallback` cuando la categoría no tiene icono o guarda un nombre que
 * no está en la lista, por ejemplo si se retira una opción que ya se había
 * usado.
 */
export function resolveCategoryIcon(
  nombre: string | null | undefined,
  fallback: CategoryIcon
): CategoryIcon {
  if (!nombre) return fallback;
  return POR_NOMBRE.get(nombre) ?? fallback;
}
