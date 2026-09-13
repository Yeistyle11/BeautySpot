// Rotulos de las cifras que pueden no existir, donde un cero significaria otra
// cosa: que el negocio no vende, o que tiene la agenda vacia.
import { formatCurrency, formatPorcentaje } from "@/lib/utils";
import type { CifrasDelPeriodo, Retencion } from "@/lib/schemas/kpis";

/** Lo que se escribe donde la cifra no existe todavía. */
export const SIN_DATOS = "Sin datos aún";

/** El ticket medio del periodo, o el motivo por el que no hay cifra. */
export function textoDelTicket(periodo: CifrasDelPeriodo): string {
  if (periodo.avgTicket != null) return formatCurrency(periodo.avgTicket);

  return periodo.ticketDescuadrado
    ? "Sin calcular: hay ingresos sin cobro asociado"
    : "Sin cobros aún";
}

/** La ocupación del periodo, o el aviso de que aún no se ha medido. */
export function textoDeOcupacion(periodo: CifrasDelPeriodo): string {
  return periodo.ocupacion == null
    ? SIN_DATOS
    : formatPorcentaje(periodo.ocupacion);
}

/** La tasa de citas cerradas, o el aviso de que no hubo ninguna que cerrar. */
export function textoDeTasaCompletado(periodo: CifrasDelPeriodo): string {
  return periodo.totalAppointments === 0
    ? SIN_DATOS
    : formatPorcentaje(periodo.completionRate);
}

/** Cuántos clientes repiten, o el aviso de que aún no hay ninguno del que decirlo. */
export function textoDeTasaDeRetorno(retencion: Retencion): string {
  return retencion.clientes === 0
    ? SIN_DATOS
    : formatPorcentaje(retencion.tasaDeRetorno);
}

/** Cada cuánto vuelve un cliente, o el aviso de que nadie ha repetido. */
export function textoDeFrecuencia(retencion: Retencion): string {
  return retencion.recurrentes === 0
    ? SIN_DATOS
    : `${retencion.diasEntreVisitas} días`;
}
