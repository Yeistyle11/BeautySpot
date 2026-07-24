/** Resultado paginado interno de los servicios: los ítems y sus totales. */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
