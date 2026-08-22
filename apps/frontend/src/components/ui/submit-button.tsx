import { Button, type ButtonProps } from "@/components/ui/button";

interface SubmitButtonProps extends Omit<ButtonProps, "children"> {
  /** Texto en reposo. */
  label: string;
  /** Texto mientras se envia; por defecto, "Guardando...". */
  pendingLabel?: string;
  pending: boolean;
}

/** Boton de envio de un formulario: se bloquea y se explica mientras guarda. */
export function SubmitButton({
  label,
  pendingLabel = "Guardando...",
  pending,
  disabled,
  ...props
}: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
