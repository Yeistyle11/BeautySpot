"use client";
import { useEffect, useState } from "react";
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
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { getAppointmentStatus } from "@/lib/status";
import { useAuthStore } from "@/lib/store";
import { decodeJwt } from "@/lib/auth";
import { useApi } from "@/lib/swr";

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

const kpiDataSchema = z.object({
  today: z.object({
    totalAppointments: z.number(),
    completedAppointments: z.number(),
    cancelledAppointments: z.number(),
    totalRevenue: z.number(),
  }),
  last30Days: z.object({
    totalRevenue: z.number(),
    totalAppointments: z.number(),
    completionRate: z.number(),
    cancellationRate: z.number(),
    newClients: z.number(),
    returningClients: z.number(),
    avgDailyRevenue: z.number(),
  }),
});
type KpiData = z.infer<typeof kpiDataSchema>;

const topProfessionalSchema = z.object({
  professionalId: z.string(),
  professionalName: z.string(),
  appointments: z.number(),
  revenue: z.number(),
});
type TopProfessional = z.infer<typeof topProfessionalSchema>;

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

// La API devuelve, segun el endpoint, o el arreglo crudo o
// { items: [...] } -- se refleja tal cual con z.union, no se investiga ni
// se normaliza esa inconsistencia de contrato en esta fase.
const rawAppointmentListSchema = z.union([
  z.array(rawAppointmentSchema),
  z.object({ items: z.array(rawAppointmentSchema) }),
]);
const clientRefListSchema = z.union([
  z.array(clientRefSchema),
  z.object({ items: z.array(clientRefSchema) }),
]);

const STATUS_MAP = getAppointmentStatus;

export default function DashboardPage() {
  const { businessId, setBusinessId } = useAuthStore();
  const [resolvedBid, setResolvedBid] = useState<string | null>(businessId);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [, setClientNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) {
      const token = localStorage.getItem("auth:v1:token");
      const payload = token ? decodeJwt(token) : null;
      if (payload?.businessId) {
        setBusinessId(payload.businessId);
        setResolvedBid(payload.businessId);
      } else {
        setLoading(false);
      }
    } else {
      setResolvedBid(businessId);
    }
  }, [businessId, setBusinessId]);

  const today = new Date().toISOString().split("T")[0];
  const appointmentsKey = resolvedBid
    ? `/booking/appointments?date=${today}`
    : null;
  const clientsKey = resolvedBid ? `/core/clients?limit=100` : null;

  const { data: rawAppointments } = useApi<
    RawAppointment[] | { items: RawAppointment[] }
  >(appointmentsKey, undefined, rawAppointmentListSchema);
  const { data: rawClients } = useApi<ClientRef[] | { items: ClientRef[] }>(
    clientsKey,
    undefined,
    clientRefListSchema
  );
  const { data: kpiData } = useApi<KpiData | null>(
    resolvedBid ? "/analytics/dashboard/kpis" : null,
    undefined,
    kpiDataSchema.nullable()
  );
  const { data: topProfessionals } = useApi<TopProfessional[]>(
    resolvedBid ? "/analytics/dashboard/top-professionals?limit=5" : null,
    undefined,
    z.array(topProfessionalSchema)
  );
  const { data: revenueChart } = useApi<RevenuePoint[]>(
    resolvedBid ? "/analytics/dashboard/revenue-chart?days=7" : null,
    undefined,
    z.array(revenuePointSchema)
  );

  useEffect(() => {
    if (!resolvedBid) {
      setLoading(false);
      return;
    }
    const items: RawAppointment[] = Array.isArray(rawAppointments)
      ? rawAppointments
      : (rawAppointments?.items ?? []);
    const clientList: ClientRef[] = Array.isArray(rawClients)
      ? rawClients
      : (rawClients?.items ?? []);
    const names: Record<string, string> = {};
    clientList.forEach((c) => {
      names[c.id] = c.name;
    });
    setClientNames(names);
    setAppointments(
      items.map((a) => ({
        id: a.id,
        date: a.date,
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
        totalAmount: Number(a.totalAmount || 0),
        serviceName: a.appointmentServices?.[0]?.serviceName,
        clientName: names[a.clientId] || undefined,
        clientId: a.clientId,
      }))
    );
    if (rawAppointments !== undefined && rawClients !== undefined) {
      setLoading(false);
    }
  }, [resolvedBid, rawAppointments, rawClients]);

  void 0;

  // Fallback calculations from booking data
  const todayTotal = appointments.length;
  const todayCompleted = appointments.filter(
    (a) => a.status === "COMPLETED"
  ).length;
  const todayRevenue = appointments
    .filter((a) => a.status === "COMPLETED")
    .reduce((sum, a) => sum + Number(a.totalAmount || 0), 0);
  const pending = appointments.filter(
    (a) => a.status === "PENDING" || a.status === "CONFIRMED"
  ).length;

  const stats = [
    {
      title: "Citas hoy",
      value: kpiData?.today?.totalAppointments ?? todayTotal,
      icon: Calendar,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Completadas",
      value: kpiData?.today?.completedAppointments ?? todayCompleted,
      icon: CheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Pendientes",
      value: pending,
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      title: "Ingresos hoy",
      value: formatCurrency(kpiData?.today?.totalRevenue ?? todayRevenue),
      icon: DollarSign,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  const upcoming = appointments
    .filter((a) => a.status === "PENDING" || a.status === "CONFIRMED")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const maxRevenue = Math.max(...(revenueChart ?? []).map((r) => r.revenue), 1);

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

      {/* Analytics row */}
      {kpiData?.last30Days && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4" /> Ingresos 30 dias
              </div>
              <p className="mt-1 text-xl font-bold">
                {formatCurrency(kpiData.last30Days.totalRevenue)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" /> Citas 30 dias
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
        {/* Upcoming appointments */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">
              Citas de hoy ({upcoming.length})
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
                  const st = STATUS_MAP(a.status);
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
                        <Badge
                          variant="secondary"
                          className={`text-xs ${st.color}`}
                        >
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

        {/* Revenue mini chart */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Ingresos ultimos 7 dias</CardTitle>
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
                        {formatDate(point.date)
                          .replace(/^\d+\sde\s/, "")
                          .replace(/\sde\s\d+$/, "")}
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

      {/* Top professionals */}
      {(topProfessionals ?? []).length > 0 && (
        <Card className="mt-6 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Star className="h-5 w-5 text-amber-500" /> Top profesionales (30
              dias)
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
                    <p className="text-sm font-medium">{p.professionalName}</p>
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
