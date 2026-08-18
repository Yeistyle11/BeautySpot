// Como se nombra cada metodo de cobro en el panel. Vive aqui, y no en cada
// pantalla, porque el mismo metodo se llamaba de dos maneras distintas en la
// misma seccion y el recepcionista tenia que deducir que eran lo mismo.

/**
 * Nombre de cada metodo de cobro.
 *
 * "Datafono" y no "Tarjeta": en Colombia es el termino de calle, el del
 * mostrador, y quien usa este panel esta detras del mostrador. El cliente dira
 * "tarjeta", pero esta pantalla no es para el.
 */
export const ETIQUETAS_DE_METODO: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Datáfono",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
};

/** Nombre del metodo, o el codigo tal cual si llega uno que no conocemos. */
export function nombreDelMetodo(metodo: string): string {
  return ETIQUETAS_DE_METODO[metodo] ?? metodo;
}
