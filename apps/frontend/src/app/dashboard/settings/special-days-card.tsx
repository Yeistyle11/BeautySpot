"use client";

// Dias especiales del negocio: festivos, vacaciones y jornadas con horario
// propio, que pesan mas que el horario de la semana.
import { useState } from "react";
import { CalendarOff, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { HoraDeCierre } from "@/components/ui/hora-de-cierre";
import { formatDate } from "@/lib/utils";
import { canDo } from "@/lib/permissions";
import type { Role } from "@/lib/store";
import {
  nuevoDiaEspecial,
  type DiaEspecial,
  type NuevoDiaEspecial,
} from "./schemas";

interface SpecialDaysCardProps {
  dias: DiaEspecial[];
  onCreate: (dia: NuevoDiaEspecial) => Promise<void>;
  onRemove: (id: string) => void;
  saving: boolean;
  role: Role | null;
}

/** Como se lee en la lista lo que pasa ese dia. */
function resumen(dia: DiaEspecial): string {
  if (dia.closed) return "Cerrado";
  return `Abre de ${dia.openTime} a ${dia.closeTime}`;
}

/** Festivos, vacaciones y jornadas especiales del negocio. */
export function SpecialDaysCard({
  dias,
  onCreate,
  onRemove,
  saving,
  role,
}: SpecialDaysCardProps) {
  const puedeEditar = canDo(role, "business_hours_edit");
  const [form, setForm] = useState<NuevoDiaEspecial>(nuevoDiaEspecial);
  const set = (cambios: Partial<NuevoDiaEspecial>) =>
    setForm({ ...form, ...cambios });

  const crear = async () => {
    await onCreate({ ...form, endDate: form.endDate || form.startDate });
    setForm(nuevoDiaEspecial);
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Días especiales</CardTitle>
        <p className="text-muted-foreground text-sm">
          Festivos, vacaciones y jornadas con horario propio. Mandan sobre el
          horario de la semana, y la agenda deja de ofrecer esos días.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {dias.length === 0 ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <CalendarOff className="h-4 w-4" />
            Todavía no hay ninguno declarado.
          </p>
        ) : (
          <ul className="space-y-2">
            {dias.map((dia) => (
              <li
                key={dia.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{dia.motivo}</p>
                  <p className="text-muted-foreground text-sm">
                    {formatDate(dia.startDate)}
                    {dia.endDate !== dia.startDate &&
                      ` al ${formatDate(dia.endDate)}`}
                    {` · ${resumen(dia)}`}
                  </p>
                </div>
                {puedeEditar && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Quitar ${dia.motivo}`}
                    onClick={() => onRemove(dia.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {puedeEditar && (
          <div className="space-y-4 rounded-lg border border-dashed p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Desde">
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set({ startDate: e.target.value })}
                />
              </Field>
              <Field label="Hasta" hint="Vacío, es un solo día.">
                <Input
                  type="date"
                  min={form.startDate || undefined}
                  value={form.endDate}
                  onChange={(e) => set({ endDate: e.target.value })}
                />
              </Field>
            </div>

            <Field label="Motivo">
              <Input
                value={form.motivo}
                onChange={(e) => set({ motivo: e.target.value })}
                maxLength={120}
                placeholder="20 de julio, vacaciones, reforma..."
              />
            </Field>

            <div className="flex items-center gap-3">
              <Switch
                checked={!form.closed}
                onCheckedChange={(abierto) => set({ closed: !abierto })}
                aria-label="Abre con horario propio"
              />
              <span className="text-sm">Abre con horario propio</span>
            </div>

            {!form.closed && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Apertura">
                  <Input
                    type="time"
                    value={form.openTime}
                    onChange={(e) => set({ openTime: e.target.value })}
                  />
                </Field>
                <Field label="Cierre">
                  <HoraDeCierre
                    value={form.closeTime}
                    apertura={form.openTime}
                    onValueChange={(closeTime) => set({ closeTime })}
                  />
                </Field>
              </div>
            )}

            <Button
              onClick={crear}
              disabled={saving || !form.startDate || !form.motivo}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Añadir día especial
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
