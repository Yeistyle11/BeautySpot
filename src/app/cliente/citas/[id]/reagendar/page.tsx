"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { BarberImage } from "@/components/shared/BarberImage";

type Service = {
  id: number;
  name: string;
  price: number;
  duration: number;
};

type AppointmentService = {
  service: Service;
};

type Barber = {
  id: number;
  user: {
    name: string;
    image: string | null;
  };
  rating: number;
};

type Appointment = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  services: AppointmentService[];
  barber: Barber;
  status: string;
};

type TimeSlot = {
  time: string;
  available: boolean;
};

export default function RescheduleAppointmentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const appointmentId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);

  // Estado del calendario
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);

  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  // Generar días del calendario
  useEffect(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const current = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    setCalendarDays(days);
  }, [currentMonth]);

  // Cargar datos de la cita
  useEffect(() => {
    if (appointmentId) {
      fetchAppointment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  // Cargar horarios disponibles cuando se selecciona una fecha
  useEffect(() => {
    if (selectedDate && appointment) {
      fetchAvailableSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const fetchAppointment = async () => {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`);
      if (!res.ok) throw new Error("Error al cargar la cita");
      const data = await res.json();
      setAppointment(data);
    } catch (err) {
      setError("Error al cargar los datos de la cita");
      console.error(err);
    }
  };

  const fetchAvailableSlots = async () => {
    if (!appointment) return;

    try {
      setLoading(true);
      const totalDuration = appointment.services.reduce((sum, as) => sum + as.service.duration, 0);
      const res = await fetch(
        `/api/appointments/availability?barberId=${appointment.barber.id}&date=${selectedDate}&duration=${totalDuration}`
      );
      const data = await res.json();
      setAvailableSlots(data.slots || []);
    } catch (err) {
      console.error("Error al cargar horarios:", err);
      setAvailableSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) {
      setError("Por favor selecciona fecha y hora");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await fetch(`/api/appointments/${appointmentId}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          startTime: selectedTime,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al reagendar la cita");
      }

      router.push("/cliente/citas?success=rescheduled");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (day: Date) => {
    if (isDateDisabled(day)) return;
    const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
    setSelectedDate(dateStr);
    setSelectedTime("");
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today || !isCurrentMonth(date);
  };

  const isDateSelected = (date: Date) => {
    if (!selectedDate) return false;
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return dateStr === selectedDate;
  };

  const isCurrentMonth = (date: Date) => {
    return (
      date.getMonth() === currentMonth.getMonth() &&
      date.getFullYear() === currentMonth.getFullYear()
    );
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
    );
  };

  const goToNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    );
  };

  if (status === "loading" || !appointment) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
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
            Volver
          </button>
        </div>

        <div className="rounded-lg bg-white p-8 shadow-lg">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Reagendar Cita
          </h1>
          <p className="mb-8 text-gray-600">
            Selecciona una nueva fecha y hora para tu cita
          </p>

          {/* Información de la cita actual */}
          <div className="mb-8 rounded-lg border border-indigo-200 bg-indigo-50 p-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Cita Actual
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-gray-600">Servicios</p>
                {appointment.services.map((as, idx) => (
                  <div key={idx} className="mb-2">
                    <p className="font-semibold text-gray-900">
                      {as.service.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatCurrency(as.service.price)} • {as.service.duration} min
                    </p>
                  </div>
                ))}
                <p className="mt-2 text-sm font-medium text-indigo-700">
                  Total: {formatCurrency(appointment.services.reduce((sum, as) => sum + as.service.price, 0))} • {appointment.services.reduce((sum, as) => sum + as.service.duration, 0)} min
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Barbero</p>
                <div className="mt-1 flex items-center gap-3">
                  <BarberImage
                    image={appointment.barber.user.image}
                    name={appointment.barber.user.name}
                    size={40}
                  />
                  <span className="font-semibold text-gray-900">
                    {appointment.barber.user.name}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Fecha actual</p>
                <p className="font-semibold text-gray-900">
                  {new Date(appointment.date + "T00:00:00").toLocaleDateString(
                    "es-ES",
                    {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Hora actual</p>
                <p className="font-semibold text-gray-900">
                  {appointment.startTime}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              {error}
            </div>
          )}

          {/* Selección de nueva fecha */}
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              Selecciona nueva fecha
            </h2>

            <div className="rounded-lg border border-gray-200 bg-white p-6">
              {/* Header del calendario */}
              <div className="mb-6 flex items-center justify-between">
                <button
                  onClick={goToPreviousMonth}
                  className="rounded-lg p-2 transition-colors hover:bg-gray-100"
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
                <h3 className="text-lg font-semibold text-gray-900">
                  {monthNames[currentMonth.getMonth()]}{" "}
                  {currentMonth.getFullYear()}
                </h3>
                <button
                  onClick={goToNextMonth}
                  className="rounded-lg p-2 transition-colors hover:bg-gray-100"
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

              {/* Días de la semana */}
              <div className="mb-2 grid grid-cols-7 gap-2">
                {dayNames.map((day) => (
                  <div
                    key={day}
                    className="py-2 text-center text-sm font-semibold text-gray-600"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Días del calendario */}
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => {
                  const disabled = isDateDisabled(day);
                  const selected = isDateSelected(day);
                  const today = isToday(day);
                  const currentMonthDay = isCurrentMonth(day);

                  return (
                    <button
                      key={index}
                      onClick={() => handleDateSelect(day)}
                      disabled={disabled}
                      className={`aspect-square rounded-lg p-2 text-sm font-medium transition-all ${disabled ? "cursor-not-allowed text-gray-300" : "hover:scale-105 hover:bg-indigo-50"} ${selected ? "scale-105 bg-indigo-600 text-white shadow-lg" : ""} ${today && !selected ? "bg-indigo-100 font-bold text-indigo-900" : ""} ${!currentMonthDay && !selected ? "text-gray-400" : ""} ${currentMonthDay && !selected && !today && !disabled ? "text-gray-900" : ""} `}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Selección de horario */}
          {selectedDate && (
            <div className="mb-8">
              <h2 className="mb-4 text-xl font-bold text-gray-900">
                Selecciona nuevo horario
              </h2>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-6">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={`rounded-lg border-2 p-3 text-sm font-medium transition-all ${
                        selectedTime === slot.time
                          ? "scale-105 border-indigo-600 bg-indigo-600 text-white shadow-md"
                          : slot.available
                            ? "border-gray-200 bg-white text-gray-900 hover:scale-105 hover:border-indigo-300"
                            : "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-400"
                      }`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex justify-between gap-4">
            <button
              onClick={() => router.back()}
              className="rounded-lg border border-gray-300 px-6 py-3 text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedDate || !selectedTime || loading}
              className="rounded-lg bg-indigo-600 px-8 py-3 font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Reagendando..." : "Confirmar Reagendamiento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
