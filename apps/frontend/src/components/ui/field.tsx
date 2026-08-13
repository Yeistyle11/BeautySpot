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
 * Une una etiqueta con su control. Genera el `id` y lo inyecta en el control,
 * que es lo que hace falta para que un lector de pantalla anuncie el nombre del
 * campo: una etiqueta hermana suelta del input, sin `htmlFor`, se lee como
 * "campo de edicion" sin mas.
 *
 * Con `error`, ademas, marca el control como invalido y le enlaza el mensaje,
 * de modo que el lector lo anuncie al llegar al campo y no solo cuando aparece.
 *
 * El control es el **primer elemento** que se le pasa; lo que venga detras se
 * pinta tal cual, para que un campo pueda acompañarse de un aviso propio. Exigir
 * un unico hijo era una restriccion invisible en la firma —`ReactNode` admite
 * varios y TypeScript no avisa— que tumbaba en ejecucion la pantalla entera.
 */
export function Field({ label, children, hint, error, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  // `toArray` descarta de paso los `false` y `null` que deja un `&&` sin
  // cumplir, que si no contarian como hijo.
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
