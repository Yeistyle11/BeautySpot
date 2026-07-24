"use client";

// Seccion de galeria del perfil publico de un negocio.
import Image from "next/image";
import { Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { imageUnoptimized } from "@/lib/image";
import type { GalleryImage } from "../schemas";

export function GallerySection({
  title,
  images,
  setGalleryIdx,
  setLightboxOpen,
}: {
  title: string;
  images: GalleryImage[];
  setGalleryIdx: (v: number | ((prev: number) => number)) => void;
  setLightboxOpen: (v: boolean) => void;
}) {
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
        <div
          className="relative mb-4 cursor-pointer overflow-hidden rounded-xl"
          onClick={() => {
            setGalleryIdx(0);
            setLightboxOpen(true);
          }}
        >
          <Image
            src={images[0].url}
            alt={images[0].title || "Galeria"}
            width={800}
            height={600}
            unoptimized={imageUnoptimized(images[0].url)}
            className="h-64 w-full object-cover sm:h-80"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors hover:bg-black/20">
            <Camera className="h-8 w-8 text-white opacity-0 transition-opacity hover:opacity-100" />
          </div>
        </div>
      )}

      {images.length > 1 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.slice(1, 9).map((img, i) => (
            <div
              key={i}
              className="cursor-pointer overflow-hidden rounded-lg"
              onClick={() => {
                setGalleryIdx(i + 1);
                setLightboxOpen(true);
              }}
            >
              <Image
                src={img.url}
                alt={img.title || `Foto ${i + 2}`}
                width={300}
                height={300}
                unoptimized={imageUnoptimized(img.url)}
                className="aspect-square w-full object-cover transition-transform hover:scale-105"
              />
            </div>
          ))}
          {images.length > 9 && (
            <div
              className="bg-muted flex cursor-pointer items-center justify-center rounded-lg"
              onClick={() => {
                setGalleryIdx(9);
                setLightboxOpen(true);
              }}
            >
              <span className="text-muted-foreground text-sm font-medium">
                +{images.length - 9} mas
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
