// Armado de los CSV del reporte: traduce las cifras del periodo a filas.
import { downloadCsv } from "@/lib/export-csv";
import { nombreDelPeriodo, variacion, type Periodo } from "@/lib/periodo";
import type { CifrasDelPeriodo, Rentabilidad } from "@/lib/schemas/kpis";
import type { FilaDeProfesional } from "./professionals-table";

/** Una fila del resumen: el indicador, su cifra y la del periodo anterior. */
type FilaDeResumen = (string | number | null)[];

/** Filas del resumen del periodo, con las cifras en bruto y sin formato. */
export function filasDelResumen(
  cifras: CifrasDelPeriodo,
  comparado?: CifrasDelPeriodo | null
): FilaDeResumen[] {
  const fila = (
    etiqueta: string,
    valor: number | null,
    antes: number | null | undefined
  ): FilaDeResumen => [
    etiqueta,
    valor,
    comparado ? (antes ?? null) : null,
    comparado && valor != null ? variacion(valor, antes) : null,
  ];

  return [
    fila(
      "Citas totales",
      cifras.totalAppointments,
      comparado?.totalAppointments
    ),
    fila(
      "Citas completadas",
      cifras.completedAppointments,
      comparado?.completedAppointments
    ),
    fila(
      "Citas canceladas",
      cifras.cancelledAppointments,
      comparado?.cancelledAppointments
    ),
    fila(
      "No asistieron",
      cifras.noShowAppointments,
      comparado?.noShowAppointments
    ),
    fila(
      "Tasa de completado (%)",
      cifras.completionRate,
      comparado?.completionRate
    ),
    fila(
      "Tasa de cancelacion (%)",
      cifras.cancellationRate,
      comparado?.cancellationRate
    ),
    fila("Tasa de no asistencia (%)", cifras.noShowRate, comparado?.noShowRate),
    fila("Ingresos", cifras.totalRevenue, comparado?.totalRevenue),
    fila(
      "Promedio por dia del periodo",
      cifras.avgDailyRevenue,
      comparado?.avgDailyRevenue
    ),
    fila("Ticket medio", cifras.avgTicket ?? null, comparado?.avgTicket),
    fila(
      "Ocupacion de agenda (%)",
      cifras.ocupacion ?? null,
      comparado?.ocupacion
    ),
    fila("Clientes nuevos", cifras.newClients, comparado?.newClients),
    fila(
      "Clientes recurrentes",
      cifras.returningClients,
      comparado?.returningClients
    ),
  ];
}

/** Cabeceras del resumen; las dos ultimas solo tienen sentido al comparar. */
export function cabecerasDelResumen(comparando: boolean): string[] {
  return comparando
    ? ["Indicador", "Periodo", "Periodo anterior", "Variacion (%)"]
    : ["Indicador", "Periodo"];
}

/** Descarga el resumen del periodo, con la comparativa si se pidio. */
export function exportarResumen(
  periodo: Periodo,
  cifras: CifrasDelPeriodo,
  comparado?: CifrasDelPeriodo | null
): void {
  const comparando = Boolean(comparado);
  const filas = filasDelResumen(cifras, comparado);

  downloadCsv(
    `reporte_${nombreDelPeriodo(periodo)}`,
    cabecerasDelResumen(comparando),
    comparando ? filas : filas.map(([etiqueta, valor]) => [etiqueta, valor])
  );
}

/** Descarga la rentabilidad por servicio del periodo. */
export function exportarServicios(
  periodo: Periodo,
  servicios: Rentabilidad[]
): void {
  downloadCsv(
    `servicios_${nombreDelPeriodo(periodo)}`,
    ["Servicio", "Veces", "Ingresos", "Minutos", "Ingreso por hora"],
    servicios.map((s) => [
      s.serviceName,
      s.veces,
      s.ingresos,
      s.minutos,
      s.ingresoPorHora,
    ])
  );
}

/** Descarga el desempeno por profesional del periodo. */
export function exportarProfesionales(
  periodo: Periodo,
  filas: FilaDeProfesional[]
): void {
  downloadCsv(
    `profesionales_${nombreDelPeriodo(periodo)}`,
    ["Profesional", "Citas", "Ingresos", "Valoracion", "Dias activos"],
    filas.map((p) => [
      p.nombre,
      p.appointments,
      p.revenue,
      // Sin valoraciones se deja vacio: un cero se leeria como la peor nota.
      p.avgRating > 0 ? p.avgRating : null,
      p.days,
    ])
  );
}
