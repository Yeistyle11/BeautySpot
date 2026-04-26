"use client";

import { useState } from "react";
import { BarberImage } from "@/components/shared/BarberImage";
import { formatCurrency } from "@/lib/utils";

type Service = {
  id: string | number;
  name: string;
  price: number;
  duration: number;
  category: string;
};

type Barber = {
  id: string | number;
  user: {
    name: string;
    email: string;
    image: string | null;
  };
  services: {
    serviceId: string | number;
  }[];
};

type ServiceAssignmentProps = {
  barbers: Barber[];
  allServices: Service[];
};

export default function ServiceAssignment({
  barbers,
  allServices,
}: ServiceAssignmentProps) {
  const [loading, setLoading] = useState(false);
  const [selectedServices, setSelectedServices] = useState<
    Record<string, Set<string>>
  >(() => {
    // Inicializar con los servicios ya asignados
    const initial: Record<string, Set<string>> = {};
    barbers.forEach((barber) => {
      initial[String(barber.id)] = new Set(
        barber.services.map((s) => String(s.serviceId))
      );
    });
    return initial;
  });

  // Agrupar servicios por categoría
  const servicesByCategory = allServices.reduce(
    (acc, service) => {
      if (!acc[service.category]) {
        acc[service.category] = [];
      }
      acc[service.category].push(service);
      return acc;
    },
    {} as Record<string, Service[]>
  );

  const toggleService = (barberId: string, serviceId: string) => {
    setSelectedServices((prev) => {
      const newState = { ...prev };
      const barberServices = new Set(prev[barberId]);

      if (barberServices.has(serviceId)) {
        barberServices.delete(serviceId);
      } else {
        barberServices.add(serviceId);
      }

      newState[barberId] = barberServices;
      return newState;
    });
  };

  const selectAll = (barberId: string) => {
    setSelectedServices((prev) => ({
      ...prev,
      [barberId]: new Set(allServices.map((s) => String(s.id))),
    }));
  };

  const deselectAll = (barberId: string) => {
    setSelectedServices((prev) => ({
      ...prev,
      [barberId]: new Set(),
    }));
  };

  const hasChanges = (barberId: string) => {
    const current = selectedServices[barberId] || new Set();
    const original = new Set(
      barbers
        .find((b) => String(b.id) === barberId)
        ?.services.map((s) => String(s.serviceId)) || []
    );

    if (current.size !== original.size) return true;

    for (const id of current) {
      if (!original.has(id)) return true;
    }
    return false;
  };

  const handleSave = async (barberId: string) => {
    setLoading(true);

    try {
      const currentServices = selectedServices[barberId] || new Set();
      const originalServices = new Set(
        barbers
          .find((b) => String(b.id) === barberId)
          ?.services.map((s) => String(s.serviceId)) || []
      );

      // Servicios a agregar
      const toAdd = Array.from(currentServices).filter(
        (id) => !originalServices.has(id)
      );

      // Servicios a quitar
      const toRemove = Array.from(originalServices).filter(
        (id) => !currentServices.has(id)
      );

      // Agregar servicios
      for (const serviceId of toAdd) {
        const response = await fetch("/api/barber-services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barberId, serviceId }),
        });

        if (!response.ok) {
          throw new Error("Error al agregar servicio");
        }
      }

      // Quitar servicios
      for (const serviceId of toRemove) {
        const response = await fetch("/api/barber-services", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barberId, serviceId }),
        });

        if (!response.ok) {
          throw new Error("Error al quitar servicio");
        }
      }

      window.location.reload();
    } catch (error) {
      console.error("Error:", error);
      alert("Error al guardar los cambios");
      setLoading(false);
    }
  };

  const handleCancel = (barberId: string) => {
    setSelectedServices((prev) => ({
      ...prev,
      [barberId]: new Set(
        barbers
          .find((b) => String(b.id) === barberId)
          ?.services.map((s) => String(s.serviceId)) || []
      ),
    }));
  };

  return (
    <div className="space-y-6">
      {barbers.map((barber) => {
        const currentServices =
          selectedServices[String(barber.id)] || new Set();
        const changed = hasChanges(String(barber.id));

        return (
          <div key={barber.id} className="rounded-lg bg-white shadow">
            {/* Barber Info */}
            <div className="border-b border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <BarberImage
                    image={barber.user.image}
                    name={barber.user.name}
                    size={64}
                  />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {barber.user.name}
                    </h2>
                    <p className="text-sm text-gray-600">{barber.user.email}</p>
                    <p className="text-sm text-gray-500">
                      {currentServices.size} de {allServices.length} servicios
                      seleccionados
                      {changed && (
                        <span className="ml-2 font-medium text-amber-600">
                          (cambios sin guardar)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => selectAll(String(barber.id))}
                    disabled={
                      loading || currentServices.size === allServices.length
                    }
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ✓ Seleccionar Todos
                  </button>
                  <button
                    onClick={() => deselectAll(String(barber.id))}
                    disabled={loading || currentServices.size === 0}
                    className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ✗ Quitar Todos
                  </button>
                </div>
              </div>
            </div>

            {/* Services List */}
            <div className="p-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                Servicios Disponibles
              </h3>

              {Object.entries(servicesByCategory).map(
                ([category, services]) => (
                  <div key={category} className="mb-6">
                    <h4 className="mb-3 text-sm font-medium uppercase tracking-wide text-gray-700">
                      {category}
                    </h4>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {services.map((service) => {
                        const isSelected = currentServices.has(
                          String(service.id)
                        );

                        return (
                          <button
                            key={service.id}
                            onClick={() =>
                              toggleService(
                                String(barber.id),
                                String(service.id)
                              )
                            }
                            disabled={loading}
                            className={`rounded-lg border-2 p-4 text-left transition-all ${
                              isSelected
                                ? "border-indigo-500 bg-indigo-50"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            } ${loading ? "cursor-wait opacity-50" : "cursor-pointer"} `}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">
                                  {service.name}
                                </p>
                                <p className="mt-1 text-sm text-gray-600">
                                  {formatCurrency(service.price)} •{" "}
                                  {service.duration} min
                                </p>
                              </div>
                              <div
                                className={`ml-2 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border-2 ${
                                  isSelected
                                    ? "border-indigo-500 bg-indigo-500"
                                    : "border-gray-300"
                                } `}
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
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Botones de Guardar/Cancelar */}
            {changed && (
              <div className="border-t border-gray-200 bg-gray-50 p-6">
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => handleCancel(String(barber.id))}
                    disabled={loading}
                    className="rounded-lg border-2 border-gray-300 bg-white px-6 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleSave(String(barber.id))}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <svg
                          className="h-5 w-5 animate-spin"
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
                        Guardando...
                      </>
                    ) : (
                      <>
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Guardar Cambios
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
