"use client";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { canDo } from "@/lib/permissions";
import type { Role } from "@/lib/store";
import { DAYS, type BusinessHour } from "./schemas";

interface HoursTabProps {
  hours: BusinessHour[];
  onUpdate: (
    dayOfWeek: number,
    field: keyof BusinessHour,
    value: string | boolean
  ) => void;
  onSave: () => void;
  saving: boolean;
  role: Role | null;
}

/** Horario de apertura del negocio, dia a dia. */
export function HoursTab({
  hours,
  onUpdate,
  onSave,
  saving,
  role,
}: HoursTabProps) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Horarios de atencion</CardTitle>
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
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={hour.openTime}
                      onChange={(e) =>
                        onUpdate(day.value, "openTime", e.target.value)
                      }
                      className="h-8 w-28 text-sm"
                      aria-label={`Hora de apertura, ${day.label}`}
                    />
                    <span className="text-muted-foreground">a</span>
                    <Input
                      type="time"
                      value={hour.closeTime}
                      onChange={(e) =>
                        onUpdate(day.value, "closeTime", e.target.value)
                      }
                      className="h-8 w-28 text-sm"
                      aria-label={`Hora de cierre, ${day.label}`}
                    />
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">Cerrado</span>
                )}
              </div>
            );
          })}
        </div>
        {canDo(role, "settings_edit") && (
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
