"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { repartoPorProfesional, timeToMinutes } from "@beautyspot/shared-utils";
import {
  formatCurrency,
  formatTime,
  haComenzado,
  toLocalDateKey,
} from "@/lib/utils";
import { getAppointmentStatus } from "@/lib/status";
import type {
  Appointment,
  Professional,
} from "@/app/dashboard/appointments/schemas";

interface DayViewProps {
  appointments: Appointment[];
  professionals: Professional[];
  /** Dia visible, en formato `YYYY-MM-DD`. */
  date: string;
  onDateChange: (date: string) => void;
  onComplete: (appt: Appointment) => void;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
  onNoShow: (id: string) => void;
  canConfirm: boolean;
  canCancel: boolean;
  clientNames: Record<string, string>;
}

/** Estados desde los que la cita todavia puede anularse. */
const ANULABLES = ["PENDING", "CONFIRMED"];

/** Franja de jornada que se pinta, y altura de cada hora en pixeles. */
const HORA_INICIO = 7;
const HORA_FIN = 21;
const ALTO_HORA = 64;

const HORAS = Array.from(
  { length: HORA_FIN - HORA_INICIO },
  (_, i) => i + HORA_INICIO
);

/** Pixeles desde el borde superior de la rejilla que corresponden a una hora. */
function aPixeles(hora: string): number {
  return ((timeToMinutes(hora) - HORA_INICIO * 60) / 60) * ALTO_HORA;
}

/** Nombre del profesional, o un texto neutro si ya no está en el equipo. */
function nombreDeProfesional(
  professionals: Professional[],
  id: string
): string {
  return professionals.find((p) => p.id === id)?.name ?? "otro profesional";
}

/** Suma un dia a una fecha `YYYY-MM-DD`. */
function desplazarDia(date: string, dias: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + dias);
  return toLocalDateKey(d);
}

/** Bloque de una cita en la columna, con sus tramos ocupados ya calculados. */
interface BloqueDeCita {
  appt: Appointment;
  professionalId: string;
  /** Desde el inicio hasta el fin de la ocupacion, limpieza incluida. */
  arriba: number;
  alto: number;
  /** Tramos ocupados, relativos al bloque. */
  ocupados: { arriba: number; alto: number }[];
  /** Fin de la parte con cliente delante; por debajo va la limpieza. */
  finDeCliente: number;
  /** La cita se reparte entre varios profesionales. */
  compartida: boolean;
}

/** Lineas de la cita en la forma que entiende el reparto de agenda. */
function lineasDe(appt: Appointment) {
  return appt.appointmentServices.map((s, i) => ({
    duration: s.duration,
    orden: s.orden ?? i,
    procesadoDesde: s.procesadoDesde,
    procesadoMinutos: s.procesadoMinutos,
    bufferDespues: s.bufferDespues,
    professionalId: s.professionalId,
  }));
}

/** Un bloque por profesional: cada uno ocupa solo los servicios que atiende. */
function bloquesDe(appt: Appointment): BloqueDeCita[] {
  const reparto = repartoPorProfesional(
    appt.startTime,
    appt.ocupadoHasta ?? appt.endTime,
    lineasDe(appt),
    appt.professionalId
  );

  return reparto.map((ocupacion) => {
    const arriba = aPixeles(ocupacion.inicio);
    return {
      appt,
      professionalId: ocupacion.professionalId,
      arriba,
      alto: Math.max(aPixeles(ocupacion.fin) - arriba, 18),
      ocupados: ocupacion.intervalos.map((i) => ({
        arriba: aPixeles(i.inicio) - arriba,
        alto: Math.max(aPixeles(i.fin) - aPixeles(i.inicio), 2),
      })),
      finDeCliente: aPixeles(ocupacion.finDeCliente) - arriba,
      compartida: reparto.length > 1,
    };
  });
}

/**
 * Vista de un dia con una columna por profesional. Cada cita se posiciona por
 * minutos y se pinta partida en los tramos que ocupan al profesional: el hueco
 * del procesado queda transparente y la limpieza se marca aparte.
 */
