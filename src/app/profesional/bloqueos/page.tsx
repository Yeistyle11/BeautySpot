"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface BlockedSlot {
  id?: number;
  professionalId: number;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
}

interface Professional {
  id: number;
  userId: number;
}

export default function BlockedSlotsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [professionalId, setProfessionalId] = useState<number | null>(null);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [slotToDelete, setSlotToDelete] = useState<number | null>(null);

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

    if (session?.user) {
      if (
        session.user.role !== "PROFESSIONAL" &&
        session.user.role !== "ADMIN"
      ) {
        router.push("/");
        return;
      }
      fetchProfessionalAndSlots();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status]);

  const fetchProfessionalAndSlots = async () => {
    try {
      setLoading(true);

      // Obtener profesional
      const professionalRes = await fetch("/api/professionals");
      const professionals: Professional[] = await professionalRes.json();
      const myProfessional = professionals.find(
        (b) => b.userId === parseInt(session!.user.id)
      );

      if (!myProfessional) {
        setMessage("No se encontró el perfil de profesional");
        return;
      }

      setProfessionalId(myProfessional.id);

      // Obtener bloques bloqueados
      const slotsRes = await fetch(
        `/api/professionals/${myProfessional.id}/blocked-slots`
      );
      const slotsData: BlockedSlot[] = await slotsRes.json();
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
    if (!professionalId) return;

    try {
      setMessage("");

      const response = await fetch(
        `/api/professionals/${professionalId}/blocked-slots`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        }
      );

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
      await fetchProfessionalAndSlots();
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error:", error);
      setMessage("Error al crear bloque");
    }
  };

  const confirmDelete = async () => {
    if (slotToDelete === null || !professionalId) {
      setSlotToDelete(null);
      return;
    }

    const targetSlotId = slotToDelete;
    setSlotToDelete(null);

    try {
      const response = await fetch(
        `/api/professionals/${professionalId}/blocked-slots?slotId=${targetSlotId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Error al eliminar");
      }

      setMessage("Bloque eliminado");
      await fetchProfessionalAndSlots();
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-amber-600"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">
              Bloqueos de Tiempo
            </h1>
            <button
              onClick={() => setShowForm(!showForm)}
              className="rounded-lg bg-amber-600 px-4 py-2 text-white transition-colors hover:bg-amber-700"
            >
              {showForm ? "Cancelar" : "+ Nuevo Bloqueo"}
            </button>
          </div>

          <p className="mb-6 text-gray-600">
            Bloquea días u horarios específicos en los que no estarás disponible
            (vacaciones, permisos, etc.).
          </p>

          {message && (
            <div
              className={`mb-6 rounded-lg p-4 ${
                message.includes("Error")
                  ? "border border-red-200 bg-red-50 text-red-800"
                  : "border border-green-200 bg-green-50 text-green-800"
              }`}
            >
              {message}
            </div>
          )}

          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="mb-8 rounded-lg border border-gray-200 bg-gray-50 p-6"
            >
              <h3 className="mb-4 text-lg font-semibold">Crear Bloqueo</h3>

              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
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
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Motivo
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Vacaciones, Permiso personal"
                    value={formData.reason}
                    onChange={(e) =>
                      setFormData({ ...formData, reason: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Desde *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) =>
                      setFormData({ ...formData, startTime: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Hasta *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) =>
                      setFormData({ ...formData, endTime: e.target.value })
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-amber-600 px-4 py-2 font-medium text-white transition-colors hover:bg-amber-700"
              >
                Crear Bloqueo
              </button>
            </form>
          )}

          <div className="space-y-4">
            {blockedSlots.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <p className="text-lg">No tienes bloqueos programados</p>
                <p className="mt-2 text-sm">
                  Crea un bloqueo para marcar días u horarios no disponibles
                </p>
              </div>
            ) : (
              blockedSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {formatDate(slot.date)}
                      </h3>
                      <p className="mt-1 text-gray-600">
                        {slot.startTime} - {slot.endTime}
                      </p>
                      {slot.reason && (
                        <p className="mt-2 text-sm text-gray-500">
                          Motivo: {slot.reason}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => setSlotToDelete(slot.id!)}
                      className="rounded px-3 py-1 text-red-600 transition-colors hover:bg-red-50 hover:text-red-800"
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
              onClick={() => router.push("/profesional/disponibilidad")}
              className="rounded-lg border border-gray-300 px-6 py-3 font-medium transition-colors hover:bg-gray-50"
            >
              ← Volver a Disponibilidad
            </button>
            <button
              onClick={() => router.push("/profesional")}
              className="rounded-lg border border-gray-300 px-6 py-3 font-medium transition-colors hover:bg-gray-50"
            >
              Ir al Dashboard
            </button>
          </div>
        </div>
      </div>

      {slotToDelete !== null && (
        <ConfirmDialog
          title="Eliminar bloque"
          message="¿Eliminar este bloque?"
          confirmText="Sí, eliminar"
          confirmColor="red"
          onConfirm={confirmDelete}
          onCancel={() => setSlotToDelete(null)}
        />
      )}
    </div>
  );
}
