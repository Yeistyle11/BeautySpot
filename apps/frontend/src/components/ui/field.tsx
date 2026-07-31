"use client";

// Envoltorio de campo de formulario: etiqueta, control y mensaje de error.
import { Children, cloneElement, isValidElement, useId } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  children: React.ReactNode;
  /** Texto de ayuda; se enlaza con aria-describedby al control. */
  hint?: string;
  /** Mensaje de validacion; marca el control como invalido y se le enlaza. */
  error?: string;
  /** Clases del contenedor, para los campos que ocupan varias columnas. */
  className?: string;
}

/**
 * Une una etiqueta con su control. Genera el `id` y lo inyecta en el hijo, que
 * es lo que hacia falta para que un lector de pantalla anuncie el nombre del
 * campo: antes las etiquetas eran hermanas sueltas del input, sin `htmlFor`,
 * y los formularios se leian como "campo de edicion" sin mas.
 *
 * Con `error`, ademas, marca el control como invalido y le enlaza el mensaje,
 * de modo que el lector lo anuncie al llegar al campo y no solo cuando aparece.
 */
export function Field({ label, children, hint, error, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  const control = Children.only(children);
  const labelled = isValidElement<{
    id?: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }>(control)
    ? cloneElement(control, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })
    : control;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {labelled}
      {error && (
        <p id={errorId} className="text-destructive text-xs">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}
