"use client";

// Campo de imagen: se elige o se arrastra un archivo, se sube y el formulario
// recibe la URL que tiene que guardar.
import Image from "next/image";
import { useId, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { imageUnoptimized } from "@/lib/image";
import {
  ACEPTA_IMAGENES,
  ErrorDeImagen,
  subirImagen,
  type ImagenSubida,
  type PropositoDeImagen,
} from "@/lib/imagenes";
import { cn } from "@/lib/utils";

/** Proporción con que se previsualiza: la misma con que se verá. */
const PROPORCION = {
  cuadrada: "aspect-square w-32",
  horizontal: "aspect-[4/3] w-full max-w-sm",
  panoramica: "aspect-video w-full max-w-md",
} as const;

export type FormaDeImagen = keyof typeof PROPORCION;

/** Mensaje que se enseña cuando una subida falla. */
function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorDeImagen) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "No se pudo subir la imagen";
}

interface ZonaDeImagenesProps {
  id: string;
  proposito: PropositoDeImagen;
  /** Cuántos archivos se aceptan de una vez; uno salvo que se diga. */
  maximo?: number;
  alSubir: (imagenes: ImagenSubida[]) => void;
  alFallar: (mensaje: string | null) => void;
  deshabilitada?: boolean;
  className?: string;
  children?: ReactNode;
  describedBy?: string;
}

/**
 * Zona donde se suelta o se elige el archivo. El control es un input de
 * archivo de verdad, así que funciona con teclado, lector de pantalla y, en el
 * celular, abre la cámara o la galería.
 */
export function ZonaDeImagenes({
  id,
  proposito,
  maximo = 1,
  alSubir,
  alFallar,
  deshabilitada,
  className,
  children,
  describedBy,
}: ZonaDeImagenesProps) {
  const input = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  const subir = async (archivos: File[]) => {
    if (archivos.length === 0 || subiendo) return;
    alFallar(null);
    setSubiendo(true);
    const subidas: ImagenSubida[] = [];
    try {
      // De una en una: el servidor procesa cada imagen y así no se le
      // amontonan, y el límite de subidas por minuto se gasta despacio.
      for (const archivo of archivos.slice(0, maximo)) {
        subidas.push(await subirImagen(archivo, proposito));
      }
      if (archivos.length > maximo) {
        alFallar(
          `Solo caben ${maximo} ${maximo === 1 ? "imagen" : "imágenes"} más`
        );
      }
    } catch (error) {
      alFallar(mensajeDeError(error));
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
      if (subidas.length > 0) alSubir(subidas);
    }
  };

  const soltar = (evento: DragEvent<HTMLLabelElement>) => {
    evento.preventDefault();
    setEncima(false);
    if (!deshabilitada) void subir([...evento.dataTransfer.files]);
  };

  return (
    <>
      <input
        ref={input}
        id={id}
        type="file"
        accept={ACEPTA_IMAGENES}
        multiple={maximo > 1}
        disabled={deshabilitada || subiendo}
        aria-describedby={describedBy}
        className="peer sr-only"
        onChange={(e) => void subir([...(e.target.files ?? [])])}
      />
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={soltar}
        aria-busy={subiendo}
        className={cn(
          "border-input text-muted-foreground hover:border-primary hover:bg-accent/40 peer-focus-visible:ring-ring flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
          encima && "border-primary bg-accent/40",
          className
        )}
      >
        {subiendo ? (
          <>
            <Spinner variant="inline" label="Subiendo imagen" />
            <span>Subiendo…</span>
          </>
        ) : (
          (children ?? (
            <>
              <ImagePlus className="text-primary h-8 w-8" aria-hidden />
              <span>
                <span className="text-primary font-medium">
                  Elige {maximo > 1 ? "imágenes" : "una imagen"}
                </span>{" "}
                o arrástrala{maximo > 1 ? "s" : ""} aquí
              </span>
              <span className="text-xs">JPG, PNG o WebP · hasta 5 MB</span>
            </>
          ))
        )}
      </label>
    </>
  );
}

interface CampoDeImagenProps {
  etiqueta: string;
  /** URL guardada; vacía si todavía no hay imagen. */
  valor: string | null | undefined;
  alCambiar: (url: string | null) => void;
  proposito: PropositoDeImagen;
  forma?: FormaDeImagen;
  ayuda?: string;
  deshabilitado?: boolean;
}

/** Una imagen del formulario: vista previa, cambiarla y quitarla. */
export function CampoDeImagen({
  etiqueta,
  valor,
  alCambiar,
  proposito,
  forma = "horizontal",
  ayuda,
  deshabilitado,
}: CampoDeImagenProps) {
  const id = useId();
  const ayudaId = ayuda ? `${id}-ayuda` : undefined;
  const [error, setError] = useState<string | null>(null);

  const zona = (contenido?: ReactNode, className?: string) => (
    <ZonaDeImagenes
      id={id}
      proposito={proposito}
      alSubir={([imagen]) => alCambiar(imagen.url)}
      alFallar={setError}
      deshabilitada={deshabilitado}
      describedBy={ayudaId}
      className={className}
    >
      {contenido}
    </ZonaDeImagenes>
  );

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      {valor ? (
        <div className="space-y-2">
          <div
            className={cn(
              "bg-muted relative overflow-hidden rounded-lg border",
              PROPORCION[forma]
            )}
          >
            <Image
              src={valor}
              alt={`${etiqueta} actual`}
              fill
              sizes="(min-width: 640px) 28rem, 100vw"
              unoptimized={imageUnoptimized(valor)}
              className="object-cover"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {zona(
              <span className="text-foreground inline-flex items-center gap-2 font-medium">
                <RefreshCw className="h-4 w-4" aria-hidden /> Cambiar
              </span>,
              "border-input h-9 flex-row border border-solid px-3 py-0 [@media(pointer:coarse)]:min-h-11"
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                setError(null);
                alCambiar(null);
              }}
              disabled={deshabilitado}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Quitar
            </Button>
          </div>
        </div>
      ) : (
        zona(
          undefined,
          forma === "cuadrada" ? "w-full max-w-xs" : "w-full max-w-md"
        )
      )}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      {ayuda && (
        <p id={ayudaId} className="text-muted-foreground text-xs">
          {ayuda}
        </p>
      )}
    </div>
  );
}
