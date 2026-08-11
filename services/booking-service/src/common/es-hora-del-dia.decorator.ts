import { applyDecorators } from "@nestjs/common";
import { Matches } from "class-validator";
import { PATRON_HORA } from "@beautyspot/shared-utils";

/**
 * Valida que la hora llegue como `HH:MM` de 00:00 a 23:59.
 *
 * El formato se comprueba en la frontera porque una hora como `"9:0"` da `NaN`
 * al convertirla a minutos, y entonces las comparaciones de horario se evalúan
 * a `false` sin que nada avise.
 */
export function EsHoraDelDia(): PropertyDecorator {
  return applyDecorators(
    Matches(PATRON_HORA, {
      message: "$property debe tener el formato HH:MM, de 00:00 a 23:59",
    })
  );
}
