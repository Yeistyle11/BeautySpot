"use client";

// Mis citas: historial y proximas citas del cliente.

import { useState } from "react";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Scissors, Star, Plus } from "lucide-react";
import { formatCurrency, formatDate, formatTime, cn } from "@/lib/utils";
import { getAppointmentStatus } from "@/lib/status";
import { useApi } from "@/lib/swr";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

const appointmentSchema = z.object({
  id: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  status: z.string(),
  notes: z.string().nullable(),
  totalAmount: z.string(),
  professionalId: z.string(),
  clientId: z.string(),
  appointmentServices: z.array(
    z.object({
      serviceName: z.string(),
      price: z.string(),
      duration: z.number(),
    })
  ),
});
type Appointment = z.infer<typeof appointmentSchema>;

const reviewSchema = z.object({
  id: z.string(),
  appointmentId: z.string(),
});
type Review = z.infer<typeof reviewSchema>;

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Tab type                                                           */
/* ------------------------------------------------------------------ */

type TabKey = "all" | "upcoming" | "completed" | "cancelled";

const tabs: { key: TabKey; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "upcoming", label: "Proximas" },
  { key: "completed", label: "Completadas" },
  { key: "cancelled", label: "Canceladas" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AppointmentsPage() {
  const { data: appointments, isLoading: loading } = useApi<Appointment[]>(
    "/booking/appointments",
    undefined,
    z.array(appointmentSchema)
  );
  const { data: reviews } = useApi<Review[]>(
    "/marketplace/reviews/mine",
    undefined,
    z.array(reviewSchema)
  );
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const reviewedIds = new Set((reviews ?? []).map((r) => r.appointmentId));
  const filtered = filterByTab(appointments ?? [], activeTab).sort((a, b) =>
    `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)
  );

  /* ---- Render ---- */
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

      <div className="bg-muted mb-6 flex gap-1 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="text-muted-foreground p-8 text-center">
            Cargando citas...
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <Calendar className="text-muted-foreground mx-auto h-12 w-12 opacity-20" />
            <p className="text-muted-foreground mt-2">
              No tienes citas en esta categoria
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

            return (
              <Link
                key={appt.id}
                href={`/dashboard/client/appointments/${appt.id}`}
              >
                <Card className="cursor-pointer border-0 shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="p-5">
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
                          {formatCurrency(parseFloat(appt.totalAmount))}
                        </span>
                        <Badge className={status.color}>{status.label}</Badge>
                        {canReview && (
                          <span
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            className="ml-1"
                          >
                            <Link
                              href={`/dashboard/client/appointments/${appt.id}/review`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Star className="h-3 w-3" />
                              Dejar resena
                            </Link>
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
