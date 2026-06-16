"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  Scissors,
  Star,
  ArrowRight,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatTime, cn } from "@/lib/utils";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  totalAmount: string;
  professionalId: string;
  clientId: string;
  appointmentServices: {
    serviceName: string;
    price: string;
    duration: number;
  }[];
}

interface Review {
  id: string;
  appointmentId: string;
}

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */

const statusConfig: Record<
  string,
  { label: string; color: string }
> = {
  PENDING: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800" },
  CONFIRMED: { label: "Confirmada", color: "bg-blue-100 text-blue-800" },
  COMPLETED: { label: "Completada", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelada", color: "bg-red-100 text-red-800" },
  NO_SHOW: { label: "No asistio", color: "bg-gray-100 text-gray-800" },
};

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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Appointment[]>("/booking/appointments").catch(() => []),
      api.get<Review[]>("/marketplace/reviews/mine").catch(() => []),
    ])
      .then(([appts, revs]) => {
        setAppointments(appts);
        setReviews(revs);
      })
      .catch((err) => setError(err.message || "Error al cargar las citas"))
      .finally(() => setLoading(false));
  }, []);

  const reviewedIds = new Set(reviews.map((r) => r.appointmentId));
  const filtered = filterByTab(appointments, activeTab).sort((a, b) =>
    `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`)
  );

  /* ---- Render ---- */
  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis citas</h1>
          <p className="text-muted-foreground">
            Gestiona tus citas agendadas
          </p>
        </div>
        <Link href="/marketplace">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Reservar nueva cita
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            Cargando citas...
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center text-red-600">
            {error}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground opacity-20" />
            <p className="mt-2 text-muted-foreground">
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
            const status =
              statusConfig[appt.status] || {
                label: appt.status,
                color: "bg-gray-100 text-gray-800",
              };
            const hasReview = reviewedIds.has(appt.id);
            const canReview =
              appt.status === "COMPLETED" && !hasReview;

            return (
              <Link
                key={appt.id}
                href={`/dashboard/client/appointments/${appt.id}`}
              >
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {/* Left: icon + info */}
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <Scissors className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">
                            {appt.appointmentServices
                              .map((s) => s.serviceName)
                              .join(", ")}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
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

                      {/* Right: amount + status + optional review link */}
                      <div className="flex items-center gap-3 sm:shrink-0">
                        <span className="font-semibold">
                          {formatCurrency(parseFloat(appt.totalAmount))}
                        </span>
                        <Badge className={status.color}>
                          {status.label}
                        </Badge>
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
