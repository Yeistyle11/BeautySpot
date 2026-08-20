"use client";

// Dialogo para mover una cita a otro hueco libre del mismo profesional.
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { useApi } from "@/lib/swr";
import { cn, formatDate, formatTime, toLocalDateKey } from "@/lib/utils";
import {
  availabilitySlotSchema,
  type AvailabilitySlot,
} from "@/lib/schemas/appointment";
import type { Appointment } from "./schemas";

interface RescheduleDialogProps {
  open: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  onConfirm: (date: string, startTime: string) => void;
  pending: boolean;
  error?: string;
}

/** Mueve una cita a otra fecha y hora, entre los huecos que quedan libres. */
export function RescheduleDialog({
  open,
  onClose,
  appointment,
  onConfirm,
  pending,
  error,
}: RescheduleDialogProps) {
  const hoy = toLocalDateKey(new Date());
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState<string | null>(null);

  useEffect(() => {
    setFecha(appointment?.date ?? "");
    setHora(null);
  }, [appointment]);

  const duracion = useMemo(
    () =>
      (appointment?.appointmentServices ?? []).reduce(
        (total, s) => total + s.duration,
        0
      ),
    [appointment]
  );

  const clave =
    appointment && fecha && duracion > 0
      ? `/booking/appointments/availability?professionalId=${appointment.professionalId}&date=${fecha}&duration=${duracion}`
      : null;
  const { data: huecos, isLoading } = useApi<AvailabilitySlot[]>(
    clave,
    undefined,
    z.array(availabilitySlotSchema)
  );

  const libres = (huecos ?? []).filter((h) => h.available);

  return (
    <Dialog open={open} onClose={onClose} title="Reagendar cita" wide>
      {appointment && (
        <div className="space-y-5">
          <p className="text-muted-foreground text-sm">
            Ahora está el {formatDate(appointment.date)} a las{" "}
            {formatTime(appointment.startTime)}, y dura {duracion} minutos.
          </p>

          <div className="max-w-xs">
            <Field label="Nueva fecha">
              <Input
                type="date"
                min={hoy}
                value={fecha}
                onChange={(e) => {
                  setFecha(e.target.value);
                  setHora(null);
                }}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Horarios disponibles</p>
            {isLoading ? (
              <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando disponibilidad...
              </div>
            ) : libres.length === 0 ? (
              <div className="text-muted-foreground py-6 text-center text-sm">
                <Clock className="mx-auto mb-2 h-8 w-8 opacity-20" />
                <p>No queda ningún hueco libre ese día.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {libres.map((hueco) => (
                  <button
                    key={hueco.startTime}
                    type="button"
                    onClick={() => setHora(hueco.startTime)}
                    className={cn(
                      "rounded-lg border-2 px-3 py-2 text-center text-sm font-medium transition-all",
                      hora === hueco.startTime
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted bg-background hover:border-primary/40"
                    )}
                  >
                    {formatTime(hueco.startTime)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button
              onClick={() => hora && onConfirm(fecha, hora)}
              disabled={!hora || pending}
            >
              {pending ? "Moviendo..." : "Mover la cita"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
