"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import {
  Calendar,
  Clock,
  Scissors,
  Star,
  ArrowLeft,
  CalendarClock,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate, formatTime, cn } from "@/lib/utils";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface AppointmentService {
  serviceName: string;
  price: string;
  duration: number;
}

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
  appointmentServices: AppointmentService[];
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
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AppointmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [hasReview, setHasReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      api.get<Appointment>(`/booking/appointments/${id}`),
      api
        .get<Review[]>(`/marketplace/reviews/appointment/${id}`)
        .catch(() => []),
    ])
      .then(([appt, revs]) => {
        setAppointment(appt);
        setHasReview(revs.length > 0);
      })
      .catch((err) => setError(err.message || "Error al cargar la cita"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleCancel = async () => {
    if (!appointment) return;
    setCancelling(true);
    try {
      await api.post(`/booking/appointments/${appointment.id}/cancel`, {
        reason: "Cancelado por el cliente",
      });
      setAppointment({ ...appointment, status: "CANCELLED" });
      setCancelDialogOpen(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al cancelar la cita";
      setError(message);
    } finally {
      setCancelling(false);
    }
  };

  /* ---- Helpers ---- */
  const isFuture = (date: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(date + "T12:00:00") >= today;
  };

  const canCancel =
    appointment &&
    (appointment.status === "PENDING" || appointment.status === "CONFIRMED") &&
    isFuture(appointment.date);

  const canReschedule =
    appointment &&
    (appointment.status === "PENDING" || appointment.status === "CONFIRMED") &&
    isFuture(appointment.date);

  const canReview =
    appointment &&
    appointment.status === "COMPLETED" &&
    !hasReview;

  /* ---- Render ---- */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Cargando cita...</p>
      </div>
    );
  }

  if (error && !appointment) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="h-12 w-12 text-red-400 mb-3" />
        <p className="text-red-600">{error}</p>
        <Link href="/dashboard/client/appointments">
          <Button variant="outline" className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Volver a mis citas
          </Button>
        </Link>
      </div>
    );
  }

  if (!appointment) return null;

  const status =
    statusConfig[appointment.status] || {
      label: appointment.status,
      color: "bg-gray-100 text-gray-800",
    };

  const totalDuration = appointment.appointmentServices.reduce(
    (sum, s) => sum + s.duration,
    0
  );

  return (
    <div>
      {/* Back link */}
      <Link
        href="/dashboard/client/appointments"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a mis citas
      </Link>

      {/* Title row */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Detalle de cita</h1>
          <Badge className={status.color}>{status.label}</Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Services */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Scissors className="h-4 w-4" />
                Servicios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {appointment.appointmentServices.map((svc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{svc.serviceName}</p>
                      <p className="text-sm text-muted-foreground">
                        {svc.duration} min
                      </p>
                    </div>
                    <span className="font-semibold">
                      {formatCurrency(parseFloat(svc.price))}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <span className="text-sm font-medium text-muted-foreground">
                  Total ({totalDuration} min)
                </span>
                <span className="text-lg font-bold">
                  {formatCurrency(parseFloat(appointment.totalAmount))}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {appointment.notes && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Notas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {appointment.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Date & time card */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                Fecha y hora
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="font-medium">
                  {formatDate(appointment.date)}
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
                <Clock className="h-5 w-5 text-primary" />
                <span className="font-medium">
                  {formatTime(appointment.startTime)} -{" "}
                  {formatTime(appointment.endTime)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Actions card */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {canReschedule && (
                <Link
                  href={`/dashboard/client/appointments/${appointment.id}/reschedule`}
                  className="block"
                >
                  <Button variant="outline" className="w-full gap-2">
                    <CalendarClock className="h-4 w-4" />
                    Reagendar
                  </Button>
                </Link>
              )}
              {canCancel && (
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={() => setCancelDialogOpen(true)}
                >
                  Cancelar cita
                </Button>
              )}
              {canReview && (
                <Link
                  href={`/dashboard/client/appointments/${appointment.id}/review`}
                  className="block"
                >
                  <Button className="w-full gap-2">
                    <Star className="h-4 w-4" />
                    Dejar resena
                  </Button>
                </Link>
              )}
              {!canCancel && !canReschedule && !canReview && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  No hay acciones disponibles para esta cita
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancel confirmation dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        title="Cancelar cita"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Estas seguro de que deseas cancelar esta cita? Esta accion no se
            puede deshacer.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              disabled={cancelling}
            >
              No, mantener
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelando..." : "Si, cancelar cita"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
