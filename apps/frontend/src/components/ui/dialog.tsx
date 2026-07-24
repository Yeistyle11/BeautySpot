"use client";

// Modal accesible construido sobre Radix Dialog.
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  wide?: boolean;
}

/**
 * Modal de la app. Se apoya en Radix para lo que una implementacion a mano no
 * cubria: atrapar el foco dentro del dialogo, devolverlo al elemento que lo
 * abrio al cerrar y exponer role/aria-modal a los lectores de pantalla.
 * La API (`open`/`onClose`/`title`/`wide`) se mantiene igual que antes.
 */
export function Dialog({ open, onClose, title, children, wide }: DialogProps) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          className={cn(
            "bg-background fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl shadow-xl focus:outline-none",
            wide ? "max-w-2xl" : "max-w-lg"
          )}
          // Los contenidos son formularios y resumenes variables: no hay una
          // descripcion unica que anunciar, y sin esto Radix avisa por consola.
          aria-describedby={undefined}
        >
          {title ? (
            <div className="flex items-center justify-between border-b px-6 py-4">
              <DialogPrimitive.Title className="text-lg font-semibold">
                {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label="Cerrar"
                className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring rounded-lg p-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
              >
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
            </div>
          ) : (
            // Un dialogo sin titulo visible sigue necesitando nombre accesible.
            <VisuallyHiddenTitle />
          )}
          <div className="px-6 py-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function VisuallyHiddenTitle() {
  return (
    <DialogPrimitive.Title className="sr-only">Dialogo</DialogPrimitive.Title>
  );
}
