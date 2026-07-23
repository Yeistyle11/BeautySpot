"use client";
import { Children, cloneElement, isValidElement, useId } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  children: React.ReactNode;
  /** Texto de ayuda; se enlaza con aria-describedby al control. */
  hint?: string;
  /** Clases del contenedor, para los campos que ocupan varias columnas. */
  className?: string;
}

/**
 * Une una etiqueta con su control. Genera el `id` y lo inyecta en el hijo, que
 * es lo que hacia falta para que un lector de pantalla anuncie el nombre del
 * campo: antes las etiquetas eran hermanas sueltas del input, sin `htmlFor`,
 * y los formularios se leian como "campo de edicion" sin mas.
 */
export function Field({ label, children, hint, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;

  const control = Children.only(children);
  const labelled = isValidElement<{
    id?: string;
    "aria-describedby"?: string;
  }>(control)
    ? cloneElement(control, { id, "aria-describedby": hintId })
    : control;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {labelled}
      {hint && (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}
