import { BadRequestException } from "@nestjs/common";
import sharp from "sharp";
import {
  MAXIMO_BYTES_IMAGEN,
  type PropositoDeImagen,
} from "@beautyspot/shared-constants";

/** Lado mayor con el que queda cada imagen: el que se ve, no el que se subió. */
export const LADO_MAXIMO: Record<PropositoDeImagen, number> = {
  logo: 512,
  profesional: 512,
  historia: 1200,
  galeria: 1600,
  portada: 1920,
};

/**
 * Píxeles que se aceptan al decodificar: de sobra para una foto de 40 MP y por
 * debajo de lo que haría falta para agotar la memoria con un archivo pequeño.
 */
const MAXIMO_PIXELES = 50_000_000;

/** Calidad del WebP: indistinguible del original a la vista y ligero. */
const CALIDAD_WEBP = 82;

/** Imagen lista para guardar. */
export interface ImagenProcesada {
  datos: Buffer;
  ancho: number;
  alto: number;
}

/**
 * Formato que dicen los primeros bytes, o null si no es JPEG, PNG ni WebP. Es
 * lo único que no controla quien sube: nombre y tipo los pone el navegador.
 */
export function formatoSegunContenido(
  datos: Buffer
): "jpeg" | "png" | "webp" | null {
  if (datos.length < 12) return null;
  if (datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff) {
    return "jpeg";
  }
  if (datos.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    return "png";
  }
  if (
    datos.subarray(0, 4).toString("ascii") === "RIFF" &&
    datos.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

/**
 * Convierte lo que se sube en la imagen que se guarda: la gira según la
 * cámara, la reduce al tamaño de su propósito y la reencoda a WebP sin
 * metadatos (ni EXIF ni GPS). Reencodar asegura además que lo guardado es solo
 * una imagen, traiga lo que traiga el archivo.
 */
export async function procesarImagen(
  datos: Buffer,
  proposito: PropositoDeImagen
): Promise<ImagenProcesada> {
  if (datos.length > MAXIMO_BYTES_IMAGEN) {
    throw new BadRequestException("La imagen pesa más de 5 MB");
  }
  if (!formatoSegunContenido(datos)) {
    throw new BadRequestException(
      "El archivo no es una imagen JPEG, PNG o WebP"
    );
  }

  const lado = LADO_MAXIMO[proposito];
  try {
    const { data, info } = await sharp(datos, {
      limitInputPixels: MAXIMO_PIXELES,
      failOn: "error",
    })
      .rotate()
      .resize({
        width: lado,
        height: lado,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: CALIDAD_WEBP })
      .toBuffer({ resolveWithObject: true });

    return { datos: data, ancho: info.width, alto: info.height };
  } catch {
    throw new BadRequestException(
      "No se pudo leer la imagen: puede estar dañada o ser demasiado grande"
    );
  }
}
