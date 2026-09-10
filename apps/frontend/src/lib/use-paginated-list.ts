"use client";

import { useCallback, useMemo, useState } from "react";
import type { ZodType } from "zod";
import { usePaginatedApi } from "./swr";
import { useDebouncedValue } from "./use-debounced-value";

export const DEFAULT_PAGE_SIZE = 20;

export interface PaginatedListParams<T> {
  basePath: string;
  itemSchema: ZodType<T>;
  /** Filtros adicionales del endpoint; los vacios se omiten de la URL. */
  params?: Record<string, string | number | boolean | undefined>;
  limit?: number;
  /** Texto de busqueda en crudo: el hook lo debouncea y lo envia al backend. */
  search?: string;
}

/** Compone la query string ignorando los filtros vacios. */
function buildKey(
  basePath: string,
  entries: Record<string, string | number | boolean | undefined>
): string {
  const query = new URLSearchParams();
  Object.entries(entries).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Lista paginada contra el servidor: posee la pagina actual, compone la key de
 * SWR y expone el `meta` del backend. La busqueda tambien viaja al servidor,
 * porque filtrar en cliente solo miraria la pagina ya descargada.
 */
export function usePaginatedList<T>({
  basePath,
  itemSchema,
  params,
  limit = DEFAULT_PAGE_SIZE,
  search = "",
}: PaginatedListParams<T>) {
  const debouncedSearch = useDebouncedValue(search);

  // Los filtros se serializan para poder compararlos por valor: `params` suele
  // ser un objeto literal nuevo en cada render.
  const serializedParams = JSON.stringify(params ?? {});

  // La pagina se guarda junto a la consulta de la que salio: cambiar la busqueda
  // o un filtro reordena la coleccion entera, y al no coincidir ya la consulta se
  // vuelve a la primera en vez de enseñar un hueco vacio.
  const consulta = `${serializedParams}|${limit}|${debouncedSearch}`;
  const [elegida, setElegida] = useState({ consulta, pagina: 1 });
  const page = elegida.consulta === consulta ? elegida.pagina : 1;
  const setPage = useCallback(
    (pagina: number) => setElegida({ consulta, pagina }),
    [consulta]
  );

  const listKey = useMemo(
    () =>
      buildKey(basePath, {
        ...(JSON.parse(serializedParams) as Record<string, string | undefined>),
        page,
        limit,
        search: debouncedSearch || undefined,
      }),
    [basePath, serializedParams, page, limit, debouncedSearch]
  );

  const { items, meta, isLoading, error, mutate } = usePaginatedApi<T>(
    listKey,
    itemSchema,
    {
      // Si el backend recorta la ultima pagina —al borrar el unico elemento que
      // quedaba en ella—, se retrocede en vez de dejar la vista vacia. Se hace al
      // llegar la respuesta, que es cuando se sabe.
      onSuccess: (datos) => {
        const total = datos?.meta?.totalPages ?? 0;
        if (total > 0 && page > total) setPage(total);
      },
    }
  );

  return {
    items,
    meta,
    page,
    setPage,
    listKey,
    isLoading,
    error,
    mutate,
    /** True cuando hay busqueda activa y el backend no devolvio nada. */
    isEmptySearch: !isLoading && items.length === 0 && !!debouncedSearch,
  };
}
