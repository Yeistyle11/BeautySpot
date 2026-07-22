import { mutate as globalMutate } from "swr";
import { api } from "./api";
import { useApi } from "./swr";

// Centraliza el triangulo create/update/delete + mutate que se repetia
// identico en varias paginas CRUD (services, professionals, clients).
// No aplica a paginas cuyo "update" dispara multiples llamadas distintas
// (ej. staff/page.tsx) -- ahi forzar este molde perderia claridad sin
// eliminar duplicacion real.
export function useCrudResource<T>({
  listKey,
  basePath,
}: {
  listKey: string;
  basePath: string;
}) {
  const { data, isLoading, error } = useApi<T[]>(listKey);

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

  return {
    items: data ?? [],
    isLoading,
    error,
    reload,
    create,
    update,
    remove,
  };
}
