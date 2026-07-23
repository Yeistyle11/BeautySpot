"use client";

import useSWR, { type SWRConfiguration, type Key } from "swr";
import { z, type ZodType } from "zod";
import { api, apiPublic } from "./api";

export type { SWRConfiguration, Key };

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

/**
 * Consume un endpoint de lista paginado ({ data, meta }) y expone la página
 * lista para usar: `items` siempre es un array (nunca undefined) y `meta` trae
 * el total, la página actual y los flags de navegación.
 */
export function usePaginatedApi<T>(
  path: Key,
  itemSchema: ZodType<T>,
  options?: SWRConfiguration
) {
  const { data, error, isLoading, mutate } = useSWR(
    path,
    async () => paginatedSchema(itemSchema).parse(await api.get(path as string)),
    options
  );
  return {
    items: (data?.data ?? []) as T[],
    meta: data?.meta as PaginationMeta | undefined,
    isLoading,
    error,
    mutate,
  };
}

// El schema es opcional: si se pasa, valida la respuesta del gateway en
// runtime antes de devolverla al cache de SWR. `schema.parse` lanza si no
// matchea, y SWR ya captura ese throw en su `error` -- mismo mecanismo que
// las paginas ya usan para errores de red, sin plomeria nueva.
export function useApi<T>(
  path: Key,
  options?: SWRConfiguration<T>,
  schema?: ZodType<T>
) {
  return useSWR<T>(
    path,
    async () => {
      const data = await api.get<T>(path as string);
      return schema ? schema.parse(data) : data;
    },
    options
  );
}

export function useApiPublic<T>(
  path: Key,
  options?: SWRConfiguration<T>,
  schema?: ZodType<T>
) {
  return useSWR<T>(
    path,
    async () => {
      const data = await apiPublic.get<T>(path as string);
      return schema ? schema.parse(data) : data;
    },
    options
  );
}

export async function revalidatePath(path: string): Promise<void> {
  const { mutate } = await import("swr");
  await mutate(path);
}

export async function revalidatePrefix(prefix: string): Promise<void> {
  const { mutate } = await import("swr");
  await mutate(
    (key) => typeof key === "string" && key.startsWith(prefix),
    undefined,
    { revalidate: true }
  );
}
