"use client";

// Seccion de galeria del perfil publico de un negocio.
import { useState } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { imageUnoptimized } from "@/lib/image";
import type { GalleryImage } from "../schemas";
import { GalleryLightbox } from "./gallery-lightbox";

/**
 * Rejilla de fotos del negocio. Es dueña del visor a pantalla completa, asi que
 * el perfil solo tiene que pasarle las imagenes.
 */
export function GallerySection({
  title,
  images,
}: {
  title: string;
  images: GalleryImage[];
}) {
  const [indice, setIndice] = useState(0);
  const [visorAbierto, setVisorAbierto] = useState(false);

  const abrirEn = (posicion: number) => {
    setIndice(posicion);
    setVisorAbierto(true);
  };

  return (
    <section className="mb-12">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Camera className="text-primary h-5 w-5" />
          {title}
        </h2>
        <Badge variant="secondary">{images.length} fotos</Badge>
      </div>

      {images.length > 0 && (
        <button
          type="button"
          onClick={() => abrirEn(0)}
          aria-label={`Ampliar ${images[0].title || "la foto principal"}`}
          className="focus-visible:ring-ring group relative mb-4 block w-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2"
        >
          <Image
            src={images[0].url}
            alt={images[0].title || "Galería"}
            width={800}
            height={600}
            unoptimized={imageUnoptimized(images[0].url)}
            className="h-64 w-full object-cover sm:h-80"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
            <Camera className="h-8 w-8 text-white opacity-0 transition-opacity group-hover:opacity-100" />
          </span>
        </button>
      )}

      {images.length > 1 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.slice(1, 9).map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => abrirEn(i + 1)}
              aria-label={`Ampliar ${img.title || `foto ${i + 2}`}`}
              className="focus-visible:ring-ring overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2"
            >
              <Image
                src={img.url}
                alt={img.title || `Foto ${i + 2}`}
                width={300}
                height={300}
                unoptimized={imageUnoptimized(img.url)}
                className="aspect-square w-full object-cover transition-transform hover:scale-105"
              />
            </button>
          ))}
          {images.length > 9 && (
            <button
              type="button"
              onClick={() => abrirEn(9)}
              className="bg-muted focus-visible:ring-ring flex items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2"
            >
              <span className="text-muted-foreground text-sm font-medium">
                +{images.length - 9} mas
              </span>
            </button>
          )}
        </div>
      )}

      <GalleryLightbox
        images={images}
        index={indice}
        onIndexChange={setIndice}
        open={visorAbierto}
        onClose={() => setVisorAbierto(false)}
      />
    </section>
  );
}
