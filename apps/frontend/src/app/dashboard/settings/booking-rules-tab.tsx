"use client";

// Pestana de reservas: las reglas con las que el cliente puede cancelar su cita.
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { canDo } from "@/lib/permissions";
import type { Role } from "@/lib/store";
import type { Reservas } from "./schemas";

interface BookingRulesTabProps {
  reservas: Reservas;
  onChange: (reservas: Reservas) => void;
  onSave: () => void;
  saving: boolean;
  role: Role | null;
}

/** Política de cancelación del negocio, en horas de antelación. */
export function BookingRulesTab({
  reservas,
  onChange,
  onSave,
  saving,
  role,
}: BookingRulesTabProps) {
  const puedeEditar = canDo(role, "business_edit");
  const horas = reservas.horasMinimasCancelacion;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Reservas y cancelaciones</CardTitle>
        <p className="text-muted-foreground text-sm">
          La antelación se le exige al cliente. El negocio puede cancelar
          siempre: un imprevisto no espera.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field
          label="Antelación mínima para cancelar (horas)"
          hint="Con 0, el cliente puede cancelar hasta el último momento."
          className="max-w-xs"
        >
          <Input
            type="number"
            min={0}
            value={horas ?? 0}
            onChange={(e) =>
              onChange({
                horasMinimasCancelacion: Math.max(0, Number(e.target.value)),
              })
            }
            disabled={!puedeEditar}
          />
        </Field>

        {puedeEditar && (
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Guardar reglas
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
