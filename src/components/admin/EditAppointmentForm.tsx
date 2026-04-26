"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarberImage } from "@/components/shared/BarberImage";
import { formatCurrency, formatDuration } from "@/lib/utils";
import Toast from "@/components/ui/Toast";

type Barber = {
  id: string | number;
  user: {
    id: number;
    name: string;
    image: string | null;
  };
};

type Service = {
  id: number;
  name: string;
  description: string;
  price: number;
  duration: number;
};

type Appointment = {
  id: number;
  date: Date;
  startTime: string;
  endTime: string;
  status: string;
  barberId: string | number;
  clientId: number;
  client: {
    id: number;
    name: string;
    email: string;
  };
  barber: {
    id: string | number;
    user: {
      id: number;
      name: string;
    };
  };
  services: {
    service: Service;
  }[];
};

type Props = {
  appointment: Appointment;
  barbers: Barber[];
  services: Service[];
};

export default function EditAppointmentForm({
  appointment,
  barbers,
  services,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [selectedBarberId, setSelectedBarberId] = useState(
    appointment.barberId
  );
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>(
    appointment.services.map((as) => as.service.id)
  );
  const [date, setDate] = useState(
    new Date(appointment.date).toISOString().split("T")[0]
  );
  const [startTime, setStartTime] = useState(appointment.startTime);

  const selectedServices = services.filter((s) =>
    selectedServiceIds.includes(s.id)
  );
  const totalDuration = selectedServices.reduce(
    (sum, s) => sum + s.duration,
    0
  );
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

  const toggleService = (serviceId: number) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBarberId) {
      setToast({ message: "Por favor selecciona un barbero", type: "error" });
      return;
    }

    if (selectedServiceIds.length === 0) {
      setToast({
        message: "Por favor selecciona al menos un servicio",
        type: "error",
      });
      return;
    }

    if (!date || !startTime) {
      setToast({
        message: "Por favor completa todos los campos",
        type: "error",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberId:
            typeof selectedBarberId === "string"
              ? parseInt(selectedBarberId)
              : selectedBarberId,
          serviceIds: selectedServiceIds,
          date: date,
          startTime,
        }),
      });

      if (res.ok) {
        setToast({ message: "Cita actualizada exitosamente", type: "success" });
        setTimeout(() => {
          router.push("/admin/citas");
          router.refresh();
        }, 1500);
      } else {
        const data = await res.json();
        setToast({
          message: data.error || "Error al actualizar la cita",
          type: "error",
        });
      }
    } catch (error) {
      setToast({ message: "Error al actualizar la cita", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-lg bg-white p-6 shadow"
      >
        {/* Información del cliente (no editable) */}
        <div className="rounded-lg bg-gray-50 p-4">
          <h3 className="mb-2 font-semibold text-gray-900">Cliente</h3>
          <p className="text-gray-900">{appointment.client.name}</p>
          <p className="text-sm text-gray-600">{appointment.client.email}</p>
        </div>

        {/* Seleccionar barbero */}
        <div>
          <label className="mb-3 block text-sm font-medium text-gray-700">
            Barbero *
          </label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {barbers.map((barber) => (
              <div
                key={barber.id}
                onClick={() => setSelectedBarberId(barber.id)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-all ${
                  selectedBarberId === barber.id
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-gray-200 hover:border-indigo-300"
                }`}
              >
                <BarberImage
                  image={barber.user.image}
                  name={barber.user.name}
                  size={40}
                />
                <span className="font-medium text-gray-900">
                  {barber.user.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Seleccionar servicios */}
        <div>
          <label className="mb-3 block text-sm font-medium text-gray-700">
            Servicios * (puedes seleccionar varios)
          </label>
          <div className="space-y-2">
            {services.map((service) => (
              <div
                key={service.id}
                onClick={() => toggleService(service.id)}
                className={`flex cursor-pointer items-center justify-between rounded-lg border-2 p-4 transition-all ${
                  selectedServiceIds.includes(service.id)
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-gray-200 hover:border-indigo-300"
                }`}
              >
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">
                    {service.name}
                  </h4>
                  <p className="text-sm text-gray-600">{service.description}</p>
                  <p className="mt-1 text-sm text-gray-500">
                    {formatDuration(service.duration)}
                  </p>
                </div>
                <div className="ml-4 text-right">
                  <p className="font-bold text-indigo-600">
                    {formatCurrency(service.price)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Resumen de servicios seleccionados */}
          {selectedServiceIds.length > 0 && (
            <div className="mt-4 rounded-lg bg-indigo-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    {selectedServiceIds.length} servicio
                    {selectedServiceIds.length > 1 ? "s" : ""} seleccionado
                    {selectedServiceIds.length > 1 ? "s" : ""}
                  </p>
                  <p className="text-sm text-gray-600">
                    Duración total: {formatDuration(totalDuration)}
                  </p>
                </div>
                <p className="text-2xl font-bold text-indigo-600">
                  {formatCurrency(totalPrice)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Fecha */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Fecha *
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        {/* Hora */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            Hora de inicio *
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-6 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
