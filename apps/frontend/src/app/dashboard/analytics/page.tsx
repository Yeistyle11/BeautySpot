"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/analytics/dashboard/kpis").then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold">Reportes</h1><p className="text-muted-foreground">Analisis de tu negocio</p></div>
      {loading ? <p className="text-muted-foreground">Cargando...</p> : data ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5" />Ultimos 30 dias</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Total citas</span><span className="font-semibold">{data.last30Days.totalAppointments}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Completadas</span><span className="font-semibold text-emerald-600">{data.last30Days.completedAppointments}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Canceladas</span><span className="font-semibold text-red-600">{data.last30Days.cancelledAppointments}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">No asistieron</span><span className="font-semibold text-amber-600">{data.last30Days.noShowAppointments}</span></div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5" />Ingresos</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Total 30 dias</span><span className="font-semibold">{formatCurrency(data.last30Days.totalRevenue)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Promedio diario</span><span className="font-semibold">{formatCurrency(data.last30Days.avgDailyRevenue)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tasa completado</span><span className="font-semibold">{Math.round(data.last30Days.completionRate * 100)}%</span></div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Users className="h-5 w-5" />Clientes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between"><span className="text-muted-foreground">Nuevos</span><span className="font-semibold">{data.last30Days.newClients}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Recurrentes</span><span className="font-semibold">{data.last30Days.returningClients}</span></div>
            </CardContent>
          </Card>
        </div>
      ) : <p className="text-muted-foreground">No hay datos disponibles</p>}
    </div>
  );
}
