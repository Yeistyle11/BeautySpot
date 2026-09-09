// Como se nombra cada metodo de cobro en el panel, para toda la aplicacion.

/** Nombre de cada metodo de cobro, con el termino de mostrador ("Datafono"). */
export const ETIQUETAS_DE_METODO: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Datáfono",
  TRANSFER: "Transferencia",
  OTHER: "Otro",
  /** El cobro se repartio entre varios; el detalle esta en sus lineas. */
  MIXED: "Mixto",
  /** Movimiento de caja anotado a mano, sin cobro detras. */
  MANUAL: "Anotado a mano",
};

/** Nombre del metodo, o el codigo tal cual si llega uno que no conocemos. */
export function nombreDelMetodo(metodo: string): string {
  return ETIQUETAS_DE_METODO[metodo] ?? metodo;
}
