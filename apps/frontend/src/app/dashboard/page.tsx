"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, DollarSign, Clock, Star, Scissors, CheckCircle, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";

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

interface KpiData {
  today: {
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    totalRevenue: number;
  };
  last30Days: {
    totalRevenue: number;
    totalAppointments: number;
    completionRate: number;
    cancellationRate: number;
    newClients: number;
    returningClients: number;
    avgDailyRevenue: number;
  };
}

interface TopProfessional {
  professionalId: string;
  professionalName: string;
  appointments: number;
  revenue: number;
}

interface RevenuePoint {
  date: string;
  revenue: number;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800" },
  CONFIRMED: { label: "Confirmada", color: "bg-blue-100 text-blue-800" },
  IN_PROGRESS: { label: "En proceso", color: "bg-purple-100 text-purple-800" },
  COMPLETED: { label: "Completada", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelada", color: "bg-red-100 text-red-800" },
  NO_SHOW: { label: "No asistio", color: "bg-gray-100 text-gray-800" },
};

export default function DashboardPage() {
  const { businessId, setBusinessId } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [, setClientNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  const [topProfessionals, setTopProfessionals] = useState<TopProfessional[]>([]);
  const [revenueChart, setRevenueChart] = useState<RevenuePoint[]>([]);

  useEffect(() => {
    let bid = businessId;
    if (!bid) {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          bid = payload.businessId;
          if (bid) setBusinessId(bid);
        } catch { /* ignore */ }
      }
    }
    if (bid) {
      const today = new Date().toISOString().split("T")[0];
      Promise.all([
        api.get<Appointment[]>(`/booking/appointments?date=${today}`).catch(() => []),
        api.get<any[]>(`/core/clients?limit=100`).catch(() => []),
      ])
        .then(([res, clients]) => {
          const items = Array.isArray(res) ? res : (res as any).items || [];
          const names: Record<string, string> = {};
          if (Array.isArray(clients)) {
            clients.forEach((c: any) => { names[c.id] = c.name; });
          }
          setClientNames(names);
          setAppointments(
            items.map((a: any) => ({
              ...a,
              totalAmount: Number(a.totalAmount || 0),
              serviceName: a.appointmentServices?.[0]?.serviceName,
              clientName: names[a.clientId] || null,
            }))
          );
        })
        .catch(console.error)
        .finally(() => setLoading(false));

      // Analytics data
      api.get<KpiData>("/analytics/dashboard/kpis").then(setKpiData).catch(() => {});
      api.get<TopProfessional[]>("/analytics/dashboard/top-professionals?limit=5").then(setTopProfessionals).catch(() => {});
      api.get<RevenuePoint[]>("/analytics/dashboard/revenue-chart?days=7").then(setRevenueChart).catch(() => {});
    } else {
      setLoading(false);
    }
  }, [businessId, setBusinessId]);

  // Fallback calculations from booking data
  const todayTotal = appointments.length;
  const todayCompleted = appointments.filter((a) => a.status === "COMPLETED").length;
  const todayRevenue = appointments.filter((a) => a.status === "COMPLETED").reduce((sum, a) => sum + Number(a.totalAmount || 0), 0);
  const pending = appointments.filter((a) => a.status === "PENDING" || a.status === "CONFIRMED").length;

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

  const maxRevenue = Math.max(...revenueChart.map((r) => r.revenue), 1);

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
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="mt-1 text-2xl font-bold">{loading ? "..." : stat.value}</p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}>
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
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" /> Ingresos 30 dias
              </div>
              <p className="mt-1 text-xl font-bold">{formatCurrency(kpiData.last30Days.totalRevenue)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" /> Citas 30 dias
              </div>
              <p className="mt-1 text-xl font-bold">{kpiData.last30Days.totalAppointments}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4" /> Tasa completado
              </div>
              <p className="mt-1 text-xl font-bold">{kpiData.last30Days.completionRate.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" /> Clientes nuevos
              </div>
              <p className="mt-1 text-xl font-bold">{kpiData.last30Days.newClients}</p>
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
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : upcoming.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <div className="text-center">
                  <Calendar className="mx-auto h-12 w-12 opacity-20" />
                  <p className="mt-2 text-sm">No hay citas pendientes para hoy</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {upcoming.map((a) => {
                  const st = STATUS_MAP[a.status] || { label: a.status, color: "bg-gray-100 text-gray-800" };
                  return (
                    <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Scissors className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{a.clientName || "Cliente"}</p>
                          <p className="text-xs text-muted-foreground">{a.serviceName || "Servicio"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{formatTime(a.startTime)} - {formatTime(a.endTime)}</p>
                        <Badge variant="secondary" className={`text-xs ${st.color}`}>{st.label}</Badge>
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
            {revenueChart.length > 0 ? (
              <div className="space-y-2">
                {revenueChart.map((point) => {
                  const pct = maxRevenue > 0 ? (point.revenue / maxRevenue) * 100 : 0;
                  return (
                    <div key={point.date} className="flex items-center gap-3">
                      <span className="w-12 text-xs text-muted-foreground">{formatDate(point.date).replace(/^\d+\sde\s/, "").replace(/\sde\s\d+$/, "")}</span>
                      <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary/70 rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%` }} />
                      </div>
                      <span className="text-xs font-medium w-24 text-right">{formatCurrency(point.revenue)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
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
      {topProfessionals.length > 0 && (
        <Card className="mt-6 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" /> Top profesionales (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {topProfessionals.map((p, i) => (
                <div key={p.professionalId} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{p.professionalName}</p>
                    <p className="text-xs text-muted-foreground">{p.appointments} citas · {formatCurrency(p.revenue)}</p>
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
