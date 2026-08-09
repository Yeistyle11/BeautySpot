import { applyDecorators } from "@nestjs/common";
import {
  IsString,
  Matches,
  MinLength,
  registerDecorator,
} from "class-validator";
import {
  CONTRASENAS_PROHIBIDAS,
  LONGITUD_MINIMA_CONTRASENA,
  MENSAJE_CONTRASENA,
  PATRON_CONTRASENA,
} from "@beautyspot/shared-constants";

/** Rechaza las contraseñas que contienen una palabra de la lista de comunes. */
function NoEsContrasenaComun(): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: "noEsContrasenaComun",
      target: target.constructor,
      propertyName: propertyName as string,
      validator: {
        validate(value: unknown) {
          if (typeof value !== "string") return false;
          const texto = value.toLowerCase();
          return !CONTRASENAS_PROHIBIDAS.some((c) => texto.includes(c));
        },
        defaultMessage: () => "Esa contraseña es demasiado común: elige otra",
      },
    });
  };
}

/**
 * Reglas de una contraseña nueva, iguales en registro, cambio y recuperación.
 *
 * Solo se aplican a las contraseñas que se fijan a partir de ahora: las ya
 * guardadas son hashes y no se pueden reevaluar.
 */
export function EsContrasenaValida(): PropertyDecorator {
  return applyDecorators(
    IsString({ message: "La contraseña es obligatoria" }),
    MinLength(LONGITUD_MINIMA_CONTRASENA, {
      message: `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres`,
    }),
    Matches(PATRON_CONTRASENA, { message: MENSAJE_CONTRASENA }),
    NoEsContrasenaComun()
  );
}
