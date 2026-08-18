import { applyDecorators } from "@nestjs/common";
import { Matches, Validate, ValidatorConstraint } from "class-validator";
import type {
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";
import { PATRON_FECHA, esFechaValida } from "@beautyspot/shared-utils";

/**
 * Comprueba que el día exista de verdad, no solo que tenga la forma.
 *
 * Va aparte del patrón para que cada fallo diga lo suyo: quien escribe
 * `13-08-2026` se equivocó de formato, y quien escribe `2027-02-29` eligió un
 * día que no existe. Son dos correcciones distintas.
 */
@ValidatorConstraint({ name: "esDiaDelCalendario" })
export class EsDiaDelCalendario implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    // El formato lo reclama el otro decorador; aquí solo se juzga lo que ya
    // tiene forma de fecha, para no dar dos mensajes por el mismo error.
    if (typeof valor !== "string" || !PATRON_FECHA.test(valor)) return true;
    return esFechaValida(valor);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property}: el ${args.value} no existe en el calendario`;
  }
}

/**
 * Valida que la fecha llegue como día de calendario.
 *
 * Las citas guardan la fecha en una columna `date` y el servicio la combina con
 * la hora (`${date}T${startTime}`) para situarla en el huso del negocio. Un día
 * que no existe da ahí una fecha inválida que no lanza: las comparaciones con
 * ella se resuelven todas a `false`, así que la petición acaba reventando o
 * respondiendo un motivo falso.
 */
export function EsFechaSola(): PropertyDecorator {
  return applyDecorators(
    Matches(PATRON_FECHA, {
      message: "$property debe tener el formato YYYY-MM-DD",
    }),
    Validate(EsDiaDelCalendario)
  );
}
