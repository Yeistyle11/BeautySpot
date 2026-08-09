"use client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  formatCurrency,
  formatTime,
  haComenzado,
  toLocalDateKey,
} from "@/lib/utils";
import { getAppointmentStatus } from "@/lib/status";
import type { Appointment } from "@/app/dashboard/appointments/schemas";

interface CalendarViewProps {
  appointments: Appointment[];
  onComplete: (appt: Appointment) => void;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onNoShow: (id: string) => void;
  canConfirm: boolean;
  canCancel: boolean;
  /** Nombre de cada cliente por id; las citas solo traen el identificador. */
  clientNames: Record<string, string>;
}

/** Estados desde los que la cita todavia puede anularse. */
const ANULABLES = ["PENDING", "CONFIRMED"];

const HOURS = Array.from({ length: 12 }, (_, i) => i + 7); // 7:00 - 18:00
const DAYS_ES = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

// Los 7 dias de la semana (lunes a domingo) que contiene la fecha dada.
// getDay() devuelve 0 para domingo, que aqui cierra la semana en vez de abrirla.
function getWeekDates(referenceDate: Date): Date[] {
  const day = referenceDate.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });
}

/**
 * Vista semanal de la agenda: distribuye las citas en una rejilla de días (lun-dom)
 * por franja horaria, permite navegar entre semanas y, al seleccionar una cita,
 * muestra su detalle con las acciones de confirmar, completar o cancelar según permisos.
 */
export function CalendarView({
  appointments,
  onComplete,
  onConfirm,
  onCancel,
  onNoShow,
  canConfirm,
  canCancel,
  clientNames,
}: CalendarViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  // Se guarda el id y no la cita: el detalle tiene que reflejar el estado que
  // acaba de revalidar SWR, no la copia que habia al hacer clic.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedAppt = appointments.find((a) => a.id === selectedId) ?? null;

  // La semana visible depende solo del offset; se recalcula al navegar, no en
  // cada render (antes la referencia era un `new Date()` nuevo cada vez).
  const weekDates = useMemo(() => {
    const reference = new Date();
    reference.setDate(reference.getDate() + weekOffset * 7);
    return getWeekDates(reference);
  }, [weekOffset]);

  const todayKey = toLocalDateKey(new Date());

  // Indice por dia y hora de inicio: la rejilla son 84 celdas y sin el cada una
  // recorreria la lista entera de citas.
  const appointmentsByHour = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach((a) => {
      const hora = parseInt(a.startTime.split(":")[0]);
      const clave = `${a.date}-${hora}`;
      if (!map[clave]) map[clave] = [];
      map[clave].push(a);
    });
    return map;
  }, [appointments]);

  const prevWeek = () => setWeekOffset((p) => p - 1);
  const nextWeek = () => setWeekOffset((p) => p + 1);
  const thisWeek = () => setWeekOffset(0);

  const isCurrentWeek = weekOffset === 0;
  const weekLabel = `${weekDates[0].toLocaleDateString("es-CO", { day: "numeric", month: "short" })} - ${weekDates[6].toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={prevWeek}
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {!isCurrentWeek && (
            <Button variant="ghost" size="sm" onClick={thisWeek}>
              Hoy
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={nextWeek}
            aria-label="Semana siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium">{weekLabel}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
            <div className="text-muted-foreground p-2 text-center text-xs">
              Hora
            </div>
            {weekDates.map((d, i) => {
              const isToday = toLocalDateKey(d) === todayKey;
              return (
                <div
                  key={i}
                  className={`p-2 text-center ${isToday ? "bg-primary/5" : ""}`}
                >
                  <p className="text-muted-foreground text-xs">{DAYS_ES[i]}</p>
                  <p
                    className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}
                  >
                    {d.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {HOURS.map((hour) => (
            <div
              key={hour}
              className="border-border/50 grid grid-cols-[60px_repeat(7,1fr)] border-b"
            >
              <div className="text-muted-foreground p-1 text-center text-xs">
                {formatTime(`${String(hour).padStart(2, "0")}:00`)}
              </div>
              {weekDates.map((d, dayIdx) => {
                const hourAppts =
                  appointmentsByHour[`${toLocalDateKey(d)}-${hour}`] || [];

                return (
                  <div key={dayIdx} className="relative min-h-[48px] p-0.5">
                    {hourAppts.map((appt) => {
                      const colorClass = getAppointmentStatus(
                        appt.status
                      ).calendarColor;
                      return (
                        <button
                          key={appt.id}
                          onClick={() =>
                            setSelectedId(
                              selectedId === appt.id ? null : appt.id
                            )
                          }
                          aria-pressed={selectedId === appt.id}
                          className={`w-full cursor-pointer rounded border px-1.5 py-0.5 text-left text-[10px] ${colorClass} ${selectedId === appt.id ? "ring-primary ring-2" : ""}`}
                        >
                          <p className="truncate font-medium">
                            {clientNames[appt.clientId] || "Cliente"}
                          </p>
                          <p className="truncate opacity-70">
                            {formatTime(appt.startTime)} ·{" "}
                            {appt.appointmentServices[0]?.serviceName ||
                              "Servicio"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selectedAppt && (
        <div className="bg-muted/30 mt-4 rounded-lg border p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold">
                {clientNames[selectedAppt.clientId] || "Cliente"}
              </h4>
              <p className="text-muted-foreground text-sm">
                {selectedAppt.appointmentServices
                  .map((s) => s.serviceName)
                  .join(", ")}
              </p>
              <div className="text-muted-foreground mt-1 flex items-center gap-3 text-sm">
                <span>
                  {formatTime(selectedAppt.startTime)} -{" "}
                  {formatTime(selectedAppt.endTime)}
                </span>
                <span className="font-medium">
                  {formatCurrency(selectedAppt.totalAmount)}
                </span>
              </div>
              <Badge
                className="mt-2"
                variant={getAppointmentStatus(selectedAppt.status).variant}
              >
                {getAppointmentStatus(selectedAppt.status).label}
              </Badge>
            </div>
            <div className="flex gap-2">
              {selectedAppt.status === "PENDING" && canConfirm && (
                <Button size="sm" onClick={() => onConfirm(selectedAppt.id)}>
                  Confirmar
                </Button>
              )}
              {selectedAppt.status === "CONFIRMED" &&
                canConfirm &&
                haComenzado(selectedAppt.date, selectedAppt.startTime) && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onComplete(selectedAppt)}
                    >
                      Completar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onNoShow(selectedAppt.id)}
                    >
                      No asistio
                    </Button>
                  </>
                )}
              {ANULABLES.includes(selectedAppt.status) && canCancel && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onCancel(selectedAppt.id)}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
