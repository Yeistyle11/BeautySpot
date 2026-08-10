"use client";

// Pagina de reportes: KPIs del negocio (ingresos, clientes, citas) leidos del analytics-service.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { z } from "zod";
import { TrendingUp, Users, Calendar, Gauge, Scissors } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useApi } from "@/lib/swr";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import {
  kpiDataSchema,
  KPIS_KEY,
  rentabilidadSchema,
  retencionSchema,
  RETENCION_KEY,
  SERVICIOS_KEY,
  type KpiData,
  type Rentabilidad,
  type Retencion,
} from "@/lib/schemas/kpis";

export default function AnalyticsPage() {
  const {
    data,
    isLoading: loading,
    error: loadError,
    mutate: recargar,
  } = useApi<KpiData>(KPIS_KEY, undefined, kpiDataSchema);
  const { data: retencion } = useApi<Retencion>(
    RETENCION_KEY,
    undefined,
    retencionSchema
  );
  const { data: servicios } = useApi<Rentabilidad[]>(
    SERVICIOS_KEY,
    undefined,
    z.array(rentabilidadSchema)
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-muted-foreground">Análisis de tu negocio</p>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                Últimos 30 días
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total citas</span>
                <span className="font-semibold">
                  {data.last30Days.totalAppointments}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completadas</span>
                <span className="text-success font-semibold">
                  {data.last30Days.completedAppointments}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Canceladas</span>
                <span className="font-semibold text-red-600">
                  {data.last30Days.cancelledAppointments}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">No asistieron</span>
                <span className="font-semibold text-amber-600">
                  {data.last30Days.noShowAppointments}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5" />
                Ingresos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total 30 días</span>
                <span className="font-semibold">
                  {formatCurrency(data.last30Days.totalRevenue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Promedio diario</span>
                <span className="font-semibold">
                  {formatCurrency(data.last30Days.avgDailyRevenue)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tasa completado</span>
                <span className="font-semibold">
                  {data.last30Days.completionRate.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5" />
                Clientes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nuevos</span>
                <span className="font-semibold">
                  {data.last30Days.newClients}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recurrentes</span>
                <span className="font-semibold">
                  {data.last30Days.returningClients}
                </span>
              </div>
              {retencion && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Tasa de retorno
                    </span>
                    <span className="font-semibold">
                      {retencion.tasaDeRetorno}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vuelven cada</span>
                    <span className="font-semibold">
                      {retencion.diasEntreVisitas} días
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gauge className="h-5 w-5" />
                Capacidad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ticket medio</span>
                <span className="font-semibold">
                  {formatCurrency(data.last30Days.avgTicket ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Ocupación de agenda
                </span>
                <span className="font-semibold">
                  {data.last30Days.ocupacion ?? 0}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Scissors className="h-5 w-5" />
                Rentabilidad por servicio
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(servicios ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Aún no hay servicios atendidos en el periodo.
                </p>
              ) : (
                <div className="space-y-2">
                  {(servicios ?? []).map((s) => (
                    <div
                      key={s.serviceId}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{s.serviceName}</p>
                        <p className="text-muted-foreground text-xs">
                          {s.veces} {s.veces === 1 ? "vez" : "veces"} ·{" "}
                          {s.minutos} min
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {formatCurrency(s.ingresos)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatCurrency(s.ingresoPorHora)} / hora
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : loadError ? (
        <ErrorDeCarga
          error={loadError}
          recurso="los reportes"
          onReintentar={() => void recargar()}
        />
      ) : (
        <EmptyState
          icon={TrendingUp}
          titulo="No hay datos disponibles"
          descripcion="Los reportes se llenan a medida que se registran citas y pagos."
        />
      )}
    </div>
  );
}
