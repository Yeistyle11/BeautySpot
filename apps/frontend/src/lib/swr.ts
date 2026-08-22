"use client";

import useSWR, { type SWRConfiguration, type Key } from "swr";
import { type ZodType } from "zod";
import { api, apiPublic } from "./api";
import { paginatedSchema, type PaginationMeta } from "./pagination";

export type { SWRConfiguration, Key };

export {
  paginationMetaSchema,
  paginatedSchema,
  type PaginationMeta,
} from "./pagination";

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
    async () =>
      paginatedSchema(itemSchema).parse(await api.get(path as string)),
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

/** Recarga todo lo cacheado. */
export async function revalidateAll(): Promise<void> {
  const { mutate } = await import("swr");
  await mutate(() => true, undefined, { revalidate: true });
}

export async function revalidatePrefix(prefix: string): Promise<void> {
  const { mutate } = await import("swr");
  await mutate(
    (key) => typeof key === "string" && key.startsWith(prefix),
    undefined,
    { revalidate: true }
  );
}
