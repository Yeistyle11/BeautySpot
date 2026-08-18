"use client";

// Pagina principal del dashboard: resumen del dia con KPIs y proximas citas.
import { useMemo } from "react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Users,
  DollarSign,
  Clock,
  Star,
  Scissors,
  CheckCircle,
  TrendingUp,
} from "lucide-react";
import {
  formatCurrency,
  formatDayMonth,
  formatTime,
  toLocalDateKey,
} from "@/lib/utils";
import { getAppointmentStatus } from "@/lib/status";
import { useAuthStore } from "@/lib/store";
import { useApi, paginatedSchema } from "@/lib/swr";
import { kpiDataSchema, KPIS_KEY, type KpiData } from "@/lib/schemas/kpis";

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: number;
  clientName?: string;
  serviceName?: string;
  clientId: string;
}

// El analytics-service solo guarda identificadores: el nombre del profesional
// se cruza aqui contra /core/professionals, igual que se hace con el cliente de
// cada cita.
const topProfessionalSchema = z.object({
  professionalId: z.string(),
  appointments: z.number(),
  revenue: z.number(),
});
type TopProfessional = z.infer<typeof topProfessionalSchema>;

const professionalRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const revenuePointSchema = z.object({
  date: z.string(),
  revenue: z.number(),
});
type RevenuePoint = z.infer<typeof revenuePointSchema>;

const clientRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});
type ClientRef = z.infer<typeof clientRefSchema>;

const rawAppointmentSchema = z.object({
  id: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  status: z.string(),
  totalAmount: z.union([z.string(), z.number()]).optional(),
  clientId: z.string(),
  appointmentServices: z
    .array(z.object({ serviceName: z.string().optional() }))
    .optional(),
});
type RawAppointment = z.infer<typeof rawAppointmentSchema>;

