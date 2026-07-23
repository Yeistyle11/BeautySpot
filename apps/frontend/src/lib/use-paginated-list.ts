"use client";

import { useEffect, useMemo, useState } from "react";
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
 * SWR con `page`/`limit`/`search` y expone el `meta` del backend para pintar la
 * navegacion. La busqueda tambien viaja al servidor, porque filtrar en cliente
 * solo miraria la pagina ya descargada y daria "sin resultados" en falso.
 */
export function usePaginatedList<T>({
  basePath,
  itemSchema,
  params,
  limit = DEFAULT_PAGE_SIZE,
  search = "",
}: PaginatedListParams<T>) {
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  // Los filtros se serializan para poder compararlos por valor: `params` suele
  // ser un objeto literal nuevo en cada render.
  const serializedParams = JSON.stringify(params ?? {});

  // Cambiar la busqueda o un filtro reordena la coleccion entera: seguir en la
  // pagina 5 mostraria un hueco vacio.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, serializedParams, limit]);

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
    itemSchema
  );

  // Si el backend recorta la ultima pagina (por ejemplo al borrar el unico
  // elemento que quedaba en ella), se retrocede en vez de dejar la vista vacia.
  useEffect(() => {
    if (meta && meta.totalPages > 0 && page > meta.totalPages) {
      setPage(meta.totalPages);
    }
  }, [meta, page]);

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
