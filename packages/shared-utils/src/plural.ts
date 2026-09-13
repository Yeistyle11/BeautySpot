/** Concordancia de número en el texto que lee el usuario. */
export function plural(
  cantidad: number,
  singular: string,
  plural: string
): string {
  return cantidad === 1 ? singular : plural;
}

/** La cantidad con su palabra ya concordada: «1 minuto», «3 minutos». */
export function conCantidad(
  cantidad: number,
  singular: string,
  formaPlural: string
): string {
  return `${cantidad} ${plural(cantidad, singular, formaPlural)}`;
}
