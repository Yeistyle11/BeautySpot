"use client";

// Envoltorio de campo de formulario: etiqueta, control y mensaje de error.
import { Children, cloneElement, isValidElement, useId } from "react";
import type { ReactNode } from "react";
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
 * Une una etiqueta con su control: genera el `id`, lo inyecta en el primer
 * hijo y, con `error`, lo marca invalido y le enlaza el mensaje.
 */
export function Field({ label, children, hint, error, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  // `toArray` descarta los `false` y `null` que deja un `&&` sin cumplir.
  const hijos = Children.toArray(children);
  const indiceDelControl = hijos.findIndex((hijo) => isValidElement(hijo));
  const labelled: ReactNode[] = hijos.map((hijo, i) =>
    i === indiceDelControl &&
    isValidElement<{
      id?: string;
      "aria-describedby"?: string;
      "aria-invalid"?: boolean;
    }>(hijo)
      ? cloneElement(hijo, {
          id,
          "aria-describedby": describedBy,
          "aria-invalid": error ? true : undefined,
        })
      : hijo
  );

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