export default function DashboardPage() {
  const { businessId } = useAuthStore();

  const today = toLocalDateKey(new Date());
  const appointmentsKey = businessId
    ? `/booking/appointments?date=${today}`
    : null;
  // Las citas llegan paginadas y `paginatedSchema` es el unico sitio donde se
  // abre ese sobre. El catalogo de profesionales no pagina: lo acota el tamano
  // del equipo y responde con la lista a secas.
  const { data: paginaDeCitas, isLoading: loadingAppointments } = useApi(
    appointmentsKey,
    undefined,
    paginatedSchema(rawAppointmentSchema)
  );

  // Solo hacen falta los nombres de los clientes que salen hoy en pantalla, asi
  // que se piden por id en vez de traerse la cartera del negocio para cruzar
  // ocho filas. La ruta de nombres, ademas, la puede llamar un profesional.
  const idsDeHoy = useMemo(
    () => [...new Set((paginaDeCitas?.data ?? []).map((a) => a.clientId))],
    [paginaDeCitas]
  );
  const { data: nombresDeClientes, isLoading: loadingClients } = useApi(
    idsDeHoy.length ? `/core/clients/names?ids=${idsDeHoy.join(",")}` : null,
    undefined,
    z.array(clientRefSchema)
  );
  const { data: kpiData } = useApi<KpiData | null>(
    businessId ? KPIS_KEY : null,
    undefined,
    kpiDataSchema.nullable()
  );
  const { data: topProfessionals } = useApi<TopProfessional[]>(
    businessId ? "/analytics/dashboard/top-professionals?limit=5" : null,
    undefined,
    z.array(topProfessionalSchema)
  );
  const { data: profesionales } = useApi(
    businessId ? "/core/professionals" : null,
    undefined,
    z.array(professionalRefSchema)
  );
  const { data: revenueChart } = useApi<RevenuePoint[]>(
    businessId ? "/analytics/dashboard/revenue-chart?days=7" : null,
    undefined,
    z.array(revenuePointSchema)
  );

  const loading = !!businessId && (loadingAppointments || loadingClients);

  // Las citas llegan sin el nombre del cliente (viven en servicios distintos),
  // asi que se cruzan aqui contra los nombres pedidos por id.
  const appointments = useMemo<Appointment[]>(() => {
    const items: RawAppointment[] = paginaDeCitas?.data ?? [];
    const clientList: ClientRef[] = nombresDeClientes ?? [];
    const names: Record<string, string> = {};
    clientList.forEach((c) => {
      names[c.id] = c.name;
    });
    return items.map((a) => ({
      id: a.id,
      date: a.date,
      startTime: a.startTime,
      endTime: a.endTime,
      status: a.status,
      totalAmount: Number(a.totalAmount || 0),
      serviceName: a.appointmentServices?.[0]?.serviceName,
      clientName: names[a.clientId] || undefined,
      clientId: a.clientId,
    }));
  }, [paginaDeCitas, nombresDeClientes]);

  // Cada tarjeta prefiere el KPI de analytics-service y cae al calculo sobre las
  // citas de hoy si ese servicio aun no respondio, para no ensenar la tarjeta
  // vacia. "Pendientes" no tiene equivalente en el endpoint de KPIs, asi que
  // siempre se calcula aqui.
  const stats = useMemo(() => {
    const completadas = appointments.filter((a) => a.status === "COMPLETED");
    const pendientes = appointments.filter(
      (a) => a.status === "PENDING" || a.status === "CONFIRMED"
    );
    const ingresosLocales = completadas.reduce(
      (sum, a) => sum + Number(a.totalAmount || 0),
      0
    );

    return [
      {
        title: "Citas hoy",
        value: kpiData?.today?.totalAppointments ?? appointments.length,
        icon: Calendar,
        color: "text-info",
        bg: "bg-info-soft",
      },
      {
        title: "Completadas",
        value: kpiData?.today?.completedAppointments ?? completadas.length,
        icon: CheckCircle,
        color: "text-success",
        bg: "bg-success-soft",
      },
      {
        title: "Pendientes",
        value: pendientes.length,
        icon: Clock,
        color: "text-warning",
        bg: "bg-warning-soft",
      },
      {
        title: "Ingresos hoy",
        value: formatCurrency(kpiData?.today?.totalRevenue ?? ingresosLocales),
        icon: DollarSign,
        color: "text-primary",
        bg: "bg-primary/10",
      },
    ];
  }, [appointments, kpiData]);

  const upcoming = useMemo(
    () =>
      appointments
        .filter((a) => a.status === "PENDING" || a.status === "CONFIRMED")
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [appointments]
  );

  const nombresDeProfesional = useMemo(() => {
    const nombres: Record<string, string> = {};
    (profesionales ?? []).forEach((p) => {
      nombres[p.id] = p.name;
    });
    return nombres;
  }, [profesionales]);

  const maxRevenue = useMemo(
    () => Math.max(...(revenueChart ?? []).map((r) => r.revenue), 1),
    [revenueChart]
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Resumen de tu negocio</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">{stat.title}</p>
                  <p className="mt-1 text-2xl font-bold">
                    {loading ? "..." : stat.value}
                  </p>
                </div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}
                >
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {kpiData?.last30Days && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4" /> Ingresos 30 días
              </div>
              <p className="mt-1 text-xl font-bold">
                {formatCurrency(kpiData.last30Days.totalRevenue)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" /> Citas 30 días
              </div>
              <p className="mt-1 text-xl font-bold">
                {kpiData.last30Days.totalAppointments}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4" /> Tasa completado
              </div>
              <p className="mt-1 text-xl font-bold">
                {kpiData.last30Days.completionRate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" /> Clientes nuevos
              </div>
              <p className="mt-1 text-xl font-bold">
                {kpiData.last30Days.newClients}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            {/* "Pendientes" y no "de hoy" a secas: la tarjeta de arriba cuenta
                todas las citas del dia y este panel solo las que quedan por
                atender, asi que dos numeros distintos son correctos. */}
            <CardTitle className="text-lg">
              Citas pendientes de hoy ({upcoming.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="border-primary h-6 w-6 animate-spin rounded-full border-4 border-t-transparent" />
              </div>
            ) : upcoming.length === 0 ? (
              <div className="text-muted-foreground flex items-center justify-center py-8">
                <div className="text-center">
                  <Calendar className="mx-auto h-12 w-12 opacity-20" />
                  <p className="mt-2 text-sm">
                    No hay citas pendientes para hoy
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-h-80 space-y-3 overflow-y-auto">
                {upcoming.map((a) => {
                  const st = getAppointmentStatus(a.status);
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
                          <Scissors className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {a.clientName || "Cliente"}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {a.serviceName || "Servicio"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {formatTime(a.startTime)} - {formatTime(a.endTime)}
                        </p>
                        <Badge variant={st.variant} className="text-xs">
                          {st.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Ingresos últimos 7 días</CardTitle>
          </CardHeader>
          <CardContent>
            {(revenueChart ?? []).length > 0 ? (
              <div className="space-y-2">
                {(revenueChart ?? []).map((point) => {
                  const pct =
                    maxRevenue > 0 ? (point.revenue / maxRevenue) * 100 : 0;
                  return (
                    <div key={point.date} className="flex items-center gap-3">
                      <span className="text-muted-foreground w-12 text-xs">
                        {formatDayMonth(point.date)}
                      </span>
                      <div className="bg-muted h-6 flex-1 overflow-hidden rounded-full">
                        <div
                          className="bg-primary/70 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                      <span className="w-24 text-right text-xs font-medium">
                        {formatCurrency(point.revenue)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-muted-foreground flex items-center justify-center py-8">
                <div className="text-center">
                  <DollarSign className="mx-auto h-12 w-12 opacity-20" />
                  <p className="mt-2 text-sm">Sin datos de ingresos</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(topProfessionals ?? []).length > 0 && (
        <Card className="mt-6 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="h-5 w-5 text-amber-500" /> Top profesionales (30
              días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {(topProfessionals ?? []).map((p, i) => (
                <div
                  key={p.professionalId}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {nombresDeProfesional[p.professionalId] || "Profesional"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {p.appointments} citas · {formatCurrency(p.revenue)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
