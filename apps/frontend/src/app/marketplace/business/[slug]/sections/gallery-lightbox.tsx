"use client";

// Visor a pantalla completa de la galeria del negocio.
import { useCallback, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { imageUnoptimized } from "@/lib/image";
import type { GalleryImage } from "../schemas";

/**
 * Visor de la galeria. Se apoya en Radix para atrapar el foco, cerrar con
 * Escape y devolver el foco a la miniatura que lo abrio; anade la navegacion
 * con las flechas del teclado, que Radix no cubre.
 */
export function GalleryLightbox({
  images,
  index,
  onIndexChange,
  open,
  onClose,
}: {
  images: GalleryImage[];
  index: number;
  onIndexChange: (index: number) => void;
  open: boolean;
  onClose: () => void;
}) {
  const total = images.length;

  const anterior = useCallback(() => {
    onIndexChange((index - 1 + total) % total);
  }, [index, total, onIndexChange]);

  const siguiente = useCallback(() => {
    onIndexChange((index + 1) % total);
  }, [index, total, onIndexChange]);

  useEffect(() => {
    if (!open) return;
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "ArrowLeft") anterior();
      if (evento.key === "ArrowRight") siguiente();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [open, anterior, siguiente]);

  const actual = images[index];
  if (!actual) return null;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(abierto) => {
        if (!abierto) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 focus:outline-none"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">
            Galería de fotos
          </DialogPrimitive.Title>

          {total > 1 && (
            <button
              type="button"
              onClick={anterior}
              aria-label="Foto anterior"
              className="focus-visible:ring-ring absolute left-4 rounded-full p-2 text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}

          <Image
            src={actual.url}
            alt={actual.title || `Foto ${index + 1} de ${total}`}
            width={1200}
            height={900}
            unoptimized={imageUnoptimized(actual.url)}
            className="max-h-[85vh] max-w-full rounded-lg object-contain"
          />

          {total > 1 && (
            <button
              type="button"
              onClick={siguiente}
              aria-label="Foto siguiente"
              className="focus-visible:ring-ring absolute right-4 rounded-full p-2 text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}

          <DialogPrimitive.Close
            aria-label="Cerrar galería"
            className="focus-visible:ring-ring absolute right-4 top-4 rounded-full p-2 text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2"
          >
            <X className="h-6 w-6" />
          </DialogPrimitive.Close>

          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80">
            {index + 1} / {total}
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
