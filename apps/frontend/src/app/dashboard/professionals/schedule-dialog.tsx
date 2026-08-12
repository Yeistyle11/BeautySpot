"use client";

// Dialogo para configurar el horario semanal de un profesional.
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { HoraDeCierre } from "@/components/ui/hora-de-cierre";
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
      wide
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
                  <div className="flex flex-col gap-2">
                    {tramos.map((tramo, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={tramo.startTime}
                          onChange={(e) =>
                            editarTramo(
                              day.value,
                              i,
                              "startTime",
                              e.target.value
                            )
                          }
                          className="h-8 w-28 text-sm"
                          aria-label={`Hora de inicio del tramo ${i + 1}, ${day.label}`}
                        />
                        <span className="text-muted-foreground text-sm">a</span>
                        <HoraDeCierre
                          value={tramo.endTime}
                          onValueChange={(hora) =>
                            editarTramo(day.value, i, "endTime", hora)
                          }
                          className="h-8 w-40 text-sm"
                          aria-label={`Hora de fin del tramo ${i + 1}, ${day.label}`}
                        />
                        {tramos.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() =>
                              setTramos(
                                day.value,
                                tramos.filter((_, j) => j !== i)
                              )
                            }
                            aria-label={`Quitar el tramo ${i + 1} del ${day.label}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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
        <div className="flex gap-2">
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar horarios"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
