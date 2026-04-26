"use client";

import { useState, useRef, useEffect } from "react";
import { formatCurrency, formatDuration } from "@/lib/utils";

type Service = {
  name: string;
  price: number;
  duration: number;
};

type Barber = {
  id: number;
  user: {
    name: string;
    image: string | null;
  };
};

type Appointment = {
  id: number;
  date: Date;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  barber: {
    id: number;
    user: {
      name: string;
    };
  };
  client: {
    name: string;
    email: string;
    phone: string | null;
  };
  services: Service[];
  totalPrice: number;
  totalDuration: number;
};

type AdminCalendarProps = {
  appointments: Appointment[];
  barbers: Barber[];
};

export default function AdminCalendar({
  appointments: initialAppointments,
  barbers,
}: AdminCalendarProps) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [selectedBarberId, setSelectedBarberId] = useState<string>("all");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  // Filtrar citas por barbero
  const filteredAppointments =
    selectedBarberId === "all"
      ? appointments
      : appointments.filter(
          (apt) => String(apt.barber.id) === selectedBarberId
        );

  // Actualizar appointments cuando cambien las props
  useEffect(() => {
    setAppointments(initialAppointments);
  }, [initialAppointments]);

  // Scroll automático cuando se selecciona un día
  useEffect(() => {
    if (selectedDate && detailsRef.current) {
      detailsRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [selectedDate]);

  // Obtener el primer día del mes
  const firstDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  );
  const lastDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  );

  // Obtener el día de la semana del primer día (0 = domingo, 1 = lunes, etc.)
  const firstDayWeekday = firstDayOfMonth.getDay();

  // Días del mes
  const daysInMonth = lastDayOfMonth.getDate();

  // Días del mes anterior que se muestran
  const prevMonthDays = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;
  const lastDayPrevMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    0
  ).getDate();

  // Generar días del calendario
  const calendarDays: Array<{ date: Date; isCurrentMonth: boolean }> = [];

  // Días del mes anterior
  for (let i = prevMonthDays; i > 0; i--) {
    calendarDays.push({
      date: new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        lastDayPrevMonth - i + 1
      ),
      isCurrentMonth: false,
    });
  }

  // Días del mes actual
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push({
      date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i),
      isCurrentMonth: true,
    });
  }

  // Días del mes siguiente para completar la grilla
  const remainingDays = 42 - calendarDays.length;
  for (let i = 1; i <= remainingDays; i++) {
    calendarDays.push({
      date: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i),
      isCurrentMonth: false,
    });
  }

  // Obtener citas de un día específico
  const getAppointmentsForDay = (date: Date) => {
    return filteredAppointments.filter((apt) => {
      const aptDate = new Date(apt.date);
      return (
        aptDate.getDate() === date.getDate() &&
        aptDate.getMonth() === date.getMonth() &&
        aptDate.getFullYear() === date.getFullYear()
      );
    });
  };

  // Navegar entre meses
  const prevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    );
  };

  const nextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
    );
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDayAppointments = selectedDate
    ? getAppointmentsForDay(selectedDate)
    : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800";
      case "CONFIRMED":
        return "bg-blue-100 text-blue-800";
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      case "NO_SHOW":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "PENDING":
        return "Pendiente";
      case "CONFIRMED":
        return "Confirmada";
      case "COMPLETED":
        return "Completada";
      case "CANCELLED":
        return "Cancelada";
      case "NO_SHOW":
        return "No asistió";
      default:
        return status;
    }
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow-lg md:p-6">
      {/* Filtro de barbero y navegación */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="text-sm font-medium text-gray-700">
            Filtrar por barbero:
          </label>
          <select
            value={selectedBarberId}
            onChange={(e) => setSelectedBarberId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:w-auto"
          >
            <option value="all">Todos los barberos</option>
            {barbers.map((barber) => (
              <option key={barber.id} value={String(barber.id)}>
                {barber.user.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-gray-900 md:text-2xl">
            {currentDate
              .toLocaleDateString("es-ES", { month: "long", year: "numeric" })
              .charAt(0)
              .toUpperCase() +
              currentDate
                .toLocaleDateString("es-ES", { month: "long", year: "numeric" })
                .slice(1)}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={prevMonth}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100"
              title="Mes anterior"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={nextMonth}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100"
              title="Mes siguiente"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {/* Encabezados de días */}
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
          <div
            key={day}
            className="py-2 text-center font-semibold text-gray-600"
          >
            {day}
          </div>
        ))}

        {/* Días del calendario */}
        {calendarDays.map((day, index) => {
          const dayAppointments = getAppointmentsForDay(day.date);
          const isToday =
            day.date.getDate() === today.getDate() &&
            day.date.getMonth() === today.getMonth() &&
            day.date.getFullYear() === today.getFullYear();
          const isSelected =
            selectedDate &&
            day.date.getDate() === selectedDate.getDate() &&
            day.date.getMonth() === selectedDate.getMonth() &&
            day.date.getFullYear() === selectedDate.getFullYear();

          return (
            <button
              key={index}
              onClick={() => setSelectedDate(day.date)}
              className={`relative min-h-[100px] rounded-lg border p-2 transition-all ${!day.isCurrentMonth ? "bg-gray-50 text-gray-400" : "bg-white text-gray-900"} ${isToday ? "border-2 border-blue-500" : "border-gray-200"} ${isSelected ? "bg-indigo-50 ring-2 ring-indigo-500" : ""} cursor-pointer hover:bg-gray-50 hover:shadow-sm active:scale-95`}
            >
              <div className="mb-1 flex items-start justify-between">
                <span className="text-sm font-semibold">
                  {day.date.getDate()}
                </span>
                {dayAppointments.length > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                    {dayAppointments.length}
                  </span>
                )}
              </div>
              {dayAppointments.length > 0 && (
                <div className="space-y-1 text-left">
                  {dayAppointments.slice(0, 3).map((apt, idx) => (
                    <div
                      key={idx}
                      className={`truncate rounded px-1 py-0.5 text-xs ${getStatusColor(apt.status)}`}
                      title={`${apt.startTime} - ${apt.barber.user.name}`}
                    >
                      {apt.startTime}
                    </div>
                  ))}
                  {dayAppointments.length > 3 && (
                    <div className="text-xs font-semibold text-indigo-600">
                      +{dayAppointments.length - 3}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Detalles del día seleccionado */}
      {selectedDate && (
        <div ref={detailsRef} className="mt-6 border-t pt-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Citas del{" "}
              {selectedDate.toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h3>
            <button
              onClick={() => setSelectedDate(null)}
              className="text-gray-500 transition-colors hover:text-gray-700"
              title="Cerrar"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {selectedDayAppointments.length === 0 ? (
            <p className="py-8 text-center text-gray-500">
              No hay citas para este día
            </p>
          ) : (
            <div className="space-y-4">
              {selectedDayAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="rounded-lg border p-4 transition-shadow hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {apt.client.name}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {apt.client.email}
                      </p>
                      {apt.client.phone && (
                        <p className="text-sm text-gray-600">
                          {apt.client.phone}
                        </p>
                      )}
                      <p className="mt-1 text-sm font-medium text-indigo-600">
                        Barbero: {apt.barber.user.name}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(apt.status)}`}
                    >
                      {getStatusText(apt.status)}
                    </span>
                  </div>

                  <div className="mb-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-gray-600">Horario</p>
                      <p className="font-semibold text-gray-900">
                        {apt.startTime} - {apt.endTime}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Duración</p>
                      <p className="font-semibold text-gray-900">
                        {formatDuration(apt.totalDuration)}
                      </p>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="mb-1 text-sm text-gray-600">Servicios</p>
                    <div className="space-y-1">
                      {apt.services.map((service, idx) => (
                        <p key={idx} className="text-sm text-gray-900">
                          • {service.name} - {formatCurrency(service.price)}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm text-gray-600">Total</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(apt.totalPrice)}
                    </span>
                  </div>

                  {apt.notes && (
                    <div className="mt-3 rounded bg-gray-50 p-2 text-sm">
                      <p className="text-gray-600">Notas:</p>
                      <p className="text-gray-900">{apt.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
