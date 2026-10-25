import { applyDecorators } from "@nestjs/common";
import { Transform } from "class-transformer";
import {
  IsOptional,
  Matches,
  Validate,
  ValidatorConstraint,
} from "class-validator";
import type { ValidatorConstraintInterface } from "class-validator";
import { PATRON_FECHA, esFechaValida } from "@beautyspot/shared-utils";

/** Edad máxima que se acepta. */
export const EDAD_MAXIMA = 120;

/** Mañana en UTC (`YYYY-MM-DD`), con margen para el huso de quien escribe. */
function mananaUtc(): string {
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
}

/** Fecha que existe, no futura y de hace como mucho {@link EDAD_MAXIMA} años. */
@ValidatorConstraint({ name: "esNacimientoPosible" })
export class EsNacimientoPosible implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    // El formato lo valida `Matches`.
    if (typeof valor !== "string" || !PATRON_FECHA.test(valor)) return true;
    if (!esFechaValida(valor)) return false;

    const limite = mananaUtc();
    const minima = `${Number(limite.slice(0, 4)) - EDAD_MAXIMA}${limite.slice(4)}`;
    return valor < limite && valor >= minima;
  }

  defaultMessage(): string {
    return "Revisa la fecha de nacimiento: ese día no es posible";
  }
}

/** Fecha de nacimiento opcional en `YYYY-MM-DD`; vacía cuenta como `null`. */
export function EsFechaDeNacimiento(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) => (value === "" ? null : value)),
    IsOptional(),
    Matches(PATRON_FECHA, {
      message: "La fecha de nacimiento debe tener el formato AAAA-MM-DD",
    }),
    Validate(EsNacimientoPosible)
  );
}
