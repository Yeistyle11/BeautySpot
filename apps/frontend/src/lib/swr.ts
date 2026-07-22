"use client";

import useSWR, { type SWRConfiguration, type Key } from "swr";
import { api, apiPublic } from "./api";

export type { SWRConfiguration, Key };

export function useApi<T>(path: Key, options?: SWRConfiguration<T>) {
  return useSWR<T>(path, () => api.get<T>(path as string), options);
}

export function useApiPublic<T>(path: Key, options?: SWRConfiguration<T>) {
  return useSWR<T>(path, () => apiPublic.get<T>(path as string), options);
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
