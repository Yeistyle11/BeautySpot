import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  PREFIJO_DE_IMAGENES,
  PROPOSITOS_DE_IMAGEN,
} from "@beautyspot/shared-constants";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Forma exacta de una imagen subida a la app: negocio, propósito y un nombre
 * que no dice nada de quien la subió. Cualquier otra cosa no es nuestra.
 */
const IMAGEN_PROPIA = new RegExp(
  `^${PREFIJO_DE_IMAGENES}(negocios/(${UUID})/(${PROPOSITOS_DE_IMAGEN.join("|")})/${UUID}\\.webp)$`
);

/** Clave en el almacén y negocio de una imagen propia, o null si no lo es. */
export function claveDeImagenPropia(
  url: string
): { clave: string; businessId: string } | null {
  const coincidencia = IMAGEN_PROPIA.exec(url);
  return coincidencia
    ? { clave: coincidencia[1], businessId: coincidencia[2] }
    : null;
}

/** Si la URL es de una imagen subida por ese negocio. */
export function esImagenPropia(url: string, businessId: string): boolean {
  return claveDeImagenPropia(url)?.businessId === businessId;
}

/**
 * Exige que una imagen que se guarda la haya subido el propio negocio. Se deja
 * pasar la que ya estaba guardada, aunque sea una URL de antes de poder subir
 * archivos, para que editar otro campo no obligue a cambiarla.
 */
export function asegurarImagenPropia(
  nueva: string | null | undefined,
  guardadas: string | null | undefined | ReadonlyArray<string | null>,
  businessId: string
): void {
  if (!nueva) return;
  const anteriores = Array.isArray(guardadas) ? guardadas : [guardadas];
  if (anteriores.includes(nueva)) return;

  const propia = claveDeImagenPropia(nueva);
  if (!propia) {
    throw new BadRequestException("La imagen tiene que subirse desde el panel");
  }
  if (propia.businessId !== businessId) {
    throw new ForbiddenException("La imagen es de otro negocio");
  }
}

/**
 * Las imágenes propias que había y ya no están: las que se pueden borrar del
 * almacén después de guardar el cambio.
 */
export function imagenesQueSobran(
  antes: ReadonlyArray<string | null | undefined>,
  despues: ReadonlyArray<string | null | undefined>
): string[] {
  const siguen = new Set(despues.filter(Boolean));
  return [
    ...new Set(
      antes.filter(
        (url): url is string =>
          !!url && !siguen.has(url) && claveDeImagenPropia(url) !== null
      )
    ),
  ];
}
