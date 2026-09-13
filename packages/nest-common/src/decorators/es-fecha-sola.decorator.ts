import { applyDecorators } from "@nestjs/common";
import { Matches, Validate, ValidatorConstraint } from "class-validator";
import type {
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";
import { PATRON_FECHA, esFechaValida } from "@beautyspot/shared-utils";
import { CAMPOS_EN_CASTELLANO } from "@beautyspot/shared-constants";

/** Comprueba que el dia exista de verdad, no solo que tenga la forma. */
@ValidatorConstraint({ name: "esDiaDelCalendario" })
export class EsDiaDelCalendario implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    // Solo se juzga lo que ya tiene forma de fecha; del formato responde el
    // otro decorador.
    if (typeof valor !== "string" || !PATRON_FECHA.test(valor)) return true;
    return esFechaValida(valor);
  }

  defaultMessage(args: ValidationArguments): string {
    return `Revisa ${nombreDelCampo(args.property)}: el ${args.value} no existe en el calendario`;
  }
}

/** Nombre del campo tal como se le nombra al usuario. */
function nombreDelCampo(propiedad: string): string {
  return CAMPOS_EN_CASTELLANO[propiedad] ?? "la fecha";
}

/**
 * Valida que la fecha llegue como dia de calendario, que es como la guardan
 * las citas y como la combina el servicio con la hora.
 */
export function EsFechaSola(): PropertyDecorator {
  return applyDecorators(
    Matches(PATRON_FECHA, {
      message: (args) =>
        `Revisa ${nombreDelCampo(args.property)}: se espera el formato YYYY-MM-DD`,
    }),
    Validate(EsDiaDelCalendario)
  );
}
