// Subida de imágenes del negocio, con comprobación y reducción en el navegador.
import {
  MAXIMO_BYTES_IMAGEN,
  TIPOS_DE_IMAGEN,
  type PropositoDeImagen,
} from "@beautyspot/shared-constants";
import { api } from "./api";

export type { PropositoDeImagen };

/** Lo que responde el servidor al subir: la URL que guarda el formulario. */
export interface ImagenSubida {
  url: string;
  ancho: number;
  alto: number;
}

/** Lado mayor con el que sale una foto del navegador. */
export const LADO_MAXIMO_ENVIO = 2560;

/** Calidad del JPEG con que se reencoda en el navegador. */
const CALIDAD_ENVIO = 0.9;

/** Formatos que el `accept` del selector deja elegir. */
export const ACEPTA_IMAGENES =
  "image/jpeg,image/png,image/webp,image/heic,image/heif";

/** Error con un mensaje listo para enseñar en el formulario. */
export class ErrorDeImagen extends Error {}

/**
 * Tamaño con que se envía una imagen: el original si cabe, o reducido al lado
 * máximo conservando la proporción.
 */
export function medidasDeEnvio(
  ancho: number,
  alto: number,
  ladoMaximo = LADO_MAXIMO_ENVIO
): { ancho: number; alto: number } {
  const escala = Math.min(1, ladoMaximo / Math.max(ancho, alto));
  return {
    ancho: Math.round(ancho * escala),
    alto: Math.round(alto * escala),
  };
}

/** Si el archivo ya se puede mandar tal cual, sin pasar por el lienzo. */
function sirveTalCual(archivo: File): boolean {
  return (
    TIPOS_DE_IMAGEN.includes(archivo.type) &&
    archivo.size <= MAXIMO_BYTES_IMAGEN
  );
}

/** Redibuja la imagen en un lienzo al lado máximo y la exporta a JPEG. */
async function reducir(archivo: File): Promise<Blob> {
  if (typeof createImageBitmap !== "function") {
    throw new ErrorDeImagen("Este navegador no puede preparar la imagen");
  }

  let mapa: ImageBitmap;
  try {
    mapa = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  } catch {
    throw new ErrorDeImagen(
      "No se pudo leer la imagen. Prueba con una foto JPG o PNG"
    );
  }

  const { ancho, alto } = medidasDeEnvio(mapa.width, mapa.height);
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext("2d");
  if (!contexto) {
    mapa.close();
    throw new ErrorDeImagen("Este navegador no puede preparar la imagen");
  }
  contexto.drawImage(mapa, 0, 0, ancho, alto);
  mapa.close();

  const blob = await new Promise<Blob | null>((resolver) =>
    lienzo.toBlob(resolver, "image/jpeg", CALIDAD_ENVIO)
  );
  if (!blob) {
    throw new ErrorDeImagen("Este navegador no puede preparar la imagen");
  }
  return blob;
}

/**
 * Deja la imagen lista para subir: tal cual si ya es ligera y de un formato
 * que el servidor acepta, o reducida en el navegador si no.
 */
export async function prepararImagen(archivo: File): Promise<Blob> {
  if (!archivo.type.startsWith("image/")) {
    throw new ErrorDeImagen("El archivo no es una imagen");
  }
  if (sirveTalCual(archivo)) return archivo;

  const reducida = await reducir(archivo);
  if (reducida.size > MAXIMO_BYTES_IMAGEN) {
    throw new ErrorDeImagen("La imagen pesa demasiado, prueba con otra");
  }
  return reducida;
}

/** Prepara y sube una imagen del negocio; devuelve la URL que hay que guardar. */
export async function subirImagen(
  archivo: File,
  proposito: PropositoDeImagen
): Promise<ImagenSubida> {
  const imagen = await prepararImagen(archivo);
  const formulario = new FormData();
  formulario.append("proposito", proposito);
  formulario.append("archivo", imagen, nombreDeEnvio(archivo, imagen));
  return api.upload<ImagenSubida>("/core/images", formulario);
}

/** Nombre del archivo enviado, con la extensión de lo que de verdad lleva. */
function nombreDeEnvio(original: File, enviado: Blob): string {
  if (enviado === original) return original.name;
  return `${original.name.replace(/\.[^.]*$/, "") || "imagen"}.jpg`;
}
