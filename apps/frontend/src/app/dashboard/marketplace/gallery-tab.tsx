"use client";
import Image from "next/image";
import { Camera, Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { canDo } from "@/lib/permissions";
import { imageUnoptimized } from "@/lib/image";
import type { Role } from "@/lib/store";
import type { GalleryImage } from "./schemas";

interface GalleryTabProps {
  gallery: GalleryImage[];
  role: Role | null;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

/** Rejilla de fotos del perfil publico. */
export function GalleryTab({
  gallery,
  role,
  onAdd,
  onRemove,
}: GalleryTabProps) {
  const canEdit = canDo(role, "marketplace_edit");

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Galeria ({gallery.length} imagenes)
          </CardTitle>
          {canEdit && (
            <Button size="sm" onClick={onAdd}>
              <Plus className="mr-2 h-4 w-4" /> Agregar imagen
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {gallery.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <Camera className="mx-auto h-12 w-12 opacity-20" />
            <p className="mt-2">
              Agrega imagenes para hacer tu perfil mas atractivo
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {gallery.map((img, i) => (
              <div
                key={`${img.url}-${i}`}
                className="bg-muted group relative aspect-square overflow-hidden rounded-lg border"
              >
                {img.url ? (
                  <Image
                    src={img.url}
                    alt={img.title || `Imagen ${i + 1}`}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    unoptimized={imageUnoptimized(img.url)}
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <ImageIcon className="text-muted-foreground h-8 w-8 opacity-30" />
                  </div>
                )}
                {canEdit && (
                  // La capa de acciones aparece al pasar el raton, pero el
                  // boton sigue siendo alcanzable con teclado (focus-within).
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onRemove(i)}
                      aria-label={`Eliminar ${img.title || `imagen ${i + 1}`}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {img.title && (
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1">
                    <p className="truncate text-xs text-white">{img.title}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
