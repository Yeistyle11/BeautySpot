"use client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { timeToMinutes } from "@beautyspot/shared-utils";
import { franjaDeHoras, type HorarioDelNegocio } from "@/lib/franja-horaria";
import {
  desplazarDia,
  fechasDeLaSemana,
  formatCurrency,
  formatTime,
  haComenzado,
  toLocalDateKey,
} from "@/lib/utils";
import { getAppointmentStatus } from "@/lib/status";
import type { Appointment } from "@/app/dashboard/appointments/schemas";
import type { BloqueoDeAgenda } from "@/components/day-view";

/** Bloqueo tal como llega a la semana: con el dia al que pertenece. */
export type BloqueoDeLaSemana = BloqueoDeAgenda & { date: string };

interface CalendarViewProps {
  appointments: Appointment[];
  /** Dia abierto en la pagina; se pinta la semana que lo contiene. */
  date: string;
  onDateChange: (date: string) => void;
  onComplete: (appt: Appointment) => void;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onNoShow: (id: string) => void;
  canConfirm: boolean;
  canCancel: boolean;
  /** Nombre de cada cliente por id; las citas solo traen el identificador. */
  clientNames: Record<string, string>;
  /** Bloqueos de la semana, para pintarlos sobre la rejilla. */
  bloqueos?: BloqueoDeLaSemana[];
  /** Nombre de cada profesional por id, para decir de quien es el bloqueo. */
  nombresDeProfesional?: Record<string, string>;
  /** Dias de la semana (0 domingo … 6 sabado) en los que el negocio abre. */
  diasAbiertos?: number[];
  /** Horario del negocio, para que la rejilla llegue hasta donde se atiende. */
  horarios?: HorarioDelNegocio[];
}

/** Estados desde los que la cita todavia puede anularse. */
const ANULABLES = ["PENDING", "CONFIRMED"];

const DAYS_ES = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

/**
 * Un dia sin horario de apertura. Sin `diasAbiertos` —el horario aun no ha
 * cargado— no se afirma que el negocio este cerrado.
 */
function esCerrado(fecha: string, diasAbiertos?: number[]): boolean {
  if (!diasAbiertos) return false;
  return !diasAbiertos.includes(new Date(`${fecha}T12:00:00`).getDay());
}

/**
 * Vista semanal de la agenda: reparte las citas por dia y franja horaria, y
 * abre el detalle de la elegida con sus acciones.
 */
export function CalendarView({
  appointments,
  date,
  onDateChange,
  onComplete,
  onConfirm,
  onCancel,
  onNoShow,
  canConfirm,
  canCancel,
  clientNames,
  bloqueos = [],
  nombresDeProfesional = {},
  diasAbiertos,
  horarios,
}: CalendarViewProps) {
  // Se guarda el id y no la cita: el detalle tiene que reflejar el estado que
  // acaba de revalidar SWR, no la copia que habia al hacer clic.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedAppt = appointments.find((a) => a.id === selectedId) ?? null;

  // La semana sale del dia que la pagina tiene abierto y no de un contador
  // propio: con el suyo, cambiar de vista perdia el dia que se estaba mirando.
  const weekDates = useMemo(() => fechasDeLaSemana(date), [date]);

  const todayKey = toLocalDateKey(new Date());

  // La rejilla se estira hasta donde haya algo que pintar. Con una franja fija
  // de 7 a 18, un negocio nocturno veia la semana entera vacia —con aspecto de
  // disponible— aunque el dato llegara: no habia fila donde dibujarlo.
  const horas = useMemo(
    () =>
      franjaDeHoras(
        [
          ...appointments.map((a) => ({
            inicio: a.startTime,
            fin: a.endTime,
          })),
          ...bloqueos.map((b) => ({ inicio: b.startTime, fin: b.endTime })),
        ],
        horarios
      ),
    [appointments, bloqueos, horarios]
  );

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

  // Bloqueos por dia y hora: uno de 14:00 a 16:00 sale en las dos franjas.
  const bloqueosPorHora = useMemo(() => {
    const mapa: Record<string, BloqueoDeLaSemana[]> = {};
    for (const bloqueo of bloqueos) {
      const desde = Math.floor(timeToMinutes(bloqueo.startTime) / 60);
      const hasta = Math.ceil(timeToMinutes(bloqueo.endTime) / 60);
      for (let hora = desde; hora < hasta; hora++) {
        const clave = `${bloqueo.date}-${hora}`;
        (mapa[clave] ??= []).push(bloqueo);
      }
    }
    return mapa;
  }, [bloqueos]);

  const prevWeek = () => onDateChange(desplazarDia(date, -7));
  const nextWeek = () => onDateChange(desplazarDia(date, 7));
  const thisWeek = () => onDateChange(todayKey);

  const isCurrentWeek = weekDates.includes(todayKey);
  const comoDia = (fecha: string, opciones: Intl.DateTimeFormatOptions) =>
    new Date(`${fecha}T12:00:00`).toLocaleDateString("es-CO", opciones);
  const weekLabel = `${comoDia(weekDates[0], { day: "numeric", month: "short" })} - ${comoDia(weekDates[6], { day: "numeric", month: "short", year: "numeric" })}`;

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
              const isToday = d === todayKey;
              return (
                <div
                  key={d}
                  className={`p-2 text-center ${isToday ? "bg-primary/5" : ""}`}
                >
                  <p className="text-muted-foreground text-xs">{DAYS_ES[i]}</p>
                  <p
                    className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}
                  >
                    {Number(d.slice(8))}
                  </p>
                  {esCerrado(d, diasAbiertos) && (
                    <p className="text-muted-foreground text-[10px] uppercase">
                      Cerrado
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {horas.map((hour) => (
            <div
              key={hour}
              className="border-border/50 grid grid-cols-[60px_repeat(7,1fr)] border-b"
            >
              <div className="text-muted-foreground p-1 text-center text-xs">
                {formatTime(`${String(hour).padStart(2, "0")}:00`)}
              </div>
              {weekDates.map((d) => {
                const hourAppts = appointmentsByHour[`${d}-${hour}`] || [];
                const hourBloqueos = bloqueosPorHora[`${d}-${hour}`] ?? [];

                return (
                  <div
                    key={d}
                    className={`relative min-h-[48px] p-0.5 ${
                      esCerrado(d, diasAbiertos) ? "bg-muted/40" : ""
                    }`}
                  >
                    {/* Los bloqueos van antes que las citas: la tarde de quien
                        esta de vacaciones se veia libre justo en la pantalla
                        con la que se responde al telefono. */}
                    {hourBloqueos.map((bloqueo) => (
                      <p
                        key={bloqueo.id}
                        className="text-muted-foreground bg-muted-foreground/20 border-muted-foreground/40 mb-0.5 truncate rounded border border-dashed px-1.5 py-0.5 text-xs"
                        title={`${bloqueo.reason || "Agenda bloqueada"} · ${
                          nombresDeProfesional[bloqueo.professionalId] ??
                          "profesional"
                        } · ${formatTime(bloqueo.startTime)} - ${formatTime(
                          bloqueo.endTime
                        )}`}
                      >
                        {bloqueo.reason || "Bloqueado"}
                      </p>
                    ))}
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
                          className={`w-full cursor-pointer rounded border px-1.5 py-0.5 text-left text-xs ${colorClass} ${selectedId === appt.id ? "ring-primary ring-2" : ""}`}
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
                      No asistió
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
