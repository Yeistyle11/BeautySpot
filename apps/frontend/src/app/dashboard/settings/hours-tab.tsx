"use client";

// Pestana de horarios: configuracion de los horarios de apertura del negocio.
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RangoDeHoras } from "@/components/ui/rango-de-horas";
import { canDo } from "@/lib/permissions";
import { useAuthStore } from "@/lib/store";
import { DAYS, type BusinessHourForm } from "./schemas";

interface HoursTabProps {
  hours: BusinessHourForm[];
  onUpdate: (
    dayOfWeek: number,
    field: keyof BusinessHourForm,
    value: string | boolean
  ) => void;
  onSave: () => void;
  saving: boolean;
}

/** Horario de apertura del negocio, dia a dia. */
export function HoursTab({ hours, onUpdate, onSave, saving }: HoursTabProps) {
  const role = useAuthStore((s) => s.role);
  return (
    <Card className="shadow-flat border-0">
      <CardHeader>
        <CardTitle className="text-lg">Horarios de atención</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {DAYS.map((day) => {
            const hour = hours.find((h) => h.dayOfWeek === day.value);
            return (
              <div
                key={day.value}
                className="flex flex-wrap items-center gap-4 rounded-lg border p-3"
              >
                <div className="w-24">
                  <span
                    className="text-sm font-medium"
                    id={`business-day-${day.value}`}
                  >
                    {day.label}
                  </span>
                </div>
                <Switch
                  checked={hour?.active ?? false}
                  onCheckedChange={(checked) =>
                    onUpdate(day.value, "active", checked)
                  }
                  aria-labelledby={`business-day-${day.value}`}
                />
                {hour?.active ? (
                  <RangoDeHoras
                    desde={hour.openTime}
                    hasta={hour.closeTime}
                    onDesde={(hora) => onUpdate(day.value, "openTime", hora)}
                    onHasta={(hora) => onUpdate(day.value, "closeTime", hora)}
                    etiquetaDesde={`Hora de apertura, ${day.label}`}
                    etiquetaHasta={`Hora de cierre, ${day.label}`}
                  />
                ) : (
                  <span className="text-muted-foreground text-sm">Cerrado</span>
                )}
              </div>
            );
          })}
        </div>
        {canDo(role, "business_hours_edit") && (
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar horarios
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
