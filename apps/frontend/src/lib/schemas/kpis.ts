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
  }),
});

export type KpiData = z.infer<typeof kpiDataSchema>;
