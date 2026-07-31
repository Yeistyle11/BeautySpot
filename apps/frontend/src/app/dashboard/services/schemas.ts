import { z } from "zod";

export const serviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  duration: z.number(),
  category: z.string().nullable(),
  categoryId: z.string().nullable(),
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
  active: boolean;
}

export const emptyForm: ServiceForm = {
  name: "",
  description: "",
  price: "",
  duration: "30",
  category: "",
  categoryId: "",
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
  const nombreCategoria = form.categoryId
    ? categorias.find((c) => c.id === form.categoryId)?.name ||
      form.category ||
      undefined
    : form.category || undefined;

  return {
    name: form.name,
    description: form.description || undefined,
    price: Number(form.price),
    duration: Number(form.duration),
    category: nombreCategoria,
    categoryId: form.categoryId || undefined,
    ...(incluirActivo ? { active: form.active } : {}),
  };
}
