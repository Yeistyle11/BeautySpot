import {
  FindManyOptions,
  Repository,
  SelectQueryBuilder,
  ObjectLiteral,
} from "typeorm";
import { IPaginatedResponse } from "@beautyspot/shared-types";

/** Parámetros de paginación ya validados que consume {@link paginate}. */
export interface PaginateParams {
  page: number;
  limit: number;
  offset: number;
  sort: string;
  order: "ASC" | "DESC";
}

/**
 * Ejecuta una consulta paginada sobre un repositorio y devuelve los datos junto
 * con la metadata estándar de paginación ({@link IPaginatedResponse}).
 */
export async function paginate<T extends ObjectLiteral>(
  repository: Repository<T>,
  params: PaginateParams,
  findOptions?: FindManyOptions<T>
): Promise<IPaginatedResponse<T>> {
  // Un `order` explícito en findOptions tiene prioridad (permite ordenar por
  // varios campos, ej. date DESC + startTime ASC); si no se pasa, se usa el
  // sort validado que llega en los parámetros de paginación.
  const { order: explicitOrder, ...restOptions } = findOptions ?? {};
  const [data, total] = await repository.findAndCount({
    ...restOptions,
    skip: params.offset,
    take: params.limit,
    order: (explicitOrder ?? {
      [params.sort]: params.order,
    }) as FindManyOptions<T>["order"],
  });

  return { data, meta: metadataDePaginacion(params, total) };
}

/**
 * Pagina una consulta ya construida con el query builder y devuelve el mismo
 * sobre que {@link paginate}. Existe porque `paginate` solo acepta un
 * repositorio: sin esto, todo listado que necesite un `join`, un filtro
 * calculado o un orden por distancia acaba reescribiendo la paginación a mano,
 * y con ella el sobre de la respuesta.
 *
 * El orden lo pone quien construye la consulta, que es el único que sabe si
 * ordena por una columna o por una expresión.
 */
export async function paginarQueryBuilder<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  params: PaginateParams
): Promise<IPaginatedResponse<T>> {
  const [data, total] = await qb
    .skip(params.offset)
    .take(params.limit)
    .getManyAndCount();

  return { data, meta: metadataDePaginacion(params, total) };
}

/** Metadatos de la página a partir de lo pedido y de cuántos hay en total. */
export function metadataDePaginacion(
  params: Pick<PaginateParams, "page" | "limit">,
  total: number
): IPaginatedResponse<never>["meta"] {
  const totalPages = Math.ceil(total / params.limit);

  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages,
    hasNext: params.page < totalPages,
    hasPrev: params.page > 1,
  };
}
