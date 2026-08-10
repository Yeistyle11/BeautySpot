// Forma de `GET /analytics/dashboard/kpis`, compartida por el dashboard y la
// pagina de reportes. Refleja lo que devuelve DashboardService del
// analytics-service: `today` solo trae tres contadores, el resto va en
// `last30Days`.
import { z } from "zod";

export const KPIS_KEY = "/analytics/dashboard/kpis";

export const kpiDataSchema = z.object({
  today: z.object({
    totalAppointments: z.number(),
    completedAppointments: z.number(),
    totalRevenue: z.number(),
  }),
  last30Days: z.object({
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
    /** Ingresos entre citas atendidas. */
    avgTicket: z.number().nullish(),
    /** Minutos vendidos sobre disponibles, en porcentaje. */
    ocupacion: z.number().nullish(),
  }),
});

export const RETENCION_KEY = "/analytics/dashboard/retencion";

export const retencionSchema = z.object({
  clientes: z.number(),
  recurrentes: z.number(),
  tasaDeRetorno: z.number(),
  diasEntreVisitas: z.number(),
});
export type Retencion = z.infer<typeof retencionSchema>;

export const SERVICIOS_KEY = "/analytics/dashboard/servicios";

export const rentabilidadSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  veces: z.number(),
  ingresos: z.number(),
  minutos: z.number(),
  ingresoPorHora: z.number(),
});
export type Rentabilidad = z.infer<typeof rentabilidadSchema>;

export type KpiData = z.infer<typeof kpiDataSchema>;