export function DayView({
  appointments,
  professionals,
  date,
  onDateChange,
  onComplete,
  onConfirm,
  onCancel,
  onNoShow,
  canConfirm,
  canCancel,
  clientNames,
}: DayViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedAppt = appointments.find((a) => a.id === selectedId) ?? null;

  const delDia = useMemo(
    () => appointments.filter((a) => a.date === date),
    [appointments, date]
  );

  const bloquesPorProfesional = useMemo(() => {
    const mapa = new Map<string, BloqueDeCita[]>();
    for (const appt of delDia) {
      for (const bloque of bloquesDe(appt)) {
        const actuales = mapa.get(bloque.professionalId) ?? [];
        actuales.push(bloque);
        mapa.set(bloque.professionalId, actuales);
      }
    }
    return mapa;
  }, [delDia]);

  // Columnas: el equipo, más una para las citas de quien ya no está en la lista.
  const columnas = useMemo(() => {
    const delEquipo = professionals.filter((p) => p.id);
    const huerfanos = Array.from(bloquesPorProfesional.keys()).filter(
      (id) => !delEquipo.some((p) => p.id === id)
    );
    return [
      ...delEquipo,
      ...huerfanos.map((id) => ({ id, name: "Sin asignar" })),
    ];
  }, [bloquesPorProfesional, professionals]);

  const esHoy = date === toLocalDateKey(new Date());
  const etiqueta = new Date(date + "T12:00:00").toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onDateChange(desplazarDia(date, -1))}
          aria-label="Día anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {!esHoy && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDateChange(toLocalDateKey(new Date()))}
          >
            Hoy
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={() => onDateChange(desplazarDia(date, 1))}
          aria-label="Día siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="ml-2 text-sm font-medium capitalize">{etiqueta}</span>
      </div>

      {columnas.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">
          No hay profesionales dados de alta.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[640px]"
            style={{
              gridTemplateColumns: `64px repeat(${columnas.length}, minmax(140px, 1fr))`,
            }}
          >
            <div className="border-b" />
            {columnas.map((p) => (
              <div
                key={p.id}
                className="truncate border-b p-2 text-center text-sm font-semibold"
              >
                {p.name ?? "Profesional"}
              </div>
            ))}

            <div>
              {HORAS.map((hora) => (
                <div
                  key={hora}
                  className="text-muted-foreground border-border/50 border-b pr-2 text-right text-xs"
                  style={{ height: ALTO_HORA }}
                >
                  {formatTime(`${String(hora).padStart(2, "0")}:00`)}
                </div>
              ))}
            </div>

            {columnas.map((p) => (
              <div
                key={p.id}
                className="relative border-l"
                style={{ height: HORAS.length * ALTO_HORA }}
              >
                {HORAS.map((hora) => (
                  <div
                    key={hora}
                    className="border-border/50 border-b"
                    style={{ height: ALTO_HORA }}
                  />
                ))}

                {(bloquesPorProfesional.get(p.id) ?? []).map((bloque) => (
                  <BloqueCita
                    key={`${bloque.appt.id}-${bloque.professionalId}`}
                    bloque={bloque}
                    seleccionada={selectedId === bloque.appt.id}
                    cliente={clientNames[bloque.appt.clientId] || "Cliente"}
                    onSelect={() =>
                      setSelectedId(
                        selectedId === bloque.appt.id ? null : bloque.appt.id
                      )
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-muted-foreground mt-3 flex flex-wrap items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="border-border h-3 w-3 rounded-sm border border-dashed" />
          Hueco de procesado: el profesional puede atender a otra clienta
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-muted-foreground/30 h-3 w-3 rounded-sm" />
          Limpieza
        </span>
        <span>
          Una cita con servicios encadenados aparece en la columna de cada
          profesional que la atiende
        </span>
      </p>

      {selectedAppt && (
        <div className="bg-muted/30 mt-4 rounded-lg border p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold">
                {clientNames[selectedAppt.clientId] || "Cliente"}
              </h4>
              <p className="text-muted-foreground text-sm">
                {selectedAppt.appointmentServices
                  .map((s) =>
                    s.professionalId &&
                    s.professionalId !== selectedAppt.professionalId
                      ? `${s.serviceName} (${nombreDeProfesional(professionals, s.professionalId)})`
                      : s.serviceName
                  )
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

/** Cita en la columna: el contorno abarca su duración y dentro van los tramos ocupados. */
function BloqueCita({
  bloque,
  seleccionada,
  cliente,
  onSelect,
}: {
  bloque: BloqueDeCita;
  seleccionada: boolean;
  cliente: string;
  onSelect: () => void;
}) {
  const { appt, arriba, alto, ocupados, finDeCliente, compartida } = bloque;
  const color = getAppointmentStatus(appt.status).calendarColor;
  const hayHueco = ocupados.length > 1;

  return (
    <button
      onClick={onSelect}
      aria-pressed={seleccionada}
      className={`absolute inset-x-0.5 rounded border border-dashed text-left ${seleccionada ? "ring-primary z-10 ring-2" : ""}`}
      style={{ top: arriba, height: alto }}
    >
      {ocupados.map((tramo, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`absolute inset-x-0 rounded-sm border ${color} ${
            tramo.arriba >= finDeCliente ? "opacity-40" : ""
          }`}
          style={{ top: tramo.arriba, height: tramo.alto }}
        />
      ))}
      <span className="relative block px-1.5 py-0.5 text-[10px] leading-tight">
        <span className="block truncate font-medium">{cliente}</span>
        <span className="block truncate opacity-70">
          {formatTime(appt.startTime)} ·{" "}
          {appt.appointmentServices[0]?.serviceName || "Servicio"}
        </span>
      </span>
      {hayHueco && <span className="sr-only">Con hueco de procesado</span>}
      {compartida && (
        <span className="sr-only">
          Cita repartida entre varios profesionales
        </span>
      )}
    </button>
  );
}
