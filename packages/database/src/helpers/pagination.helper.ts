import { FindManyOptions, Repository, ObjectLiteral } from "typeorm";
import { IPaginatedResponse } from "@beautyspot/shared-types";

export interface PaginateParams {
  page: number;
  limit: number;
  offset: number;
  sort: string;
  order: "ASC" | "DESC";
}

export async function paginate<T extends ObjectLiteral>(
  repository: Repository<T>,
  params: PaginateParams,
  findOptions?: FindManyOptions<T>,
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

  const totalPages = Math.ceil(total / params.limit);

  return {
    data,
    meta: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1,
    },
  };
}
