"use client";

// Fecha de nacimiento que el cliente da, opcional, con el motivo a la vista.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toLocalDateKey } from "@/lib/utils";

interface CampoFechaDeNacimientoProps {
  id?: string;
  /** `YYYY-MM-DD`, o vacío si no la ha dado. */
  value: string;
  onChange: (fecha: string) => void;
  disabled?: boolean;
}

/**
 * Campo de la fecha de nacimiento. Es un dato personal, así que dice para qué
 * se usa y no deja elegir un día que aún no ha llegado.
 */
export function CampoFechaDeNacimiento({
  id = "birthDate",
  value,
  onChange,
  disabled,
}: CampoFechaDeNacimientoProps) {
  const ayudaId = `${id}-ayuda`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Fecha de nacimiento (opcional)</Label>
      <Input
        id={id}
        name="bday"
        type="date"
        autoComplete="bday"
        max={toLocalDateKey(new Date())}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={ayudaId}
        disabled={disabled}
      />
      <p id={ayudaId} className="text-muted-foreground text-xs">
        Solo la usamos para felicitarte en tu cumpleaños.
      </p>
    </div>
  );
}
