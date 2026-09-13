import { BadRequestException, ValidationPipe } from "@nestjs/common";
import type { ValidationError } from "@nestjs/common";
import { mensajeDeValidacion } from "@beautyspot/shared-constants";

/** Nombre del campo en el sobre de errores, con la ruta de los anidados. */
function rutaDelCampo(error: ValidationError, prefijo: string): string {
  return prefijo ? `${prefijo}.${error.property}` : error.property;
}

/**
 * Recorre el árbol de errores y devuelve una frase en castellano por regla
 * incumplida, sin repetir las que se traducen igual.
 */
function frasesDeLosErrores(
  errores: ValidationError[],
  prefijo = "",
  frases = new Set<string>()
): Set<string> {
  for (const error of errores) {
    for (const [regla, original] of Object.entries(error.constraints ?? {})) {
      frases.add(mensajeDeValidacion(regla, error.property, original));
    }
    if (error.children?.length) {
      frasesDeLosErrores(error.children, rutaDelCampo(error, prefijo), frases);
    }
  }
  return frases;
}

/** Validador de entrada: rechaza lo que el DTO no declara y traduce sus mensajes. */
export function crearValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errores: ValidationError[]) =>
      new BadRequestException([...frasesDeLosErrores(errores)]),
  });
}
