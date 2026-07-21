"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Clock,
  Scissors,
  ArrowLeft,
  CheckCircle,
  Loader2,
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

interface AvailabilitySlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ReschedulePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  /* ---- Load appointment ---- */
  useEffect(() => {
    if (!id) return;
    api
      .get<Appointment>(`/booking/appointments/${id}`)
      .then(setAppointment)
      .catch((err) => setError(err.message || "Error al cargar la cita"))
      .finally(() => setLoading(false));
  }, [id]);

  /* ---- Compute total duration for availability query ---- */
  const totalDuration = useMemo(() => {
    if (!appointment) return 0;
    return appointment.appointmentServices.reduce(
      (sum, s) => sum + s.duration,
      0
    );
  }, [appointment]);

  /* ---- Fetch slots when date changes ---- */
  useEffect(() => {
    if (!selectedDate || !appointment || totalDuration === 0) {
      setSlots([]);
      setSelectedSlot(null);
      return;
    }

    setSlotsLoading(true);
    setSlots([]);
    setSelectedSlot(null);

    api
      .get<AvailabilitySlot[]>(
        `/booking/appointments/availability?professionalId=${appointment.professionalId}&date=${selectedDate}&duration=${totalDuration}`
      )
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, appointment, totalDuration]);

  /* ---- Min date (today) ---- */
  const today = new Date().toISOString().split("T")[0];

  /* ---- Submit reschedule ---- */
  const handleConfirm = async () => {
    if (!appointment || !selectedDate || !selectedSlot) return;
    setSubmitting(true);
    setError(null);

    try {
      await api.patch(`/booking/appointments/${appointment.id}/reschedule`, {
        date: selectedDate,
        startTime: selectedSlot,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error al reagendar la cita";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ---- Render ---- */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Cargando cita...</p>
      </div>
    );
  }

  if (!appointment && error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
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

  /* ---- Success state ---- */
  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <CheckCircle className="mb-4 h-16 w-16 text-emerald-500" />
        <h2 className="text-xl font-bold">Cita reagendada</h2>
        <p className="text-muted-foreground mt-2">
          Tu cita ha sido reagendada exitosamente
        </p>
        <div className="mt-6 flex gap-3">
          <Link href={`/dashboard/client/appointments/${appointment.id}`}>
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Ver detalle
            </Button>
          </Link>
          <Link href="/dashboard/client/appointments">
            <Button className="gap-2">Mis citas</Button>
          </Link>
        </div>
      </div>
    );
  }

  const availableSlots = slots.filter((s) => s.available);

  return (
    <div>
      {/* Back link */}
      <Link
        href={`/dashboard/client/appointments/${id}`}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al detalle de la cita
      </Link>

      <h1 className="mb-6 text-2xl font-bold">Reagendar cita</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: current appointment summary */}
        <div className="lg:col-span-1">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Scissors className="h-4 w-4" />
                Cita actual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-muted/50 space-y-2 rounded-lg px-4 py-3">
                {appointment.appointmentServices.map((svc, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{svc.serviceName}</span>
                    <span className="font-medium">
                      {formatCurrency(parseFloat(svc.price))}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2 text-sm font-semibold">
                  <span>Total</span>
                  <span>
                    {formatCurrency(parseFloat(appointment.totalAmount))}
                  </span>
                </div>
              </div>
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(appointment.date)}</span>
              </div>
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                <span>
                  {formatTime(appointment.startTime)} -{" "}
                  {formatTime(appointment.endTime)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: reschedule form */}
        <div className="space-y-4 lg:col-span-2">
          {/* Date picker */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4" />
                Selecciona una nueva fecha
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-xs">
                <Label htmlFor="reschedule-date">Fecha</Label>
                <Input
                  id="reschedule-date"
                  type="date"
                  min={today}
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>

          {/* Time slots */}
          {selectedDate && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4" />
                  Horarios disponibles para el {formatDate(selectedDate)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {slotsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                    <span className="text-muted-foreground ml-2 text-sm">
                      Buscando disponibilidad...
                    </span>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center">
                    <Clock className="mx-auto mb-2 h-10 w-10 opacity-20" />
                    <p>No hay horarios disponibles para esta fecha</p>
                    <p className="mt-1 text-sm">Intenta con otra fecha</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.startTime}
                        onClick={() => setSelectedSlot(slot.startTime)}
                        className={cn(
                          "rounded-lg border-2 px-3 py-3 text-center text-sm font-medium transition-all",
                          selectedSlot === slot.startTime
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-muted bg-background hover:border-primary/40 hover:bg-muted/50"
                        )}
                      >
                        {formatTime(slot.startTime)}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Confirm button */}
          {selectedDate && selectedSlot && (
            <div className="flex justify-end gap-3">
              <Link href={`/dashboard/client/appointments/${id}`}>
                <Button variant="outline">Cancelar</Button>
              </Link>
              <Button
                onClick={handleConfirm}
                disabled={submitting}
                className="gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Confirmar reagendamiento
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
