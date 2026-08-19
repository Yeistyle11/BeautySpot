import { applyDecorators } from "@nestjs/common";
import { Matches } from "class-validator";
import { PATRON_HORA, PATRON_HORA_DE_CIERRE } from "@beautyspot/shared-utils";

/** Valida que la hora llegue como `HH:MM` de 00:00 a 23:59. */
export function EsHoraDelDia(): PropertyDecorator {
  return applyDecorators(
    Matches(PATRON_HORA, {
      message: "$property debe tener el formato HH:MM, de 00:00 a 23:59",
    })
  );
}

/**
 * Valida una hora de salida, que admite ademas las `24:00`, el filo de la
 * medianoche.
 */
export function EsHoraDeSalida(): PropertyDecorator {
  return applyDecorators(
    Matches(PATRON_HORA_DE_CIERRE, {
      message: "$property debe tener el formato HH:MM, de 00:00 a 24:00",
    })
  );
}
