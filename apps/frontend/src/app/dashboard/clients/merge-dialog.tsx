"use client";

// Dialogo para fusionar dos fichas del mismo cliente en una.
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import type { Client } from "./schemas";

interface MergeDialogProps {
  open: boolean;
  onClose: () => void;
  onFusionar: () => void;
  /** Ficha que se conserva y se queda con todo. */
  superviviente: Client | null;
  /** Fichas del negocio entre las que elegir la que se absorbe. */
  candidatos: Client[];
  absorbidoId: string;
  onAbsorbidoChange: (id: string) => void;
  saving: boolean;
  error?: string;
}

/** Con qué se identifica una ficha en la lista: su contacto, si lo tiene. */
function contactoDe(cliente: Client): string {
  return [cliente.phone, cliente.email].filter(Boolean).join(" · ");
}

/**
 * Fusion de dos fichas del mismo cliente. Los duplicados aparecen en cualquier
 * cartera —la misma persona da otro telefono, se apunta con el correo del
 * trabajo, o se teclea mal un nombre— y sin fusion el salon se queda con dos
 * historiales a medias: en un centro estetico eso parte la ficha de alergias y
 * la formula de color.
 */
export function MergeDialog({
  open,
  onClose,
  onFusionar,
  superviviente,
  candidatos,
  absorbidoId,
  onAbsorbidoChange,
  saving,
  error,
}: MergeDialogProps) {
  if (!superviviente) return null;

  const absorbido = candidatos.find((c) => c.id === absorbidoId);

  return (
    <Dialog open={open} onClose={onClose} title="Fusionar fichas" wide>
      <div className="space-y-4">
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}

        <Field
          label="Ficha duplicada"
          hint="Su historial pasa a la ficha de abajo, y deja de aparecer en la cartera."
        >
          <Select
            value={absorbidoId}
            onChange={(e) => onAbsorbidoChange(e.target.value)}
          >
            <option value="">Seleccionar...</option>
            {candidatos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {contactoDe(c) ? ` · ${contactoDe(c)}` : ""}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
          <div className="min-w-32 flex-1">
            <p className="font-medium">{absorbido?.name ?? "La duplicada"}</p>
            <p className="text-muted-foreground text-xs">
              {absorbido ? contactoDe(absorbido) || "Sin contacto" : "—"}
            </p>
          </div>
          <ArrowRight className="text-muted-foreground h-4 w-4" />
          <div className="min-w-32 flex-1">
            <p className="font-medium">{superviviente.name}</p>
            <p className="text-muted-foreground text-xs">
              {contactoDe(superviviente) || "Sin contacto"}
            </p>
          </div>
        </div>

        <div className="text-muted-foreground space-y-1 text-sm">
          <p>Al fusionar, la ficha que se conserva se queda con:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>
              las citas, los cobros, las facturas y las reseñas de las dos;
            </li>
            <li>
              los puntos de fidelidad sumados y los datos que ella tenga vacíos;
            </li>
            <li>
              el teléfono y el correo de la duplicada, para que las reservas
              hechas con ellos caigan aquí.
            </li>
          </ul>
          {/* Que sea irreversible se dice antes, no en el mensaje de error. */}
          <p className="text-foreground font-medium">No se puede deshacer.</p>
        </div>

        <div className="flex gap-3">
          <Button onClick={onFusionar} disabled={!absorbidoId || saving}>
            {saving ? "Fusionando..." : "Fusionar"}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
