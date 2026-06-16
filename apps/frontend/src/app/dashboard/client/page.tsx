"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, CheckCircle, XCircle, Award, Scissors, Clock,
  ArrowRight, Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { useAuthStore } from "@/lib/store";
import Link from "next/link";

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  totalAmount: string;
  professionalId: string;
  clientId: string;
  appointmentServices: { serviceName: string; price: string; duration: number }[];
}

interface ClientData {
  id: string;
  name: string;
  loyaltyPoints: number;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800" },
  CONFIRMED: { label: "Confirmada", color: "bg-blue-100 text-blue-800" },
  COMPLETED: { label: "Completada", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelada", color: "bg-red-100 text-red-800" },
  NO_SHOW: { label: "No asistio", color: "bg-gray-100 text-gray-800" },
};

export default function ClientDashboardPage() {
  const { user } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Appointment[]>("/booking/appointments")
      .then(setAppointments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const upcoming = appointments
    .filter((a) => a.status === "PENDING" || a.status === "CONFIRMED")
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));

  const completed = appointments.filter((a) => a.status === "COMPLETED").length;
  const cancelled = appointments.filter((a) => a.status === "CANCELLED").length;

  const stats = [
    { title: "Proximas citas", value: upcoming.length, icon: Calendar, color: "text-blue-600", bg: "bg-blue-50" },
    { title: "Completadas", value: completed, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
    { title: "Canceladas", value: cancelled, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
    { title: "Total citas", value: appointments.length, icon: Scissors, color: "text-purple-600", bg: "bg-purple-50" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Hola, {user?.name?.split(" ")[0] || "Cliente"}</h1>
        <p className="text-muted-foreground">Bienvenido a tu panel de citas</p>
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

      <div className="mt-6 rounded-xl bg-gradient-to-r from-primary to-purple-700 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2"><Sparkles className="h-5 w-5" /> Listo para tu proxima cita?</h3>
            <p className="mt-1 text-sm text-white/80">Encuentra el mejor lugar y reserva en segundos</p>
          </div>
          <Link href="/marketplace">
            <Button variant="secondary" className="gap-2">Reservar ahora <ArrowRight className="h-4 w-4" /></Button>
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Proximas citas</h2>
          <Link href="/dashboard/client/appointments">
            <Button variant="ghost" size="sm" className="gap-1">Ver todas <ArrowRight className="h-3 w-3" /></Button>
          </Link>
        </div>

        {loading ? (
          <Card className="border-0 shadow-sm"><CardContent className="p-8 text-center text-muted-foreground">Cargando...</CardContent></Card>
        ) : upcoming.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 text-center">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground opacity-20" />
              <p className="mt-2 text-muted-foreground">No tienes citas proximas</p>
              <Link href="/marketplace"><Button variant="outline" className="mt-4">Explstrar negocios</Button></Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.slice(0, 5).map((appt) => {
              const status = statusConfig[appt.status] || { label: appt.status, color: "bg-gray-100 text-gray-800" };
              return (
                <Link key={appt.id} href={`/dashboard/client/appointments/${appt.id}`}>
                  <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                            <Scissors className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">{appt.appointmentServices.map((s) => s.serviceName).join(", ")}</p>
                            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(appt.date)}</span>
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(appt.startTime)} - {formatTime(appt.endTime)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{formatCurrency(parseFloat(appt.totalAmount))}</span>
                          <Badge className={status.color}>{status.label}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
