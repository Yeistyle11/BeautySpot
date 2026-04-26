"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Breadcrumbs from "@/components/shared/Breadcrumbs";

interface BlockedSlot {
  id?: number;
  barberId: number;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

export default function AdminBlockedSlotsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const barberId = parseInt(params.id as string);
  const [barberName, setBarberName] = useState("");
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");

  const [formData, setFormData] = useState({
    date: "",
    startTime: "09:00",
    endTime: "18:00",
    reason: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (session?.user && session.user.role !== "ADMIN") {
      router.push("/");
      return;
    }

    fetchBarberAndSlots();
  }, [session, status]);

  const fetchBarberAndSlots = async () => {
    try {
      setLoading(true);

      // Obtener barbero
      const barberRes = await fetch(`/api/barbers/${barberId}`);
      const barberData = await barberRes.json();
      setBarberName(barberData.user.name);

      // Obtener bloques bloqueados
      const slotsRes = await fetch(`/api/barbers/${barberId}/blocked-slots`);
      const slotsData = await slotsRes.json();
      setBlockedSlots(slotsData);
    } catch (error) {
      console.error("Error al cargar bloques:", error);
      setMessage("Error al cargar bloques");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setMessage("");

      const response = await fetch(`/api/barbers/${barberId}/blocked-slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Error al crear bloque");
      }

      setMessage("Bloque creado correctamente");
      setShowForm(false);
      setFormData({
        date: "",
        startTime: "09:00",
        endTime: "18:00",
        reason: "",
      });
      await fetchBarberAndSlots();
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error:", error);
      setMessage("Error al crear bloque");
    }
  };

  const handleDelete = async (slotId: number) => {
    if (!confirm("¿Eliminar este bloque?")) return;

    try {
      const response = await fetch(
        `/api/barbers/${barberId}/blocked-slots?slotId=${slotId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Error al eliminar");
      }

      setMessage("Bloque eliminado");
      await fetchBarberAndSlots();
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error:", error);
      setMessage("Error al eliminar bloque");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
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
          <div className="mb-6">
            <Breadcrumbs
              items={[
                { label: "Admin", href: "/admin" },
                { label: "Barberos", href: "/admin/barberos" },
                { label: barberName || "...", href: `/admin/barberos/${barberId}` },
                { label: "Bloqueos" },
              ]}
            />
            <div className="flex items-center justify-between mt-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Bloqueos de Tiempo
                </h1>
                <p className="text-gray-600 mt-2">Barbero: {barberName}</p>
              </div>
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
              >
                {showForm ? "Cancelar" : "+ Nuevo Bloqueo"}
              </button>
            </div>
          </div>

          <p className="text-gray-600 mb-6">
            Gestiona los días u horarios específicos en los que el barbero no
            estará disponible (vacaciones, permisos, etc.).
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

          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="mb-8 p-6 border border-gray-200 rounded-lg bg-gray-50"
            >
              <h3 className="text-lg font-semibold mb-4">Crear Bloqueo</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split("T")[0]}
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivo
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Vacaciones, Permiso personal"
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Desde *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hasta *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-600 text-white py-2 px-4 rounded-lg hover:bg-amber-700 transition-colors font-medium"
              >
                Crear Bloqueo
              </button>
            </form>
          )}

          <div className="space-y-4">
            {blockedSlots.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg">No hay bloqueos programados</p>
                <p className="text-sm mt-2">
                  Crea un bloqueo para marcar días u horarios no disponibles
                </p>
              </div>
            ) : (
              blockedSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {formatDate(slot.date)}
                      </h3>
                      <p className="text-gray-600 mt-1">
                        {slot.startTime} - {slot.endTime}
                      </p>
                      {slot.reason && (
                        <p className="text-sm text-gray-500 mt-2">
                          Motivo: {slot.reason}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(slot.id!)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded transition-colors"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-8 flex gap-4">
            <button
              onClick={() =>
                router.push(`/admin/barberos/${barberId}/disponibilidad`)
              }
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Ver Disponibilidad
            </button>
            <button
              onClick={() => router.push(`/admin/barberos/${barberId}`)}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Volver al Perfil
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
