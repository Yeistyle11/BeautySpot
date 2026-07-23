"use client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** Cuerpo del dialogo: texto plano o JSX cuando hace falta resaltar datos. */
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

/**
 * Dialogo de confirmacion para acciones puntuales (desactivar, eliminar,
 * cerrar caja). Antes cada pagina repetia este mismo bloque de markup con
 * pequenas variaciones de texto y de estilo del boton.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  pendingLabel = "Procesando...",
  pending = false,
  variant = "default",
  error,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
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
        <div className="flex gap-2">
          <Button variant={variant} onClick={onConfirm} disabled={pending}>
            {pending ? pendingLabel : confirmLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
