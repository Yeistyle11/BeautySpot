import { mutate as globalMutate } from "swr";
import type { ZodType } from "zod";
import { api } from "./api";
import { useApi, revalidatePrefix } from "./swr";
import {
  usePaginatedList,
  type PaginatedListParams,
} from "./use-paginated-list";

// Triangulo create/update/delete + mutate que comparten las paginas CRUD.
// Se extrae para reutilizarlo tanto en listas array como paginadas.
function useCrudMutations<T>(basePath: string, reload: () => Promise<unknown>) {
  const create = async (body: unknown) => {
    const created = await api.post<T>(basePath, body);
    await reload();
    return created;
  };

  const update = async (id: string, body: unknown) => {
    const updated = await api.patch<T>(`${basePath}/${id}`, body);
    await reload();
    return updated;
  };

  const remove = async (id: string) => {
    await api.delete(`${basePath}/${id}`);
    await reload();
  };

  return { reload, create, update, remove };
}

// Para colecciones acotadas cuyo endpoint devuelve un array plano
// (services, professionals, categorias...).
export function useCrudResource<T>({
  listKey,
  basePath,
  schema,
}: {
  listKey: string;
  basePath: string;
  schema?: ZodType<T[]>;
}) {
  const { data, isLoading, error } = useApi<T[]>(listKey, undefined, schema);
  return {
    items: data ?? [],
    isLoading,
    error,
    ...useCrudMutations<T>(basePath, () => globalMutate(listKey)),
  };
}

/**
 * Para colecciones que crecen sin limite ({ data, meta }): añade paginacion y
 * busqueda contra el servidor sobre el CRUD. Tras mutar se revalida el recurso
 * entero, no solo la pagina visible, porque insertar o borrar desplaza los
 * elementos de todas las paginas siguientes.
 */
export function usePaginatedCrudResource<T>({
  basePath,
  itemSchema,
  params,
  limit,
  search,
}: PaginatedListParams<T>) {
  const list = usePaginatedList<T>({
    basePath,
    itemSchema,
    params,
    limit,
    search,
  });

  return {
    items: list.items,
    meta: list.meta,
    page: list.page,
    setPage: list.setPage,
    listKey: list.listKey,
    isLoading: list.isLoading,
    error: list.error,
    isEmptySearch: list.isEmptySearch,
    ...useCrudMutations<T>(basePath, () => revalidatePrefix(basePath)),
  };
}
