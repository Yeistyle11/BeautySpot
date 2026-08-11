import { applyDecorators } from "@nestjs/common";
import { Matches } from "class-validator";
import { PATRON_HORA } from "@beautyspot/shared-utils";

/**
 * Valida que la hora llegue como `HH:MM` de 00:00 a 23:59.
 *
 * El formato importa porque una hora como `"9:0"` pasa un `@IsString()` y luego
 * da `NaN` al convertirla a minutos: las comparaciones de horario se evalúan a
 * `false` y la cita se acepta sin que nadie avise.
 */
export function EsHoraDelDia(): PropertyDecorator {
  return applyDecorators(
    Matches(PATRON_HORA, {
      message: "$property debe tener el formato HH:MM, de 00:00 a 23:59",
    })
  );
}
