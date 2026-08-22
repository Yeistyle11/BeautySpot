// Forma de las respuestas de lista del backend, sin "use client": la usan
// tanto los hooks del navegador como los server components del marketplace.
import { z, type ZodType } from "zod";

/** Metadatos de paginación que acompañan a las respuestas de lista del backend. */
export const paginationMetaSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasNext: z.boolean(),
  hasPrev: z.boolean(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/** Envuelve un schema de item en la forma { data: item[], meta } del backend. */
export function paginatedSchema<T>(item: ZodType<T>) {
  return z.object({ data: z.array(item), meta: paginationMetaSchema });
}
