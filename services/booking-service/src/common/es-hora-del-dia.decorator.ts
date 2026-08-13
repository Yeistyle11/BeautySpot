import { applyDecorators } from "@nestjs/common";
import { Matches } from "class-validator";
import { PATRON_HORA, PATRON_HORA_DE_CIERRE } from "@beautyspot/shared-utils";

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

/**
 * Valida una hora de salida, que admite además las `24:00`.
 *
 * Una jornada puede acabar al filo de la medianoche, y esa hora se dice `24:00`
 * para no confundirla con el `00:00` del principio del día. Salir de madrugada
 * se escribe con la hora del reloj —`02:00`—, que este mismo patrón acepta.
 */
export function EsHoraDeSalida(): PropertyDecorator {
  return applyDecorators(
    Matches(PATRON_HORA_DE_CIERRE, {
      message: "$property debe tener el formato HH:MM, de 00:00 a 24:00",
    })
  );
}
