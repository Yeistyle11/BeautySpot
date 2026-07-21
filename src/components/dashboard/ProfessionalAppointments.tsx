"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { getStatusColor, getStatusText } from "@/lib/appointment-status";

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

type ProfessionalAppointmentsProps = {
  professionalId: number;
  initialTodayAppointments: Appointment[];
  initialUpcomingAppointments: Appointment[];
};

export default function ProfessionalAppointments({
  professionalId: _professionalId,
  initialTodayAppointments,
  initialUpcomingAppointments,
}: ProfessionalAppointmentsProps) {
  // El refresh de los datos viene desde el server component padre vía
  // AutoRefresh (router.refresh()). Antes este componente tenía su propio
  // timer de 30s + fetch a /api/appointments que duplicaba el refresh
  // (triple polling junto con ProfessionalCalendar).
  // Los state locales solo reflejan las props (no hay estado derivado en
  // useEffect que sincronice).
  const todayAppointments = initialTodayAppointments;
  const upcomingAppointments = initialUpcomingAppointments;
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const router = useRouter();

  const refreshPage = () => router.refresh();

  const handleAction = async (
    appointmentId: number,
    action: "complete" | "no-show" | "confirm"
  ) => {
    try {
      setLoadingId(appointmentId);
      const res = await fetch(`/api/appointments/${appointmentId}/${action}`, {
        method: "POST",
      });

      if (res.ok) {
        refreshPage();
      }
    } catch (error) {
      console.error(`Error al ${action} cita:`, error);
    } finally {
      setLoadingId(null);
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
            {loadingId !== null && (
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
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(apt.status)}`}
                      >
                        {getStatusText(apt.status)}
                      </span>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-4 text-sm">
                      <div className="col-span-2">
                        <p className="mb-1 text-gray-600">
                          {apt.services.length === 1 ? "Servicio" : "Servicios"}
                        </p>
                        {apt.services.map((service, idx) => (
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
                            onClick={() => handleAction(apt.id, "confirm")}
                            disabled={loadingId === apt.id}
                            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            ✓ Confirmar
                          </button>
                        )}
                        <button
                          onClick={() => handleAction(apt.id, "complete")}
                          disabled={loadingId === apt.id}
                          className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          ✓ Completar
                        </button>
                        <button
                          onClick={() => handleAction(apt.id, "no-show")}
                          disabled={loadingId === apt.id}
                          className="flex-1 rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
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
