// Forma de los endpoints de `GET /analytics/*`, compartida por el panel de
// inicio y la pantalla de reportes.
import { z } from "zod";
import type { Periodo } from "@/lib/periodo";

/** Cifras del negocio agregadas sobre un periodo, con el periodo que describen. */
export const cifrasDelPeriodoSchema = z.object({
  from: z.string(),
  to: z.string(),
  /** Días que abarca, extremos incluidos; es el divisor del promedio diario. */
  dias: z.number(),
  totalAppointments: z.number(),
  completedAppointments: z.number(),
  cancelledAppointments: z.number(),
  noShowAppointments: z.number(),
  totalRevenue: z.number(),
  avgDailyRevenue: z.number(),
  completionRate: z.number(),
  cancellationRate: z.number(),
  noShowRate: z.number(),
  newClients: z.number(),
  returningClients: z.number(),
  /** Ingresos entre los cobros que los produjeron; nulo si no hubo ninguno. */
  avgTicket: z.number().nullish(),
  /** Minutos vendidos sobre disponibles, en porcentaje. */
  ocupacion: z.number().nullish(),
});
export type CifrasDelPeriodo = z.infer<typeof cifrasDelPeriodoSchema>;

export const kpiDataSchema = z.object({
  today: z.object({
    totalAppointments: z.number(),
    completedAppointments: z.number(),
    totalRevenue: z.number(),
  }),
  periodo: cifrasDelPeriodoSchema,
  /** Mismas cifras del periodo anterior; solo si se pidieron. */
  comparado: cifrasDelPeriodoSchema.nullish(),
});
export type KpiData = z.infer<typeof kpiDataSchema>;

/** KPIs del periodo por defecto del backend, que es lo que usa el panel de inicio. */
export const KPIS_KEY = "/analytics/dashboard/kpis";

/** KPIs de un periodo concreto, con las cifras del anterior para comparar. */
export function kpisKey(periodo: Periodo): string {
  return `${KPIS_KEY}?from=${periodo.from}&to=${periodo.to}&comparar=true`;
}

export const RETENCION_KEY = "/analytics/dashboard/retencion";

export const retencionSchema = z.object({
  clientes: z.number(),
  recurrentes: z.number(),
  tasaDeRetorno: z.number(),
  diasEntreVisitas: z.number(),
});
export type Retencion = z.infer<typeof retencionSchema>;

export const SERVICIOS_KEY = "/analytics/dashboard/servicios";

/** Rentabilidad por servicio dentro del periodo. */
export function serviciosKey(periodo: Periodo): string {
  return `${SERVICIOS_KEY}?from=${periodo.from}&to=${periodo.to}`;
}

export const rentabilidadSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  veces: z.number(),
  ingresos: z.number(),
  minutos: z.number(),
  ingresoPorHora: z.number(),
});
export type Rentabilidad = z.infer<typeof rentabilidadSchema>;

/** Desempeño por profesional en el periodo; el nombre lo resuelve el core. */
export function profesionalesKey(periodo: Periodo): string {
  return `/analytics/reports/professionals?from=${periodo.from}&to=${periodo.to}`;
}

export const reporteProfesionalesSchema = z.object({
  period: z.object({ from: z.string(), to: z.string() }),
  professionals: z.array(
    z.object({
      professionalId: z.string(),
      appointments: z.number(),
      revenue: z.number(),
      avgRating: z.number(),
      /** Días del periodo en los que tuvo actividad. */
      days: z.number(),
    })
  ),
});
export type ReporteProfesionales = z.infer<typeof reporteProfesionalesSchema>;
