import {
  IsNumber,
  Min,
  Max,
  IsArray,
  Matches,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { PATRON_HORA } from "@beautyspot/shared-utils";

const MENSAJE_HORA = "La hora debe tener el formato HH:MM, de 00:00 a 23:59";

/**
 * Una franja de disponibilidad: día de la semana con hora de inicio y fin. Un
 * mismo día puede traer varias, que es como se modela la jornada partida.
 */
export class SlotDto {
  @IsNumber() @Min(0) @Max(6) dayOfWeek!: number;
  // El formato se valida aquí porque una hora como "9:0" da NaN al pasarla a
  // minutos, y las comparaciones de horario salen falsas sin avisar.
  @Matches(PATRON_HORA, { message: MENSAJE_HORA }) startTime!: string;
  @Matches(PATRON_HORA, { message: MENSAJE_HORA }) endTime!: string;
}

/** Conjunto de franjas que reemplaza la disponibilidad semanal del profesional. */
export class ReplaceAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  slots!: SlotDto[];
}
