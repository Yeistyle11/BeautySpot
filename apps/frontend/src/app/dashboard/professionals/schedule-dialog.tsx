"use client";

// Dialogo para configurar el horario semanal de un profesional.
import { Plus } from "lucide-react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotonDeCancelar, Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { RangoDeHoras } from "@/components/ui/rango-de-horas";
import {
  DAYS_MAP,
  TRAMO_POR_DEFECTO,
  type DayHours,
  type Professional,
} from "./schemas";

interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  professional: Professional | null;
  hours: Record<number, DayHours>;
  onChange: (hours: Record<number, DayHours>) => void;
  saving: boolean;
  error?: string;
}

/** Horario semanal de un profesional, con varios tramos por dia. */
export function ScheduleDialog({
  open,
  onClose,
  onSave,
  professional,
  hours,
  onChange,
  saving,
  error,
}: ScheduleDialogProps) {
  const setTramos = (day: number, tramos: DayHours) =>
    onChange({ ...hours, [day]: tramos });

  const editarTramo = (
    day: number,
    indice: number,
    campo: "startTime" | "endTime",
    valor: string
  ) =>
    setTramos(
      day,
      hours[day].map((tramo, i) =>
        i === indice ? { ...tramo, [campo]: valor } : tramo
      )
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Horarios de ${professional?.name || ""}`}
      descripcion="Los días y las horas en que se le pueden reservar citas."
      icono={CalendarDays}
      wide
      pie={
        <>
          <BotonDeCancelar />
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar horarios"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <div className="space-y-3">
          {DAYS_MAP.map((day) => {
            const tramos = hours[day.value] ?? [];
            const trabaja = tramos.length > 0;

            return (
              <div
                key={day.value}
                className="flex flex-wrap items-start gap-4 rounded-lg border p-3"
              >
                <span
                  className="mt-1 w-20 text-sm font-medium"
                  id={`day-${day.value}`}
                >
                  {day.label}
                </span>
                <Switch
                  className="mt-1"
                  checked={trabaja}
                  onCheckedChange={(checked) =>
                    setTramos(day.value, checked ? [TRAMO_POR_DEFECTO] : [])
                  }
                  aria-labelledby={`day-${day.value}`}
                />
                {trabaja ? (
                  <div className="flex w-full flex-col gap-2 sm:w-auto">
                    {tramos.map((tramo, i) => (
                      <RangoDeHoras
                        key={i}
                        desde={tramo.startTime}
                        hasta={tramo.endTime}
                        onDesde={(hora) =>
                          editarTramo(day.value, i, "startTime", hora)
                        }
                        onHasta={(hora) =>
                          editarTramo(day.value, i, "endTime", hora)
                        }
                        etiquetaDesde={`Hora de inicio del tramo ${i + 1}, ${day.label}`}
                        etiquetaHasta={`Hora de fin del tramo ${i + 1}, ${day.label}`}
                        alQuitar={
                          tramos.length > 1
                            ? () =>
                                setTramos(
                                  day.value,
                                  tramos.filter((_, j) => j !== i)
                                )
                            : undefined
                        }
                        etiquetaQuitar={`Quitar el tramo ${i + 1} del ${day.label}`}
                      />
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 self-start px-2"
                      onClick={() =>
                        setTramos(day.value, [...tramos, TRAMO_POR_DEFECTO])
                      }
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Anadir tramo
                    </Button>
                  </div>
                ) : (
                  <span className="text-muted-foreground mt-1 text-sm">
                    No disponible
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
