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
 * tipo de la columna: casi siempre un identificador de la URL que no es un
 * UUID. Sin traducirlo, escribir mal una URL se registra como un fallo del
 * servidor y acaba tapando los 500 que sí importan.
 *
 * Es la red de seguridad, no la validación: cada ruta declara su
 * `ParseUUIDPipe`, que responde antes de llegar a la base.
 */
export function esIdentificadorInvalido(
  error: unknown
): error is ErrorDePostgres {
  return conCodigo(error, TEXTO_INVALIDO_PARA_EL_TIPO);
}

/**
 * Reconoce el error con el que Postgres rechaza lo que incumple un `CHECK`.
 * Los catálogos acotados —el medio de cobro, el estado de una reseña— viven en
 * restricciones con nombre, así que el nombre es lo único que distingue cuál
 * se tocó cuando la tabla tiene varias.
 */
export function esViolacionDeCatalogo(
  error: unknown
): error is ErrorDePostgres {
  return conCodigo(error, VIOLACION_DE_RESTRICCION);
}
