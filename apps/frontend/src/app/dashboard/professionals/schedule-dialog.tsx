"use client";

// Dialogo para configurar el horario semanal de un profesional.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { DAYS_MAP, type DayHours, type Professional } from "./schemas";

interface ScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  professional: Professional | null;
  hours: Record<number, DayHours>;
  onChange: (hours: Record<number, DayHours>) => void;
  saving: boolean;
}

/** Franja semanal de disponibilidad de un profesional. */
export function ScheduleDialog({
  open,
  onClose,
  onSave,
  professional,
  hours,
  onChange,
  saving,
}: ScheduleDialogProps) {
  const setDay = (day: number, patch: Partial<DayHours>) =>
    onChange({ ...hours, [day]: { ...hours[day], ...patch } });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Horarios de ${professional?.name || ""}`}
      wide
    >
      <div className="space-y-4">
        <div className="space-y-3">
          {DAYS_MAP.map((day) => {
            const h = hours[day.value];
            if (!h) return null;
            return (
              <div
                key={day.value}
                className="flex flex-wrap items-center gap-4 rounded-lg border p-3"
              >
                <span
                  className="w-20 text-sm font-medium"
                  id={`day-${day.value}`}
                >
                  {day.label}
                </span>
                <Switch
                  checked={h.active}
                  onCheckedChange={(checked) =>
                    setDay(day.value, { active: checked })
                  }
                  aria-labelledby={`day-${day.value}`}
                />
                {h.active ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={h.startTime}
                      onChange={(e) =>
                        setDay(day.value, { startTime: e.target.value })
                      }
                      className="h-8 w-28 text-sm"
                      aria-label={`Hora de inicio, ${day.label}`}
                    />
                    <span className="text-muted-foreground text-sm">a</span>
                    <Input
                      type="time"
                      value={h.endTime}
                      onChange={(e) =>
                        setDay(day.value, { endTime: e.target.value })
                      }
                      className="h-8 w-28 text-sm"
                      aria-label={`Hora de fin, ${day.label}`}
                    />
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">
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
