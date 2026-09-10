/**
 * Códigos con los que Postgres rechaza una entrada que nunca debió llegarle.
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const TEXTO_INVALIDO_PARA_EL_TIPO = "22P02";
const VIOLACION_DE_RESTRICCION = "23514";

interface ErrorDePostgres {
  code: string;
  constraint?: string;
}

function conCodigo(error: unknown, codigo: string): error is ErrorDePostgres {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === codigo
  );
}

/**
 * Reconoce el error con el que Postgres rechaza un texto que no encaja en el
 * tipo de la columna: casi siempre un id de la URL que no es un UUID. Es la red
 * de seguridad; la validacion es el `ParseUUIDPipe` que declara cada ruta.
 */
export function esIdentificadorInvalido(
  error: unknown
): error is ErrorDePostgres {
  return conCodigo(error, TEXTO_INVALIDO_PARA_EL_TIPO);
}

/**
 * Reconoce el error con el que Postgres rechaza lo que incumple un `CHECK`.
 * Los catalogos acotados viven en restricciones con nombre, y el nombre es lo
 * unico que distingue cual se toco cuando la tabla tiene varias.
 */
export function esViolacionDeCatalogo(
  error: unknown
): error is ErrorDePostgres {
  return conCodigo(error, VIOLACION_DE_RESTRICCION);
}
