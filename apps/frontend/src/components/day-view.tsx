"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  finExtendido,
  repartoPorProfesional,
  timeToMinutes,
} from "@beautyspot/shared-utils";
import {
  desplazarDia,
  formatCurrency,
  formatTime,
  haComenzado,
  toLocalDateKey,
} from "@/lib/utils";
import { getAppointmentStatus } from "@/lib/status";
import { franjaDeHoras } from "@/lib/franja-horaria";
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
  /** Bloqueos del día de todo el equipo, para pintarlos sobre la rejilla. */
  bloqueos?: BloqueoDeAgenda[];
  /** Dias de la semana (0 domingo … 6 sabado) en los que el negocio abre. */
  diasAbiertos?: number[];
  /** Bloquear desde un hueco; sin este prop la rejilla no es pulsable. */
  onBloquearHueco?: (professionalId: string, hora: string) => void;
}

/** Franja bloqueada de la agenda de un profesional. */
export interface BloqueoDeAgenda {
  id: string;
  professionalId: string;
  startTime: string;
  endTime: string;
  reason: string | null;
}

/** Estados desde los que la cita todavia puede anularse. */
const ANULABLES = ["PENDING", "CONFIRMED"];

/** Minutos en que se parte cada hora al pulsar un hueco. */
const MEDIAS_HORAS = ["00", "30"];

const ALTO_HORA = 64;

/** Pixeles desde el borde superior de la rejilla que corresponden a una hora. */
function aPixeles(hora: string, horaInicio: number): number {
  return ((timeToMinutes(hora) - horaInicio * 60) / 60) * ALTO_HORA;
}

/** Nombre del profesional, o un texto neutro si ya no está en el equipo. */
function nombreDeProfesional(
  professionals: Professional[],
  id: string
): string {
  return professionals.find((p) => p.id === id)?.name ?? "otro profesional";
}

/** Bloque de una cita en la columna de un profesional, en horas de pared. */
interface BloqueDeCita {
  appt: Appointment;
  professionalId: string;
  /** Desde el inicio hasta el fin de la ocupacion, limpieza incluida. */
  inicio: string;
  fin: string;
  /** Tramos en que el profesional queda ocupado dentro del bloque. */
  ocupados: { inicio: string; fin: string }[];
  /** Fin de la parte con cliente delante; por debajo va la limpieza. */
  finDeCliente: string;
  /** La cita se reparte entre varios profesionales. */
  compartida: boolean;
}

/** Un bloque con el sitio que le toca cuando comparte franja con otros. */
export interface BloqueRepartido {
  bloque: BloqueDeCita;
  /** Columna que ocupa dentro de su grupo de solape, empezando en cero. */
  columna: number;
  /** Columnas en que se parte el grupo al que pertenece. */
  columnas: number;
}

/**
 * Reparte el ancho de la columna entre las citas que se solapan, para que la
 * segunda no tape el nombre de la primera. Cada grupo encadenado por solape se
 * parte en columnas, y cada cita entra en la primera libre a su hora.
 */
