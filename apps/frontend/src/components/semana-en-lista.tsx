"use client";

// La semana en movil: un apartado por dia con sus citas y bloqueos en orden.
import { timeToMinutes } from "@beautyspot/shared-utils";
import { cn, esDiaCerrado, formatTime } from "@/lib/utils";
import { getAppointmentStatus } from "@/lib/status";
import type { Appointment } from "@/app/dashboard/appointments/schemas";
import type { BloqueoDeLaSemana } from "@/components/calendar-view";

interface SemanaEnListaProps {
  /** Los siete dias, `YYYY-MM-DD`, de lunes a domingo. */
  dias: string[];
  hoy: string;
  appointments: Appointment[];
  bloqueos: BloqueoDeLaSemana[];
  clientNames: Record<string, string>;
  nombresDeProfesional: Record<string, string>;
  diasAbiertos?: number[];
  seleccionadaId: string | null;
  onSeleccionar: (id: string) => void;
  /** Ficha de la cita elegida; se abre justo debajo de ella. */
  detalle: React.ReactNode;
}

/** Hora de un elemento de la lista, para ordenar citas y bloqueos juntos. */
type Entrada =
  | { tipo: "cita"; minuto: number; cita: Appointment }
  | { tipo: "bloqueo"; minuto: number; bloqueo: BloqueoDeLaSemana };

/**
 * La semana como lista. Siete columnas de 91 px no dejan leer ni el nombre del
 * cliente; aqui cada cita ocupa el ancho y el dia se lee de arriba abajo.
 */
export function SemanaEnLista({
  dias,
  hoy,
  appointments,
  bloqueos,
  clientNames,
  nombresDeProfesional,
  diasAbiertos,
  seleccionadaId,
  onSeleccionar,
  detalle,
}: SemanaEnListaProps) {
  return (
    <ol className="space-y-4">
      {dias.map((dia) => {
        const entradas: Entrada[] = [
          ...appointments
            .filter((a) => a.date === dia)
            .map((cita) => ({
              tipo: "cita" as const,
              minuto: timeToMinutes(cita.startTime),
              cita,
            })),
          ...bloqueos
            .filter((b) => b.date === dia)
            .map((bloqueo) => ({
              tipo: "bloqueo" as const,
              minuto: timeToMinutes(bloqueo.startTime),
              bloqueo,
            })),
        ].sort((a, b) => a.minuto - b.minuto);
        const esHoy = dia === hoy;

        return (
          <li key={dia}>
            <h3
              className={cn(
                "mb-2 flex items-center gap-2 text-sm font-semibold first-letter:uppercase",
                esHoy && "text-primary"
              )}
            >
              {new Date(`${dia}T12:00:00`).toLocaleDateString("es-CO", {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
              {esHoy && (
                <span className="bg-primary/10 rounded-sm px-1.5 py-0.5 text-xs">
                  Hoy
                </span>
              )}
              {esDiaCerrado(dia, diasAbiertos) && (
                <span className="bg-muted text-muted-foreground rounded-sm px-1.5 py-0.5 text-xs font-medium">
                  Cerrado
                </span>
              )}
            </h3>

            {entradas.length === 0 ? (
              <p className="text-muted-foreground border-muted rounded-lg border border-dashed px-3 py-2 text-sm">
                Sin citas
              </p>
            ) : (
              <ul className="space-y-1.5">
                {entradas.map((entrada) =>
                  entrada.tipo === "bloqueo" ? (
                    <li
                      key={entrada.bloqueo.id}
                      className="text-muted-foreground bg-muted-foreground/10 border-muted-foreground/40 rounded-md border border-dashed px-3 py-2 text-sm"
                    >
                      <span className="font-medium">
                        {formatTime(entrada.bloqueo.startTime)} –{" "}
                        {formatTime(entrada.bloqueo.endTime)}
                      </span>{" "}
                      · {entrada.bloqueo.reason || "Bloqueado"} ·{" "}
                      {nombresDeProfesional[entrada.bloqueo.professionalId] ??
                        "profesional"}
                    </li>
                  ) : (
                    <li key={entrada.cita.id}>
                      <FilaDeCita
                        cita={entrada.cita}
                        cliente={
                          clientNames[entrada.cita.clientId] || "Cliente"
                        }
                        profesional={
                          nombresDeProfesional[entrada.cita.professionalId]
                        }
                        seleccionada={seleccionadaId === entrada.cita.id}
                        onSeleccionar={() => onSeleccionar(entrada.cita.id)}
                      />
                      {seleccionadaId === entrada.cita.id && detalle}
                    </li>
                  )
                )}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Una cita de la lista: la hora, el cliente y el servicio en el color de su estado. */
function FilaDeCita({
  cita,
  cliente,
  profesional,
  seleccionada,
  onSeleccionar,
}: {
  cita: Appointment;
  cliente: string;
  profesional?: string;
  seleccionada: boolean;
  onSeleccionar: () => void;
}) {
  const estado = getAppointmentStatus(cita.status);

  return (
    <button
      type="button"
      onClick={onSeleccionar}
      aria-pressed={seleccionada}
      className={cn(
        "flex min-h-11 w-full items-start gap-3 rounded-md border px-3 py-2 text-left text-sm",
        estado.calendarColor,
        seleccionada && "ring-primary ring-2"
      )}
    >
      <span className="w-12 shrink-0 font-semibold tabular-nums">
        {formatTime(cita.startTime)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{cliente}</span>
        <span className="block truncate text-xs opacity-80">
          {cita.appointmentServices[0]?.serviceName || "Servicio"}
          {profesional && ` · ${profesional}`}
        </span>
      </span>
      <span className="shrink-0 text-xs opacity-80">{estado.label}</span>
    </button>
  );
}
