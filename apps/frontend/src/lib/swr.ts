"use client";

import useSWR, { type SWRConfiguration, type Key } from "swr";
import type { ZodType } from "zod";
import { api, apiPublic } from "./api";

export type { SWRConfiguration, Key };

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
