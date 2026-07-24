"use client";

// Paso de seleccion de fecha y horario disponible en el flujo de reserva.
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { toLocalDateKey } from "@/lib/utils";

interface SelectSlotStepProps {
  date: string;
  onDateChange: (date: string) => void;
  startTime: string;
  onStartTimeChange: (time: string) => void;
  availableSlots: string[];
  slotsLoading: boolean;
  /** True con la opcion "cualquier profesional": no hay agenda que consultar. */
  isAnyProfessional: boolean;
  onBack: () => void;
  onContinue: () => void;
}

/** Paso 3: fecha y franja horaria. */
export function SelectSlotStep({
  date,
  onDateChange,
  startTime,
  onStartTimeChange,
  availableSlots,
  slotsLoading,
  isAnyProfessional,
  onBack,
  onContinue,
}: SelectSlotStepProps) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Selecciona fecha y hora</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Fecha">
          <Input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            // Fecha local: con toISOString() el minimo saltaba a mañana a
            // partir de las 19:00 en Colombia e impedia reservar hoy.
            min={toLocalDateKey(new Date())}
          />
        </Field>

        {date && isAnyProfessional && (
          <p className="bg-warning-soft text-warning-soft-foreground rounded-lg p-3 text-sm">
            Selecciona un profesional especifico para ver disponibilidad exacta.
            Se mostrara un rango general de horarios.
          </p>
        )}

        {date && slotsLoading && (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Consultando disponibilidad...</span>
          </div>
        )}

        {/* Los horarios son un grupo de botones, no un control unico: se
            etiquetan con role/aria-labelledby en vez de con un <label>. */}
        {date && !slotsLoading && (
          <div
            className="space-y-2"
            role="group"
            aria-labelledby="slot-group-label"
          >
            <p id="slot-group-label" className="text-sm font-medium">
              Hora disponible
            </p>
            {availableSlots.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No hay horarios disponibles para esta fecha
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {availableSlots.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => onStartTimeChange(t)}
                    aria-pressed={startTime === t}
                    className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                      startTime === t
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Atras
          </Button>
          <Button
            disabled={!date || !startTime}
            onClick={onContinue}
            className="flex-1"
          >
            Continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
