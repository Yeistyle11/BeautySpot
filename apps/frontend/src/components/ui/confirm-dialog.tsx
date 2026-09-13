"use client";

// Dialogo de confirmacion para acciones destructivas, con estado de carga y error.
import { AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotonDeCancelar, Dialog } from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** Registro sobre el que se actua; abre la frase en negrita. */
  registro?: string;
  /** Que ocurre al confirmar; continua la frase del registro. */
  consecuencias?: React.ReactNode;
  /** Que no se toca al confirmar. */
  seConserva?: React.ReactNode;
  /** Cuerpo a medida, para lo que no cabe en la forma de arriba. */
  children?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Etiqueta mientras la accion esta en curso. */
  pendingLabel?: string;
  pending?: boolean;
  /** `destructive` para acciones que borran o desactivan. */
  variant?: "default" | "destructive";
  /** Error de la ultima confirmacion fallida; se muestra sobre los botones. */
  error?: string;
}

/** Confirmacion de una accion puntual: nombra el registro, que pasa y que se conserva. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  registro,
  consecuencias,
  seConserva,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  pendingLabel = "Procesando...",
  pending = false,
  variant = "default",
  error,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      icono={variant === "destructive" ? AlertTriangle : HelpCircle}
      // Lo que se marque aqui es parte de la pregunta, no un formulario.
      sinAvisoDeDescarte
      pie={
        <>
          <BotonDeCancelar>{cancelLabel}</BotonDeCancelar>
          <Button variant={variant} onClick={onConfirm} disabled={pending}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {/* El registro, que pasa al confirmar y que se conserva. */}
        {(registro || consecuencias) && (
          <p className="text-sm">
            {registro && <strong>{registro}</strong>}
            {registro && consecuencias ? " " : null}
            {consecuencias}
          </p>
        )}
        {seConserva && (
          <p className="text-muted-foreground text-sm">{seConserva}</p>
        )}
        {children && (
          <div className="text-muted-foreground text-sm">{children}</div>
        )}
        {error && (
          <p
            role="alert"
            className="text-destructive bg-destructive/10 rounded-lg p-3 text-sm"
          >
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}
