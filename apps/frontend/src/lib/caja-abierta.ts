import { api } from "./api";

/**
 * Motivo por el que no se puede cobrar, o `null` si se puede. El efectivo sale
 * del cajon, asi que exige una caja abierta; el resto de metodos no.
 *
 * Se comprueba antes de escribir nada: el cobro y el cierre de la cita son dos
 * escrituras sin transaccion, y sin esto la cita queda cerrada y sin cobrar.
 */
export async function motivoParaNoCobrar(
  metodo: string
): Promise<string | null> {
  if (metodo !== "CASH") return null;
  const caja = await api.get<{ id: string } | null>(
    "/payment/cash-register/active"
  );
  return caja
    ? null
    : "No hay una caja abierta: ábrela antes de cobrar en efectivo";
}
