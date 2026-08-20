/**
 * Condición SQL que acota una columna de texto a un catálogo cerrado, para los
 * `@Check` de las entidades que guardan estados.
 */
export function enCatalogo(
  columna: string,
  valores: readonly string[],
  admiteNulo = false
): string {
  const lista = valores.map((v) => `'${v}'`).join(", ");
  const dentro = `"${columna}" IN (${lista})`;
  return admiteNulo ? `"${columna}" IS NULL OR ${dentro}` : dentro;
}
