"use client";

// Mis citas: historial y proximas citas del cliente.

import { useMemo, useState } from "react";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Scissors, Star, Plus, Store } from "lucide-react";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { getAppointmentStatus } from "@/lib/status";
import { useApi, useApiPublic, paginatedSchema } from "@/lib/swr";
import { ErrorDeCarga } from "@/components/ui/error-de-carga";
import { FilterChip } from "@/components/ui/filter-chip";
import Link from "next/link";

import {
  appointmentSchema,
  negocioPublicoSchema,
  reviewSchema,
  MY_APPOINTMENTS_KEY,
  type Appointment,
  type NegocioPublico,
} from "@/lib/schemas/appointment";

type TabKey = "all" | "upcoming" | "completed" | "cancelled";

const tabs: { key: TabKey; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "upcoming", label: "Próximas" },
  { key: "completed", label: "Completadas" },
  { key: "cancelled", label: "Canceladas" },
];

function filterByTab(appointments: Appointment[], tab: TabKey): Appointment[] {
  switch (tab) {
    case "upcoming":
      return appointments.filter(
        (a) => a.status === "PENDING" || a.status === "CONFIRMED"
      );
    case "completed":
      return appointments.filter((a) => a.status === "COMPLETED");
    case "cancelled":
      return appointments.filter(
        (a) => a.status === "CANCELLED" || a.status === "NO_SHOW"
      );
    default:
      return appointments;
  }
}

export default function AppointmentsPage() {
  const {
    data: pagina,
    isLoading: loading,
    error: loadError,
    mutate: recargar,
  } = useApi(
    MY_APPOINTMENTS_KEY,
    undefined,
    paginatedSchema(appointmentSchema)
  );
  const appointments: Appointment[] = useMemo(
    () => pagina?.data ?? [],
    [pagina?.data]
  );
  // Se pregunta solo por las citas en pantalla: el historial de reseñas crece
  // con cada visita y aquí solo hace falta saber cuáles de estas ya se valoraron.
  const idsEnPantalla = useMemo(
    () => appointments.map((a) => a.id).join(","),
    [appointments]
  );
  const { data: reviews } = useApi(
    idsEnPantalla
      ? `/marketplace/reviews/mine?appointmentIds=${idsEnPantalla}&limit=100`
      : null,
    undefined,
    paginatedSchema(reviewSchema)
  );
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  // La cita solo guarda el id del negocio; el nombre se resuelve contra el
  // listado publico, el mismo que alimenta el buscador del marketplace.
  const { data: negocios } = useApiPublic<NegocioPublico[]>(
    "/core/public/businesses",
    undefined,
    z.array(negocioPublicoSchema)
  );

  const nombreDelNegocio = useMemo(() => {
    const nombres: Record<string, string> = {};
    (negocios ?? []).forEach((n) => {
      nombres[n.id] = n.name;
    });
    return nombres;
  }, [negocios]);

  const reviewedIds = useMemo(
    () => new Set((reviews?.data ?? []).map((r) => r.appointmentId)),
    [reviews]
  );
  // Copia la lista antes de ordenar: el filtro devuelve el array de la cache.
  const filtered = useMemo(
    () =>
      [...filterByTab(appointments, activeTab)].sort((a, b) =>
        `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)
      ),
    [appointments, activeTab]
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis citas</h1>
          <p className="text-muted-foreground">Gestiona tus citas agendadas</p>
        </div>
        <Link href="/marketplace">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Reservar nueva cita
          </Button>
        </Link>
      </div>

      <div
        role="group"
        aria-label="Filtrar citas por estado"
        className="bg-muted mb-6 flex gap-1 rounded-lg p-1"
      >
        {tabs.map((tab) => (
          <FilterChip
            key={tab.key}
            variante="segment"
            activo={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </FilterChip>
        ))}
      </div>

      {loading ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="text-muted-foreground p-8 text-center">
            Cargando citas...
          </CardContent>
        </Card>
      ) : loadError ? (
        <ErrorDeCarga
          error={loadError}
          recurso="tus citas"
          onReintentar={() => recargar()}
        />
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <Calendar className="text-muted-foreground mx-auto h-12 w-12 opacity-20" />
            <p className="text-muted-foreground mt-2">
              No tienes citas en esta categoría
            </p>
            <Link href="/marketplace">
              <Button variant="outline" className="mt-4">
                Explorar negocios
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((appt) => {
            const status = getAppointmentStatus(appt.status);
            const hasReview = reviewedIds.has(appt.id);
            const canReview = appt.status === "COMPLETED" && !hasReview;

            // El enlace al detalle cubre la tarjeta con un overlay absoluto, sin
            // envolverla: dentro hay otro enlace.
            return (
              <Card
                key={appt.id}
                className="relative border-0 shadow-sm transition-shadow hover:shadow-md"
              >
                <CardContent className="p-5">
                  <Link
                    href={`/dashboard/client/appointments/${appt.id}`}
                    className="focus-visible:ring-ring absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2"
                  >
                    <span className="sr-only">
                      Ver detalle de la cita del {formatDate(appt.date)}
                    </span>
                  </Link>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                        <Scissors className="text-primary h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">
                          {appt.appointmentServices
                            .map((s) => s.serviceName)
                            .join(", ")}
                        </p>
                        {nombreDelNegocio[appt.businessId] && (
                          <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-sm">
                            <Store className="h-3 w-3" />
                            {nombreDelNegocio[appt.businessId]}
                          </p>
                        )}
                        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-sm">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(appt.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(appt.startTime)} -{" "}
                            {formatTime(appt.endTime)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:shrink-0">
                      <span className="font-semibold">
                        {formatCurrency(appt.totalAmount)}
                      </span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {canReview && (
                        <Link
                          href={`/dashboard/client/appointments/${appt.id}/review`}
                          className="relative ml-1 inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline"
                        >
                          <Star className="h-3 w-3" />
                          Dejar reseña
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
