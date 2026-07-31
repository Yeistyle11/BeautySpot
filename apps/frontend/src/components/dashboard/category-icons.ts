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
 * Iconos que una categoría puede tener, con su etiqueta en el selector. De aquí
 * salen tanto las opciones que se ofrecen como el componente con el que se
 * pinta cada una.
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
 * Componente del icono guardado en la categoría, o `fallback` si no tiene
 * ninguno o el nombre no está en la lista.
 */
export function resolveCategoryIcon(
  nombre: string | null | undefined,
  fallback: CategoryIcon
): CategoryIcon {
  if (!nombre) return fallback;
  return POR_NOMBRE.get(nombre) ?? fallback;
}

/**
 * Colores sugeridos al crear una categoria. Son datos que el negocio elige y se
 * guardan como hex en la base, no tokens del tema: se pintan como estilo en
 * linea sobre el icono de cada categoria.
 */
export const CATEGORY_COLOR_PRESETS = [
  "#8B5CF6", // violeta
  "#3B82F6", // azul
  "#10B981", // esmeralda
  "#F59E0B", // ámbar
  "#EF4444", // rojo
  "#EC4899", // rosa
  "#6366F1", // índigo
  "#14B8A6", // teal
  "#F97316", // naranja
  "#64748B", // slate
];
