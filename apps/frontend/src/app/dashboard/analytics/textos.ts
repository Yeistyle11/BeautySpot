// Rotulos de las cifras que pueden no existir, donde un cero significaria otra
// cosa: que el negocio no vende, o que tiene la agenda vacia.
import { formatCurrency } from "@/lib/utils";
import type { CifrasDelPeriodo } from "@/lib/schemas/kpis";

/** El ticket medio del periodo, o el motivo por el que no hay cifra. */
export function textoDelTicket(periodo: CifrasDelPeriodo): string {
  if (periodo.avgTicket != null) return formatCurrency(periodo.avgTicket);

  return periodo.ticketDescuadrado
    ? "Sin calcular: hay ingresos sin cobro asociado"
    : "Sin cobros aún";
}

/** La ocupación del periodo, o el aviso de que aún no se ha medido. */
export function textoDeOcupacion(periodo: CifrasDelPeriodo): string {
  return periodo.ocupacion == null ? "Sin datos aún" : `${periodo.ocupacion}%`;
}
