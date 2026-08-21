/**
 * Código con el que Postgres rechaza lo que viola un índice único.
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const VIOLACION_DE_UNICIDAD = "23505";

/**
 * Reconoce el error con el que Postgres rechaza un duplicado. Las invariantes
 * de negocio viven en índices únicos parciales —una caja abierta por sede, un
 * cobro vivo por cita, una reseña por cita—, así que cada alta se intenta y se
 * traduce el choque, en lugar de comprobar antes: entre la comprobación y la
 * escritura cabe otra transacción.
 *
 * Deja ver el `constraint` para poder distinguir cuál de los índices se tocó
 * cuando la tabla tiene más de uno.
 */
export function esViolacionDeUnicidad(
  error: unknown
): error is { code: string; constraint?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === VIOLACION_DE_UNICIDAD
  );
}
