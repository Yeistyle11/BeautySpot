import { z } from "zod";
import { COLORES_DE_NIVEL } from "@beautyspot/shared-constants";

/**
 * Clase de fondo de cada color de nivel.
 *
 * Las clases se escriben literales para que Tailwind las encuentre al compilar:
 * si se armaran concatenando el nombre del color, no estarían en el CSS.
 */
export const CLASE_DE_COLOR: Record<string, string> = {
  bronce: "bg-amber-700",
  plata: "bg-gray-400",
  oro: "bg-yellow-500",
  cian: "bg-cyan-500",
  morado: "bg-purple-500",
  verde: "bg-emerald-500",
  rosa: "bg-pink-500",
  azul: "bg-blue-500",
};

/** Nombre con el que se ofrece cada color al configurar los niveles. */
export const NOMBRE_DE_COLOR: Record<string, string> = {
  bronce: "Bronce",
  plata: "Plata",
  oro: "Oro",
  cian: "Cian",
  morado: "Morado",
  verde: "Verde",
  rosa: "Rosa",
  azul: "Azul",
};

/** Nivel del programa de fidelidad tal y como lo devuelve core. */
export const nivelSchema = z.object({
  min: z.number(),
  label: z.string(),
  color: z.enum(COLORES_DE_NIVEL),
});
export type Nivel = z.infer<typeof nivelSchema>;

/** Ruta de la escala de fidelidad del negocio. */
export const FIDELIZACION_KEY = "/core/business-config/fidelizacion";
