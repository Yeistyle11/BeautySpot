"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatDuration } from "@/lib/utils";

type Service = {
  name: string;
  price: number;
  duration: number;
};

type Appointment = {
  id: number;
  ids?: number[];
  key?: number;
  date: Date;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  client: {
    name: string;
    email: string;
    phone: string | null;
  };
  service?: Service;
  services: Service[];
  totalPrice: number;
  totalDuration: number;
};

type BarberAppointmentsProps = {
  barberId: number;
  initialTodayAppointments: Appointment[];
  initialUpcomingAppointments: Appointment[];
};

export default function BarberAppointments({
  barberId: _barberId,
  initialTodayAppointments,
  initialUpcomingAppointments,
}: BarberAppointmentsProps) {
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>(
    initialTodayAppointments
  );
  const [upcomingAppointments, setUpcomingAppointments] = useState<
    Appointment[]
  >(initialUpcomingAppointments);
  const [loading, setLoading] = useState(false);

  const groupAppointments = (appointments: any[]) => {
    return appointments.map((apt) => {
      const services = apt.services.map((as: any) => as.service);
      const totalPrice = services.reduce(
        (sum: number, s: any) => sum + s.price,
        0
      );
      const totalDuration = services.reduce(
        (sum: number, s: any) => sum + s.duration,
        0
      );

      return {
        key: apt.id,
        id: apt.id,
        ids: [apt.id],
        date: apt.date,
        startTime: apt.startTime,
        endTime: apt.endTime,
        status: apt.status,
        notes: apt.notes,
        client: apt.client,
        services,
        totalPrice,
        totalDuration,
      };
    });
  };

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/appointments", {
        cache: "no-store",
      });

      if (!res.ok) return;

      const allAppointments: Appointment[] = await res.json();

      // Filtrar citas de hoy
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayAppts = allAppointments.filter((apt) => {
        const aptDate = new Date(apt.date);
        return aptDate >= today && aptDate < tomorrow;
      });

      // Filtrar próximas citas (siguientes 7 días)
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const upcomingAppts = allAppointments.filter((apt) => {
        const aptDate = new Date(apt.date);
        return (
          aptDate >= tomorrow &&
          aptDate < nextWeek &&
          (apt.status === "PENDING" || apt.status === "CONFIRMED")
        );
      });

      // Agrupar citas por fecha, hora y cliente
      setTodayAppointments(groupAppointments(todayAppts));
      setUpcomingAppointments(groupAppointments(upcomingAppts));
    } catch (error) {
      console.error("Error al obtener citas:", error);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAppointments();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Actualizar cuando cambien las props iniciales
  useEffect(() => {
    setTodayAppointments(initialTodayAppointments);
    setUpcomingAppointments(initialUpcomingAppointments);
  }, [initialTodayAppointments, initialUpcomingAppointments]);

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: "bg-yellow-100 text-yellow-800",
      CONFIRMED: "bg-blue-100 text-blue-800",
      COMPLETED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
      NO_SHOW: "bg-gray-100 text-gray-800",
    };
    const labels = {
      PENDING: "Pendiente",
      CONFIRMED: "Confirmada",
      COMPLETED: "Completada",
      CANCELLED: "Cancelada",
      NO_SHOW: "No se presentó",
    };
    return (
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status as keyof typeof styles]}`}
      >
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const handleComplete = async (appointmentId: number) => {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/complete`, {
        method: "POST",
      });

      if (res.ok) {
        await fetchAppointments();
      }
    } catch (error) {
      console.error("Error al completar cita:", error);
    }
  };

  const handleNoShow = async (appointmentId: number) => {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/no-show`, {
        method: "POST",
      });

      if (res.ok) {
        await fetchAppointments();
      }
    } catch (error) {
      console.error("Error al marcar no-show:", error);
    }
  };

  const handleConfirm = async (appointmentId: number) => {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/confirm`, {
        method: "POST",
      });

      if (res.ok) {
        await fetchAppointments();
      }
    } catch (error) {
      console.error("Error al confirmar cita:", error);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* Citas de Hoy */}
      <div className="lg:col-span-2">
        <div className="rounded-lg bg-white shadow">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Citas de Hoy
            </h3>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Actualizando...
              </div>
            )}
          </div>
          <div className="p-6">
            {todayAppointments.length > 0 ? (
              <div className="space-y-4">
                {todayAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                          <span className="text-lg font-bold text-indigo-600">
                            {apt.client.name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {apt.client.name}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {apt.client.phone}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(apt.status)}
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-4 text-sm">
                      <div className="col-span-2">
                        <p className="mb-1 text-gray-600">
                          {apt.services.length === 1 ? "Servicio" : "Servicios"}
                        </p>
                        {apt.services.map((service: any, idx: number) => (
                          <p key={idx} className="font-semibold text-gray-900">
                            • {service.name} ({formatDuration(service.duration)}
                            )
                          </p>
                        ))}
                      </div>
                      <div>
                        <p className="text-gray-600">Horario</p>
                        <p className="font-semibold text-gray-900">
                          {apt.startTime} - {apt.endTime}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Duración Total</p>
                        <p className="font-semibold text-gray-900">
                          {formatDuration(apt.totalDuration)}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-gray-600">Precio Total</p>
                        <p className="text-lg font-semibold text-green-600">
                          {formatCurrency(apt.totalPrice)}
                        </p>
                      </div>
                    </div>

                    {apt.notes && (
                      <div className="mb-3 rounded bg-gray-50 p-2 text-sm">
                        <p className="text-gray-600">Notas:</p>
                        <p className="text-gray-900">{apt.notes}</p>
                      </div>
                    )}

                    {(apt.status === "PENDING" ||
                      apt.status === "CONFIRMED") && (
                      <div className="flex gap-2 border-t border-gray-200 pt-3">
                        {apt.status === "PENDING" && (
                          <button
                            onClick={() => handleConfirm(apt.id)}
                            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            ✓ Confirmar
                          </button>
                        )}
                        <button
                          onClick={() => handleComplete(apt.id)}
                          className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                        >
                          ✓ Completar
                        </button>
                        <button
                          onClick={() => handleNoShow(apt.id)}
                          className="flex-1 rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
                        >
                          ✗ No Show
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="mt-4 text-gray-600">No tienes citas para hoy</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Próximas Citas (Sidebar) */}
      <div>
        <div className="rounded-lg bg-white shadow">
          <div className="border-b border-gray-200 px-6 py-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Próximas Citas
            </h3>
          </div>
          <div className="p-6">
            {upcomingAppointments.length > 0 ? (
              <div className="space-y-3">
                {upcomingAppointments.slice(0, 5).map((apt) => (
                  <div
                    key={apt.id}
                    className="rounded-lg border border-gray-200 p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
                        <span className="text-sm font-bold text-indigo-600">
                          {apt.client.name.charAt(0)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">
                          {apt.client.name}
                        </p>
                        <p className="text-xs text-gray-600">
                          {apt.services.length === 1
                            ? apt.services[0].name
                            : `${apt.services.length} servicios`}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      <p>
                        {new Date(apt.date).toLocaleDateString("es-ES", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="font-semibold text-gray-900">
                        {apt.startTime}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-gray-600">
                No hay próximas citas
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
