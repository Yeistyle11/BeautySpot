// Esquemas Zod, tipos y constantes de los profesionales.
import { z } from "zod";

export const professionalSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  photo: z.string().nullable(),
  bio: z.string().nullable(),
  category: z.string().nullable(),
  categoryId: z.string().nullable(),
  specialties: z.array(z.string()),
  yearsExp: z.number(),
  rating: z.number(),
  totalReviews: z.number(),
  active: z.boolean(),
});
export type Professional = z.infer<typeof professionalSchema>;

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  active: z.boolean(),
});
export type Category = z.infer<typeof categorySchema>;

/** Servicio del catálogo del negocio, con su precio y duración de referencia. */
export const servicioDelCatalogoSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  duration: z.number(),
  active: z.boolean(),
});
export type ServicioDelCatalogo = z.infer<typeof servicioDelCatalogoSchema>;

/**
 * Servicio asignado a un profesional. Las tarifas propias son opcionales: sin
 * ellas presta el servicio al precio y la duración del catálogo.
 */
export const tarifaSchema = z.object({
  serviceId: z.string(),
  customPrice: z.number().nullish(),
  customDuration: z.number().nullish(),
});
export type Tarifa = z.infer<typeof tarifaSchema>;

/** Fila del diálogo: un servicio del catálogo y lo que el profesional le hace. */
export interface FilaDeTarifa {
  serviceId: string;
  presta: boolean;
  /** Vacío = lo del catálogo. Son texto porque salen de un input. */
  precio: string;
  duracion: string;
}

/** Estado inicial del diálogo: el catálogo cruzado con lo ya asignado. */
export function filasDeTarifas(
  servicios: ServicioDelCatalogo[],
  asignados: Tarifa[]
): FilaDeTarifa[] {
  const porServicio = new Map(asignados.map((t) => [t.serviceId, t]));

  return servicios.map((servicio) => {
    const tarifa = porServicio.get(servicio.id);
    return {
      serviceId: servicio.id,
      presta: Boolean(tarifa),
      precio: tarifa?.customPrice != null ? String(tarifa.customPrice) : "",
      duracion:
        tarifa?.customDuration != null ? String(tarifa.customDuration) : "",
    };
  });
}

/** Lo que hay que mandar al backend para dejar el estado como está en pantalla. */
export interface CambiosDeTarifas {
  asignar: {
    serviceId: string;
    customPrice?: number;
    customDuration?: number;
  }[];
  quitar: string[];
}

/** Un número que el usuario escribió, o `undefined` si dejó el campo vacío. */
function cifra(texto: string): number | undefined {
  const limpio = texto.trim();
  if (!limpio) return undefined;
  const valor = Number(limpio);
  return Number.isFinite(valor) && valor >= 0 ? valor : undefined;
}

/**
 * Compara las filas con las que se cargaron y devuelve solo lo que cambió: a
 * quién asignar (o reasignar con otra tarifa) y a quién quitar. Sin esto,
 * guardar reenviaría el catálogo entero en cada vuelta.
 */
export function cambiosDeTarifas(
  original: FilaDeTarifa[],
  actual: FilaDeTarifa[]
): CambiosDeTarifas {
  const antes = new Map(original.map((f) => [f.serviceId, f]));
  const cambios: CambiosDeTarifas = { asignar: [], quitar: [] };

  for (const fila of actual) {
    const previa = antes.get(fila.serviceId);

    if (!fila.presta) {
      if (previa?.presta) cambios.quitar.push(fila.serviceId);
      continue;
    }

    const igual =
      previa?.presta &&
      previa.precio.trim() === fila.precio.trim() &&
      previa.duracion.trim() === fila.duracion.trim();
    if (igual) continue;

    cambios.asignar.push({
      serviceId: fila.serviceId,
      customPrice: cifra(fila.precio),
      customDuration: cifra(fila.duracion),
    });
  }

  return cambios;
}

export interface AvailabilitySlot {
  dayOfWeek: number;
  active: boolean;
  startTime: string;
  endTime: string;
}

/** Un tramo de trabajo; un dia puede tener varios. */
export type Tramo = { startTime: string; endTime: string };

/** Tramos de un dia. Sin ninguno, es un dia libre. */
export type DayHours = Tramo[];

/** Tramo que se propone al activar un dia o al anadir uno nuevo. */
export const TRAMO_POR_DEFECTO: Tramo = {
  startTime: "08:00",
  endTime: "18:00",
};

// La semana arranca en lunes (1) y cierra en domingo (0), que es como la
// numera getDay() y como espera el backend.
export const DAYS_MAP = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

export const emptyForm = {
  name: "",
  bio: "",
  specialties: "",
  yearsExp: "0",
  category: "",
  categoryId: "",
  photo: "",
  active: "true",
};

export type ProfessionalForm = typeof emptyForm;

/** Convierte el formulario (todo strings) al cuerpo que espera el backend. */
export function toProfessionalPayload(
  form: ProfessionalForm,
  categories: Category[],
  includeActive = false
) {
  const categoryName = form.categoryId
    ? categories.find((c) => c.id === form.categoryId)?.name || form.category
    : form.category;

  return {
    name: form.name,
    bio: form.bio || undefined,
    specialties: form.specialties
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    yearsExp: Number(form.yearsExp),
    category: categoryName || undefined,
    categoryId: form.categoryId || undefined,
    photo: form.photo || undefined,
    ...(includeActive ? { active: form.active === "true" } : {}),
  };
}
