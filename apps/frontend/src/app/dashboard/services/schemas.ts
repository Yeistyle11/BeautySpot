import { z } from "zod";

export const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  duration: z.number(),
  category: z.string().nullable(),
  categoryId: z.string().nullable(),
  /** Ventana dentro de la duracion en que el profesional queda libre. */
  procesadoDesde: z.number().nullish(),
  procesadoMinutos: z.number().nullish(),
  /** Limpieza posterior, en la que sigue ocupado sin cliente delante. */
  bufferDespues: z.number().nullish(),
  active: z.boolean(),
});
export type Service = z.infer<typeof serviceSchema>;

export const serviceCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  active: z.boolean(),
});
export type ServiceCategory = z.infer<typeof serviceCategorySchema>;

/** Valores del formulario: todo texto porque salen de inputs. */
export interface ServiceForm {
  name: string;
  description: string;
  price: string;
  duration: string;
  category: string;
  categoryId: string;
  procesadoDesde: string;
  procesadoMinutos: string;
  bufferDespues: string;
  active: boolean;
}

export const emptyForm: ServiceForm = {
  name: "",
  description: "",
  price: "",
  duration: "30",
  category: "",
  categoryId: "",
  procesadoDesde: "",
  procesadoMinutos: "",
  bufferDespues: "",
  active: true,
};

export const SERVICES_KEY = "/core/services";
export const CATEGORIES_KEY = "/core/service-categories";

/**
 * Cuerpo que espera el backend. La categoria viaja por id y tambien por nombre
 * porque el servicio guarda los dos: el id para relacionar y el nombre para
 * poder listar servicios de categorias ya borradas.
 */
export function toServicePayload(
  form: ServiceForm,
  categorias: ServiceCategory[],
  incluirActivo = false
) {
  // La categoria es la entidad que se elige en el desplegable; `category`
  // guarda su nombre, que es lo que lee el escaparate publico.
  const nombreCategoria = form.categoryId
    ? categorias.find((c) => c.id === form.categoryId)?.name
    : undefined;

  return {
    name: form.name,
    description: form.description || undefined,
    price: Number(form.price),
    duration: Number(form.duration),
    category: nombreCategoria ?? "",
    categoryId: form.categoryId || undefined,
    // El procesado es una pareja: o van los dos campos o no va ninguno.
    procesadoDesde: aMinutos(form.procesadoMinutos)
      ? aMinutos(form.procesadoDesde)
      : undefined,
    procesadoMinutos: aMinutos(form.procesadoMinutos),
    bufferDespues: aMinutos(form.bufferDespues),
    ...(incluirActivo ? { active: form.active } : {}),
  };
}

/** Minutos escritos en un input, o `undefined` si está vacío. */
function aMinutos(valor: string): number | undefined {
  if (valor.trim() === "") return undefined;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : undefined;
}
