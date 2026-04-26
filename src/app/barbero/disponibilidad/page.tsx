"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface AvailabilitySlot {
  id?: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active: boolean;
}

const DAYS_OF_WEEK = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export default function BarberAvailabilityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [barberId, setBarberId] = useState<number | null>(null);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (session?.user) {
      if (session.user.role !== "BARBER" && session.user.role !== "ADMIN") {
        router.push("/");
        return;
      }
      fetchBarberAndAvailability();
    }
  }, [session, status]);

  const fetchBarberAndAvailability = async () => {
    try {
      setLoading(true);

      // Obtener información del barbero
      const barberRes = await fetch("/api/barbers");
      const barbers = await barberRes.json();
      const myBarber = barbers.find(
        (b: any) => b.userId === parseInt(session!.user.id)
      );

      if (!myBarber) {
        setMessage("No se encontró el perfil de barbero");
        return;
      }

      setBarberId(myBarber.id);

      // Obtener disponibilidad
      const availRes = await fetch(
        `/api/barbers/${myBarber.id}/availability`
      );
      const availData = await availRes.json();

      if (availData.length === 0) {
        // Inicializar con horario por defecto de lunes a viernes
        const defaultAvailability: AvailabilitySlot[] = [1, 2, 3, 4, 5].map(
          (day) => ({
            dayOfWeek: day,
            startTime: "09:00",
            endTime: "18:00",
            active: true,
          })
        );
        setAvailability(defaultAvailability);
      } else {
        setAvailability(availData);
      }
    } catch (error) {
      console.error("Error al cargar disponibilidad:", error);
      setMessage("Error al cargar disponibilidad");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDay = (dayOfWeek: number) => {
    const existing = availability.find((a) => a.dayOfWeek === dayOfWeek);

    if (existing) {
      // Remover el día
      setAvailability(availability.filter((a) => a.dayOfWeek !== dayOfWeek));
    } else {
      // Agregar el día con horario por defecto
      setAvailability([
        ...availability,
        {
          dayOfWeek,
          startTime: "09:00",
          endTime: "18:00",
          active: true,
        },
      ]);
    }
  };

  const handleTimeChange = (
    dayOfWeek: number,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setAvailability(
      availability.map((slot) =>
        slot.dayOfWeek === dayOfWeek ? { ...slot, [field]: value } : slot
      )
    );
  };

  const handleSave = async () => {
    if (!barberId) return;

    try {
      setSaving(true);
      setMessage("");

      const response = await fetch(`/api/barbers/${barberId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availability }),
      });

      if (!response.ok) {
        throw new Error("Error al guardar");
      }

      setMessage("Disponibilidad guardada correctamente");
      setTimeout(() => {
        router.push("/barbero");
      }, 1500);
    } catch (error) {
      console.error("Error al guardar:", error);
      setMessage("Error al guardar disponibilidad");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Gestionar Disponibilidad
          </h1>

          <p className="text-gray-600 mb-6">
            Selecciona los días y horarios en los que estás disponible para
            atender clientes.
          </p>

          {message && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                message.includes("Error")
                  ? "bg-red-50 text-red-800 border border-red-200"
                  : "bg-green-50 text-green-800 border border-green-200"
              }`}
            >
              {message}
            </div>
          )}

          <div className="space-y-4">
            {DAYS_OF_WEEK.map((dayName, index) => {
              const slot = availability.find((a) => a.dayOfWeek === index);
              const isActive = !!slot;

              return (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => handleToggleDay(index)}
                        className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500"
                      />
                      <label className="text-lg font-medium text-gray-900">
                        {dayName}
                      </label>
                    </div>

                    {isActive && slot && (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">
                            Desde:
                          </label>
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) =>
                              handleTimeChange(
                                index,
                                "startTime",
                                e.target.value
                              )
                            }
                            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">
                            Hasta:
                          </label>
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) =>
                              handleTimeChange(index, "endTime", e.target.value)
                            }
                            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex gap-4">
            <button
              onClick={handleSave}
              disabled={saving || !barberId}
              className="flex-1 bg-amber-600 text-white py-3 px-6 rounded-lg hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {saving ? "Guardando..." : "Guardar Disponibilidad"}
            </button>

            <button
              onClick={() => router.push("/barbero")}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancelar
            </button>
          </div>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            💡 Información
          </h3>
          <ul className="space-y-2 text-blue-800 text-sm">
            <li>
              • Los clientes solo podrán agendar citas en los días y horarios
              que configures aquí.
            </li>
            <li>
              • Puedes modificar tu disponibilidad en cualquier momento.
            </li>
            <li>
              • Las citas ya agendadas no se verán afectadas por cambios en la
              disponibilidad.
            </li>
            <li>
              • Para bloquear días específicos (vacaciones, días libres),
              dirígete a la sección de bloqueos.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