export function repartirSolapes(bloques: BloqueDeCita[]): BloqueRepartido[] {
  const ordenados = [...bloques].sort(
    (a, b) => timeToMinutes(a.inicio) - timeToMinutes(b.inicio)
  );

  const repartidos: BloqueRepartido[] = [];
  let grupo: BloqueRepartido[] = [];
  // Fin de cada columna del grupo en curso, para saber cual ha quedado libre.
  let finDeColumna: number[] = [];
  let finDelGrupo = -1;

  const cerrarGrupo = () => {
    for (const entrada of grupo) entrada.columnas = finDeColumna.length;
    repartidos.push(...grupo);
    grupo = [];
    finDeColumna = [];
    finDelGrupo = -1;
  };

  for (const bloque of ordenados) {
    const inicio = timeToMinutes(bloque.inicio);
    const fin = timeToMinutes(bloque.fin);

    // Nada de lo que hay en el grupo llega hasta aqui: empieza uno nuevo.
    if (inicio >= finDelGrupo) cerrarGrupo();

    const columna = finDeColumna.findIndex((libre) => libre <= inicio);
    const elegida = columna === -1 ? finDeColumna.length : columna;
    finDeColumna[elegida] = fin;
    finDelGrupo = Math.max(finDelGrupo, fin);
    grupo.push({ bloque, columna: elegida, columnas: finDeColumna.length });
  }
  cerrarGrupo();

  return repartidos;
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
  // Devuelve el fin a la escala del reparto: llega en hora de reloj y la cita
  // de las 23:30 termina a las "00:30".
  const reparto = repartoPorProfesional(
    appt.startTime,
    finExtendido(appt.startTime, appt.ocupadoHasta ?? appt.endTime),
    lineasDe(appt),
    appt.professionalId
  );

  return reparto.map((ocupacion) => ({
    appt,
    professionalId: ocupacion.professionalId,
    inicio: ocupacion.inicio,
    fin: ocupacion.fin,
    ocupados: ocupacion.intervalos,
    finDeCliente: ocupacion.finDeCliente,
    compartida: reparto.length > 1,
  }));
}

