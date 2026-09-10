/**
 * Código con el que Postgres rechaza lo que viola un índice único.
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const VIOLACION_DE_UNICIDAD = "23505";

/**
 * Reconoce el error con el que Postgres rechaza un duplicado. Las invariantes
 * viven en índices únicos parciales, así que el alta se intenta y se traduce el
 * choque; el `constraint` dice cuál de los índices se tocó.
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
