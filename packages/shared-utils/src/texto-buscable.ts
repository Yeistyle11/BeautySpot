// Cotejo de texto sin tildes ni mayúsculas, compartido por el cliente y por SQL.

/** Vocales acentuadas y sus equivalentes sin tilde, en el mismo orden. */
const ACENTUADAS = "áàäâãéèëêíìïîóòöôõúùüûýÿÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÝ";
const SIN_ACENTO = "aaaaaeeeeiiiiooooouuuuyyAAAAAEEEEIIIIOOOOOUUUUY";

/**
 * Deja el texto en su forma cotejable: minúsculas y sin tildes. La eñe se
 * conserva, que en español distingue palabras.
 */
export function sinTildes(texto: string): string {
  let salida = "";
  for (const caracter of texto) {
    const i = ACENTUADAS.indexOf(caracter);
    salida += i === -1 ? caracter : SIN_ACENTO[i];
  }
  return salida.toLowerCase();
}

/**
 * Expresión SQL que deja una columna en la misma forma que {@link sinTildes},
 * con el `translate` de Postgres.
 *
 * Los índices que sirven la búsqueda del marketplace están creados sobre esta
 * misma expresión (migración `BusquedaSinTildes`), así que cambiar las cadenas
 * de arriba obliga a rehacerlos: si no, dejan de usarse sin que nada falle.
 */
export function columnaSinTildes(columna: string): string {
  return `translate(lower(${columna}), '${ACENTUADAS}', '${SIN_ACENTO}')`;
}