/**
 * Vista de un dia con una columna por profesional. Cada cita se posiciona por
 * minutos y se pinta partida en los tramos que ocupan al profesional.
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
  bloqueos = [],
  diasAbiertos,
  onBloquearHueco,
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

  // Las citas que comparten franja se reparten el ancho de la columna en vez
  // de taparse.
  const repartoPorColumna = useMemo(() => {
    const mapa = new Map<string, BloqueRepartido[]>();
    for (const [professionalId, bloques] of bloquesPorProfesional) {
      mapa.set(professionalId, repartirSolapes(bloques));
    }
    return mapa;
  }, [bloquesPorProfesional]);

  const bloqueosPorProfesional = useMemo(() => {
    const mapa = new Map<string, BloqueoDeAgenda[]>();
    for (const bloqueo of bloqueos) {
      const actuales = mapa.get(bloqueo.professionalId) ?? [];
      actuales.push(bloqueo);
      mapa.set(bloqueo.professionalId, actuales);
    }
    return mapa;
  }, [bloqueos]);

  const horas = useMemo(
    () =>
      franjaDeHoras([
        ...Array.from(bloquesPorProfesional.values())
          .flat()
          .map((b) => ({ inicio: b.inicio, fin: b.fin })),
        ...bloqueos.map((b) => ({ inicio: b.startTime, fin: b.endTime })),
      ]),
    [bloquesPorProfesional, bloqueos]
  );
  const horaInicio = horas[0];

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
  // Sin horario cargado no se afirma que el negocio este cerrado.
  const cerrado = diasAbiertos
    ? !diasAbiertos.includes(new Date(`${date}T12:00:00`).getDay())
    : false;
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
        <span className="ml-2 text-sm font-medium first-letter:uppercase">
          {etiqueta}
        </span>
        {/* El negocio cerrado se dibujaba con la rejilla de cualquier otro dia,
            sin decir en ninguna parte que ese dia no se abre. */}
        {cerrado && (
          <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs font-medium">
            Cerrado
          </span>
        )}
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
              {horas.map((hora) => (
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
                style={{ height: horas.length * ALTO_HORA }}
              >
                {horas.map((hora) => (
                  <div
                    key={hora}
                    className="border-border/50 flex flex-col border-b"
                    style={{ height: ALTO_HORA }}
                  >
                    {MEDIAS_HORAS.map((minuto) => {
                      const inicio = `${String(hora).padStart(2, "0")}:${minuto}`;
                      if (!onBloquearHueco) {
                        return <div key={minuto} className="flex-1" />;
                      }
                      return (
                        <button
                          key={minuto}
                          type="button"
                          onClick={() => onBloquearHueco(p.id, inicio)}
                          className="hover:bg-muted/60 flex-1 transition-colors"
                          aria-label={`Bloquear ${formatTime(inicio)} de ${p.name ?? "el profesional"}`}
                        />
                      );
                    })}
                  </div>
                ))}

                {(bloqueosPorProfesional.get(p.id) ?? []).map((bloqueo) => (
                  <BloqueoPintado
                    key={bloqueo.id}
                    bloqueo={bloqueo}
                    horaInicio={horaInicio}
                  />
                ))}

                {(repartoPorColumna.get(p.id) ?? []).map((reparto) => (
                  <BloqueCita
                    key={`${reparto.bloque.appt.id}-${reparto.bloque.professionalId}`}
                    bloque={reparto.bloque}
                    columna={reparto.columna}
                    columnas={reparto.columnas}
                    horaInicio={horaInicio}
                    seleccionada={selectedId === reparto.bloque.appt.id}
                    cliente={
                      clientNames[reparto.bloque.appt.clientId] || "Cliente"
                    }
                    onSelect={() =>
                      setSelectedId(
                        selectedId === reparto.bloque.appt.id
                          ? null
                          : reparto.bloque.appt.id
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

/** Franja bloqueada, rayada y pintada por debajo de las citas. */
function BloqueoPintado({
  bloqueo,
  horaInicio,
}: {
  bloqueo: BloqueoDeAgenda;
  horaInicio: number;
}) {
  const arriba = aPixeles(bloqueo.startTime, horaInicio);
  const alto = Math.max(aPixeles(bloqueo.endTime, horaInicio) - arriba, 12);

  return (
    <div
      className="bg-muted-foreground/20 border-muted-foreground/40 absolute inset-x-0.5 overflow-hidden rounded border border-dashed px-1.5 py-0.5"
      style={{ top: arriba, height: alto }}
      title={bloqueo.reason ?? "Agenda bloqueada"}
    >
      <span className="text-muted-foreground block truncate text-xs leading-tight">
        {bloqueo.reason || "Bloqueado"}
      </span>
    </div>
  );
}

/** Cita en la columna: el contorno abarca su duración y dentro van los tramos ocupados. */
function BloqueCita({
  bloque,
  columna,
  columnas,
  horaInicio,
  seleccionada,
  cliente,
  onSelect,
}: {
  bloque: BloqueDeCita;
  columna: number;
  columnas: number;
  horaInicio: number;
  seleccionada: boolean;
  cliente: string;
  onSelect: () => void;
}) {
  const { appt, compartida } = bloque;
  const color = getAppointmentStatus(appt.status).calendarColor;
  const hayHueco = bloque.ocupados.length > 1;

  const arriba = aPixeles(bloque.inicio, horaInicio);
  const alto = Math.max(aPixeles(bloque.fin, horaInicio) - arriba, 18);
  const finDeCliente = aPixeles(bloque.finDeCliente, horaInicio) - arriba;
  const ocupados = bloque.ocupados.map((tramo) => ({
    arriba: aPixeles(tramo.inicio, horaInicio) - arriba,
    alto: Math.max(
      aPixeles(tramo.fin, horaInicio) - aPixeles(tramo.inicio, horaInicio),
      2
    ),
  }));

  // Sola ocupa la columna entera; compartiendo franja, la parte que le toca.
  const ancho = 100 / columnas;

  return (
    <button
      onClick={onSelect}
      aria-pressed={seleccionada}
      className={`absolute rounded border border-dashed text-left ${seleccionada ? "ring-primary z-10 ring-2" : ""}`}
      style={{
        top: arriba,
        height: alto,
        left: `calc(${columna * ancho}% + 2px)`,
        width: `calc(${ancho}% - 4px)`,
      }}
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
      <span className="relative block px-1.5 py-0.5 text-xs leading-tight">
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
