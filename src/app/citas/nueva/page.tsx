"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDuration } from "@/lib/utils";
import { BarberImage } from "@/components/shared/BarberImage";

type Service = {
  id: number;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
};

type Barber = {
  id: number;
  user: {
    name: string;
    image: string | null;
  };
  rating: number;
  yearsExp: number;
  specialties: string[];
};

type TimeSlot = {
  time: string;
  available: boolean;
};

export default function NewAppointmentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // State del formulario
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  // Datos
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);

  // Estado del calendario
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);

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

  // Cargar servicios
  useEffect(() => {
    fetchServices();
  }, []);

  // Cargar barberos cuando se seleccionan servicios
  useEffect(() => {
    if (selectedServices.length > 0) {
      // Obtener barberos que ofrezcan todos los servicios seleccionados
      fetchBarbersForServices(selectedServices.map((s) => s.id));
    }
  }, [selectedServices]);

  // Cargar horarios disponibles cuando se seleccionan barbero y fecha
  useEffect(() => {
    if (selectedBarber && selectedDate && selectedServices.length > 0) {
      fetchAvailableSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBarber, selectedDate]);

  const fetchServices = async () => {
    try {
      const res = await fetch("/api/services?active=true");
      const data = await res.json();
      setServices(data);
    } catch (err) {
      console.error("Error al cargar servicios:", err);
    }
  };

  const fetchBarbersForServices = async (serviceIds: number[]) => {
    try {
      // Obtener barberos para cada servicio
      const promises = serviceIds.map((id) =>
        fetch(`/api/barber-services?serviceId=${id}`).then((r) => r.json())
      );
      const results = await Promise.all(promises);

      // Encontrar barberos que ofrezcan TODOS los servicios
      const barberCounts = new Map<number, { barber: Barber; count: number }>();

      results.forEach((data) => {
        data.forEach((bs: any) => {
          const barberId = bs.barber.id;
          if (barberCounts.has(barberId)) {
            barberCounts.get(barberId)!.count++;
          } else {
            barberCounts.set(barberId, { barber: bs.barber, count: 1 });
          }
        });
      });

      // Filtrar solo los que ofrecen todos los servicios
      const qualifiedBarbers = Array.from(barberCounts.values())
        .filter((item) => item.count === serviceIds.length)
        .map((item) => item.barber);

      setBarbers(qualifiedBarbers);
    } catch (err) {
      console.error("Error al cargar barberos:", err);
    }
  };

  const fetchAvailableSlots = async () => {
    if (!selectedBarber || !selectedDate || selectedServices.length === 0)
      return;

    try {
      setLoading(true);
      // Calcular duración total de todos los servicios
      const totalDuration = selectedServices.reduce(
        (sum, s) => sum + s.duration,
        0
      );

      const res = await fetch(
        `/api/appointments/availability?barberId=${selectedBarber.id}&date=${selectedDate}&duration=${totalDuration}`
      );
      const data = await res.json();
      setAvailableSlots(data.slots || []);
    } catch (err) {
      console.error("Error al cargar disponibilidad:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (
      selectedServices.length === 0 ||
      !selectedBarber ||
      !selectedDate ||
      !selectedTime
    ) {
      setError("Por favor completa todos los campos");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceIds: selectedServices.map((s) => s.id),
          barberId: selectedBarber.id,
          date: selectedDate,
          startTime: selectedTime,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push("/cliente/citas");
        router.refresh();
      } else {
        setError(data.error || "Error al crear la cita");
      }
    } catch (err) {
      setError("Error al crear la cita");
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (service: Service) => {
    setSelectedServices((prev) => {
      const isSelected = prev.some((s) => s.id === service.id);
      if (isSelected) {
        return prev.filter((s) => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = selectedServices.reduce(
    (sum, s) => sum + s.duration,
    0
  );

  const handleDateSelect = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    setSelectedDate(dateStr);
    setSelectedTime("");
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isDateSelected = (date: Date) => {
    if (!selectedDate) return false;
    return date.toISOString().split("T")[0] === selectedDate;
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

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

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    router.push("/login");
    return null;
  }

  const servicesByCategory = services.reduce(
    (acc, service) => {
      if (!acc[service.category]) acc[service.category] = [];
      acc[service.category].push(service);
      return acc;
    },
    {} as Record<string, Service[]>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">Nueva Cita</h1>
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Cancelar
            </button>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex flex-1 items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${
                    step >= s
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {s}
                </div>
                {s < 4 && (
                  <div
                    className={`mx-2 h-1 flex-1 ${
                      step > s ? "bg-indigo-600" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-sm text-gray-600">
            <span>Servicio</span>
            <span>Barbero</span>
            <span>Fecha</span>
            <span>Confirmar</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded border border-red-200 bg-red-50 px-4 py-3 text-red-800">
            {error}
          </div>
        )}

        <div className="rounded-lg bg-white p-6 shadow">
          {/* Step 1: Seleccionar Servicios */}
          {step === 1 && (
            <div>
              <h2 className="mb-6 text-2xl font-bold text-gray-900">
                Selecciona uno o más servicios
              </h2>

              {/* Resumen de selección */}
              {selectedServices.length > 0 && (
                <div className="mb-6 rounded-lg border border-indigo-200 bg-indigo-50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-gray-900">
                      {selectedServices.length} servicio
                      {selectedServices.length > 1 ? "s" : ""} seleccionado
                      {selectedServices.length > 1 ? "s" : ""}
                    </span>
                    <div className="text-right">
                      <div className="text-lg font-bold text-indigo-600">
                        {formatCurrency(totalPrice)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {totalDuration} min total
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedServices.map((service) => (
                      <span
                        key={service.id}
                        className="rounded-full border border-indigo-300 bg-white px-3 py-1 text-sm"
                      >
                        {service.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-6">
                {Object.entries(servicesByCategory).map(
                  ([category, categoryServices]) => (
                    <div key={category}>
                      <h3 className="mb-3 text-lg font-semibold uppercase tracking-wide text-gray-700">
                        {category}
                      </h3>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {categoryServices.map((service) => {
                          const isSelected = selectedServices.some(
                            (s) => s.id === service.id
                          );
                          return (
                            <button
                              key={service.id}
                              onClick={() => toggleService(service)}
                              className={`rounded-lg border-2 p-4 text-left transition-all ${
                                isSelected
                                  ? "border-indigo-500 bg-indigo-50"
                                  : "border-gray-200 hover:border-indigo-300"
                              }`}
                            >
                              <div className="mb-2 flex items-start justify-between">
                                <h4 className="font-semibold text-gray-900">
                                  {service.name}
                                </h4>
                                <div
                                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border-2 ${
                                    isSelected
                                      ? "border-indigo-500 bg-indigo-500"
                                      : "border-gray-300"
                                  }`}
                                >
                                  {isSelected && (
                                    <svg
                                      className="h-4 w-4 text-white"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              <p className="mt-1 text-sm text-gray-600">
                                {service.description}
                              </p>
                              <div className="mt-3 flex items-center justify-between">
                                <span className="text-lg font-bold text-indigo-600">
                                  {formatCurrency(service.price)}
                                </span>
                                <span className="text-sm text-gray-500">
                                  {service.duration} min
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
              </div>
              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => router.push("/")}
                  className="rounded-lg bg-gray-500 px-6 py-2 text-white hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={selectedServices.length === 0}
                  className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Seleccionar Barbero */}
          {step === 2 && (
            <div>
              <h2 className="mb-6 text-2xl font-bold text-gray-900">
                Selecciona un barbero
              </h2>
              {barbers.length === 0 ? (
                <p className="text-gray-600">
                  No hay barberos disponibles para este servicio
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {barbers.map((barber) => (
                    <button
                      key={barber.id}
                      onClick={() => setSelectedBarber(barber)}
                      className={`rounded-xl border-2 p-6 text-left transition-all hover:shadow-lg ${
                        selectedBarber?.id === barber.id
                          ? "border-indigo-500 bg-indigo-50 shadow-md"
                          : "border-gray-200 hover:border-indigo-300"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`${selectedBarber?.id === barber.id ? "rounded-full ring-4 ring-indigo-500 ring-offset-2" : ""}`}
                        >
                          <BarberImage
                            image={barber.user.image}
                            name={barber.user.name}
                            size={80}
                            className="shadow-md"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <h4 className="text-lg font-bold text-gray-900">
                              {barber.user.name}
                            </h4>
                            {selectedBarber?.id === barber.id && (
                              <svg
                                className="h-5 w-5 text-indigo-600"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                          <p className="mb-2 text-sm text-gray-600">
                            <span className="inline-flex items-center gap-1">
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                />
                              </svg>
                              {barber.yearsExp} años de experiencia
                            </span>
                          </p>
                          <div className="flex items-center gap-1">
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <svg
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < Math.floor(barber.rating)
                                      ? "text-yellow-400"
                                      : "text-gray-300"
                                  }`}
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                              ))}
                            </div>
                            <span className="ml-1 text-sm font-semibold text-gray-700">
                              {barber.rating.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-6 flex justify-between">
                <div className="flex gap-4">
                  <button
                    onClick={() => router.push("/")}
                    className="rounded-lg bg-gray-500 px-6 py-2 text-white hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => setStep(1)}
                    className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    Anterior
                  </button>
                </div>
                <button
                  onClick={() => setStep(3)}
                  disabled={!selectedBarber}
                  className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Seleccionar Fecha y Hora */}
          {step === 3 && (
            <div>
              <h2 className="mb-6 text-2xl font-bold text-gray-900">
                Selecciona fecha y hora
              </h2>
              <div className="space-y-6">
                {/* Calendario Moderno */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  {/* Header del calendario */}
                  <div className="mb-6 flex items-center justify-between">
                    <button
                      onClick={() =>
                        setCurrentMonth(
                          new Date(
                            currentMonth.getFullYear(),
                            currentMonth.getMonth() - 1
                          )
                        )
                      }
                      className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                    >
                      <svg
                        className="h-5 w-5 text-gray-600"
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
                      onClick={() =>
                        setCurrentMonth(
                          new Date(
                            currentMonth.getFullYear(),
                            currentMonth.getMonth() + 1
                          )
                        )
                      }
                      className="rounded-lg p-2 transition-colors hover:bg-gray-100"
                    >
                      <svg
                        className="h-5 w-5 text-gray-600"
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
                        className="py-2 text-center text-xs font-semibold text-gray-600"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Días del mes */}
                  <div className="grid grid-cols-7 gap-2">
                    {calendarDays.map((date, index) => {
                      const disabled = isDateDisabled(date);
                      const selected = isDateSelected(date);
                      const currentMonthDay = isCurrentMonth(date);
                      const isToday =
                        date.toDateString() === new Date().toDateString();

                      return (
                        <button
                          key={index}
                          onClick={() => !disabled && handleDateSelect(date)}
                          disabled={disabled}
                          className={`aspect-square rounded-lg p-2 text-sm font-medium transition-all ${
                            selected
                              ? "scale-105 bg-indigo-600 text-white shadow-md"
                              : disabled
                                ? "cursor-not-allowed text-gray-300"
                                : currentMonthDay
                                  ? "text-gray-900 hover:scale-105 hover:bg-indigo-50"
                                  : "text-gray-400 hover:bg-gray-50"
                          } ${isToday && !selected ? "ring-2 ring-indigo-600" : ""} `}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Horarios disponibles */}
                {selectedDate && (
                  <div>
                    <label className="mb-4 block text-sm font-medium text-gray-700">
                      Horarios disponibles para el{" "}
                      {new Date(selectedDate + "T00:00:00").toLocaleDateString(
                        "es-ES",
                        {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        }
                      )}
                    </label>
                    <div className="grid grid-cols-4 gap-3">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot.time}
                          onClick={() => setSelectedTime(slot.time)}
                          disabled={!slot.available}
                          className={`rounded-lg px-4 py-3 font-medium transition-all ${
                            selectedTime === slot.time
                              ? "scale-105 bg-indigo-600 text-white shadow-md"
                              : slot.available
                                ? "bg-gray-100 text-gray-900 hover:scale-105 hover:bg-indigo-100"
                                : "cursor-not-allowed bg-gray-50 text-gray-400"
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-between">
                <div className="flex gap-4">
                  <button
                    onClick={() => router.push("/")}
                    className="rounded-lg bg-gray-500 px-6 py-2 text-white hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    Anterior
                  </button>
                </div>
                <button
                  onClick={() => setStep(4)}
                  disabled={!selectedDate || !selectedTime}
                  className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continuar
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmar */}
          {step === 4 && (
            <div>
              <h2 className="mb-6 text-2xl font-bold text-gray-900">
                Confirmar cita
              </h2>
              <div className="space-y-6 rounded-xl border-2 border-gray-200 bg-white p-6 shadow-sm">
                {/* Servicios */}
                <div className="rounded-lg bg-indigo-50 p-4">
                  <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-indigo-900">
                    Servicios Seleccionados
                  </p>
                  <div className="space-y-3">
                    {selectedServices.map((service) => (
                      <div
                        key={service.id}
                        className="rounded-lg bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">
                              {service.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {formatDuration(service.duration)}
                            </p>
                          </div>
                          <p className="text-lg font-bold text-indigo-600">
                            {formatCurrency(service.price)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 border-t-2 border-indigo-200 pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-gray-900">
                        Total
                      </span>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-indigo-600">
                          {formatCurrency(totalPrice)}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatDuration(totalDuration)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Barbero */}
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
                    Tu Barbero
                  </p>
                  <div className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm">
                    <BarberImage
                      image={selectedBarber?.user.image}
                      name={selectedBarber?.user.name || ""}
                      size={64}
                      className="ring-2 ring-indigo-500"
                    />
                    <div className="flex-1">
                      <p className="text-lg font-bold text-gray-900">
                        {selectedBarber?.user.name}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`h-4 w-4 ${
                                i < Math.floor(selectedBarber?.rating || 0)
                                  ? "text-yellow-400"
                                  : "text-gray-300"
                              }`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-sm font-semibold text-gray-600">
                          {selectedBarber?.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fecha y hora */}
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
                    Fecha y Hora
                  </p>
                  <div className="rounded-lg bg-white p-4 shadow-sm">
                    <div className="mb-2 flex items-center gap-3">
                      <svg
                        className="h-5 w-5 text-indigo-600"
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
                      <p className="text-lg font-semibold capitalize text-gray-900">
                        {new Date(
                          selectedDate + "T00:00:00"
                        ).toLocaleDateString("es-ES", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <svg
                        className="h-5 w-5 text-indigo-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-lg font-semibold text-gray-900">
                        {selectedTime}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-between">
                <div className="flex gap-4">
                  <button
                    onClick={() => router.push("/")}
                    className="rounded-lg bg-gray-500 px-6 py-2 text-white hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    Anterior
                  </button>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? "Confirmando..." : "Confirmar Cita"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
