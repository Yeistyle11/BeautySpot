import { applyDecorators } from "@nestjs/common";
import { Matches } from "class-validator";

/** Una fecha de calendario, sin hora ni zona: `YYYY-MM-DD`. */
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida que la fecha llegue como día de calendario.
 *
 * Las citas guardan la fecha en una columna `date` y el servicio la combina con
 * la hora (`${date}T${startTime}`) para situarla en el huso del negocio.
 */
export function EsFechaSola(): PropertyDecorator {
  return applyDecorators(
    Matches(SOLO_FECHA, {
      message: "$property debe tener el formato YYYY-MM-DD",
    })
  );
}
