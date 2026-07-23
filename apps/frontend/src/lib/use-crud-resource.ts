import { mutate as globalMutate } from "swr";
import type { ZodType } from "zod";
import { api } from "./api";
import { useApi, usePaginatedApi } from "./swr";

// Triangulo create/update/delete + mutate que comparten las paginas CRUD.
// Se extrae para reutilizarlo tanto en listas array como paginadas.
function useCrudMutations<T>(listKey: string, basePath: string) {
  const reload = () => globalMutate(listKey);

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
    ...useCrudMutations<T>(listKey, basePath),
  };
}

// Para colecciones que crecen sin limite cuyo endpoint devuelve { data, meta }
// (clientes, pagos...). Expone ademas `meta` con el total y la navegacion.
export function usePaginatedCrudResource<T>({
  listKey,
  basePath,
  itemSchema,
}: {
  listKey: string;
  basePath: string;
  itemSchema: ZodType<T>;
}) {
  const { items, meta, isLoading, error } = usePaginatedApi<T>(
    listKey,
    itemSchema
  );
  return {
    items,
    meta,
    isLoading,
    error,
    ...useCrudMutations<T>(listKey, basePath),
  };
}
