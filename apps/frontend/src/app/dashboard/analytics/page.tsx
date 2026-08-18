"use client";

// Pagina de reportes: cifras del negocio sobre el periodo elegido, comparadas
// con el periodo anterior y exportables.
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { z } from "zod";
import {
  Calendar,
  Download,
  Gauge,
  Scissors,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { useApi } from "@/lib/swr";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import {
  periodoValido,
  resolverPeriodo,
  PERIODO_POR_DEFECTO,
  type Periodo,
  type PeriodoId,
} from "@/lib/periodo";
import {
  kpiDataSchema,
  kpisKey,
  profesionalesKey,
  rentabilidadSchema,
  reporteProfesionalesSchema,
  retencionSchema,
  serviciosKey,
  RETENCION_KEY,
  type KpiData,
  type Rentabilidad,
  type ReporteProfesionales,
  type Retencion,
} from "@/lib/schemas/kpis";
import { PeriodPicker } from "./period-picker";
import { MetricRow } from "./metric-row";
import {
  filasDeProfesionales,
  ProfessionalsTable,
} from "./professionals-table";
import {
  exportarProfesionales,
  exportarResumen,
  exportarServicios,
} from "./export";

/** Lo que hace falta del equipo para poner nombre a cada fila del reporte. */
const profesionalRefSchema = z.object({ id: z.string(), name: z.string() });

export default function AnalyticsPage() {
  const [seleccionado, setSeleccionado] =
    useState<PeriodoId>(PERIODO_POR_DEFECTO);
  const [personalizado, setPersonalizado] = useState<Periodo>(() =>
    resolverPeriodo("personalizado")
  );

  const periodo =
    seleccionado === "personalizado"
      ? personalizado
      : resolverPeriodo(seleccionado);

  // Un periodo al reves no se consulta: se avisa y se espera a que lo corrija.
  const consultable = periodoValido(periodo);

  const {
    data,
    isLoading: loading,
    error: loadError,
    mutate: recargar,
  } = useApi<KpiData>(
    consultable ? kpisKey(periodo) : null,
    undefined,
    kpiDataSchema
  );
  const { data: retencion } = useApi<Retencion>(
    RETENCION_KEY,
    undefined,
    retencionSchema
  );
  const { data: servicios } = useApi<Rentabilidad[]>(
    consultable ? serviciosKey(periodo) : null,
    undefined,
    z.array(rentabilidadSchema)
  );
  const { data: reporte } = useApi<ReporteProfesionales>(
    consultable ? profesionalesKey(periodo) : null,
    undefined,
    reporteProfesionalesSchema
  );
  const { data: equipo } = useApi(
    "/core/professionals",
    undefined,
    z.array(profesionalRefSchema)
  );

  const filasDeEquipo = useMemo(
    () => filasDeProfesionales(reporte, equipo),
    [reporte, equipo]
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">
            {consultable
              ? `Del ${periodo.from} al ${periodo.to}`
              : "Elige un periodo"}
          </p>
        </div>
        {data && (
          <Button
            variant="outline"
            onClick={() =>
              exportarResumen(periodo, data.periodo, data.comparado)
            }
          >
            <Download className="mr-2 h-4 w-4" /> Exportar resumen
          </Button>
        )}
      </div>

      <div className="mb-6">
        <PeriodPicker
          seleccionado={seleccionado}
          periodo={periodo}
          onSeleccionar={(id) => {
            // Al pasar a personalizado se parte del periodo que ya se veia, en
            // vez de vaciar los campos y dejar la pantalla sin cifras.
            if (id === "personalizado") setPersonalizado(periodo);
            setSeleccionado(id);
          }}
          onPersonalizar={setPersonalizado}
        />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                Citas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MetricRow
                etiqueta="Total citas"
                valor={data.periodo.totalAppointments}
                actual={data.periodo.totalAppointments}
                anterior={data.comparado?.totalAppointments}
              />
              <MetricRow
                etiqueta="Completadas"
                valor={data.periodo.completedAppointments}
                actual={data.periodo.completedAppointments}
                anterior={data.comparado?.completedAppointments}
                className="text-success"
              />
              {/*
                En cancelaciones y ausencias, bajar es la buena noticia: pintar
                de rojo toda caida diria lo contrario de lo que paso.
              */}
              <MetricRow
                etiqueta="Canceladas"
                valor={data.periodo.cancelledAppointments}
                actual={data.periodo.cancelledAppointments}
                anterior={data.comparado?.cancelledAppointments}
                bajarEsBueno
                className="text-red-600"
              />
              <MetricRow
                etiqueta="No asistieron"
                valor={data.periodo.noShowAppointments}
                actual={data.periodo.noShowAppointments}
                anterior={data.comparado?.noShowAppointments}
                bajarEsBueno
                className="text-amber-600"
              />
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
              <MetricRow
                etiqueta="Total del periodo"
                valor={formatCurrency(data.periodo.totalRevenue)}
                actual={data.periodo.totalRevenue}
                anterior={data.comparado?.totalRevenue}
              />
              {/*
                Reparte el total entre los dias del periodo, no entre los que
                tuvieron movimiento: un negocio que abrio ayer leeria su unica
                jornada como si fuera su media, y el nombre lo dice para que
                nadie lo confunda con "lo que gano al dia".
              */}
              <MetricRow
                etiqueta={`Promedio por día (${data.periodo.dias})`}
                valor={formatCurrency(data.periodo.avgDailyRevenue)}
                actual={data.periodo.avgDailyRevenue}
                anterior={data.comparado?.avgDailyRevenue}
              />
              <MetricRow
                etiqueta="Tasa completado"
                valor={`${data.periodo.completionRate}%`}
                actual={data.periodo.completionRate}
                anterior={data.comparado?.completionRate}
              />
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
              {/*
                Un cliente cuenta como nuevo al venir por primera vez, no al
                darlo de alta: una ficha creada y sin visita todavia no es un
                cliente captado, y el nombre lo dice para que un cero no se lea
                como que la metrica esta rota.
              */}
              <MetricRow
                etiqueta="Nuevos (primera visita)"
                valor={data.periodo.newClients}
                actual={data.periodo.newClients}
                anterior={data.comparado?.newClients}
              />
              <MetricRow
                etiqueta="Recurrentes"
                valor={data.periodo.returningClients}
                actual={data.periodo.returningClients}
                anterior={data.comparado?.returningClients}
              />
              {/*
                Retorno y frecuencia salen de toda la vida del cliente, no del
                periodo: quien vuelve cada cuatro meses no cabe en una semana, y
                acotarlo diria que nadie repite.
              */}
              {retencion && (
                <>
                  <MetricRow
                    etiqueta="Tasa de retorno (histórico)"
                    valor={`${retencion.tasaDeRetorno}%`}
                  />
                  <MetricRow
                    etiqueta="Vuelven cada (histórico)"
                    valor={`${retencion.diasEntreVisitas} días`}
                  />
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
              {/*
                Sin cobros en el periodo no hay ticket que promediar, y un cero
                ahi se lee como que el negocio no vende.
              */}
              <MetricRow
                etiqueta="Ticket medio"
                valor={
                  data.periodo.avgTicket == null
                    ? "Sin cobros aún"
                    : formatCurrency(data.periodo.avgTicket)
                }
                actual={data.periodo.avgTicket}
                anterior={data.comparado?.avgTicket}
              />
              <MetricRow
                etiqueta="Ocupación de agenda"
                valor={`${data.periodo.ocupacion ?? 0}%`}
                actual={data.periodo.ocupacion}
                anterior={data.comparado?.ocupacion}
              />
            </CardContent>
          </Card>

          <ProfessionalsTable filas={filasDeEquipo} />
          {filasDeEquipo.length > 0 && (
            <div className="-mt-4 lg:col-span-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportarProfesionales(periodo, filasDeEquipo)}
              >
                <Download className="mr-2 h-4 w-4" /> Exportar profesionales
              </Button>
            </div>
          )}

          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Scissors className="h-5 w-5" />
                Rentabilidad por servicio
              </CardTitle>
              {(servicios ?? []).length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportarServicios(periodo, servicios ?? [])}
                >
                  <Download className="mr-2 h-4 w-4" /> Exportar
                </Button>
              )}
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
