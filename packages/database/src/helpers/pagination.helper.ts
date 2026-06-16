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
  const [data, total] = await repository.findAndCount({
    ...findOptions,
    skip: params.offset,
    take: params.limit,
    order: {
      [params.sort]: params.order,
    } as FindManyOptions<T>["order"],
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
