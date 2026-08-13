import { IsNumber, Min, Max, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import {
  EsHoraDelDia,
  EsHoraDeSalida,
} from "../../../common/es-hora-del-dia.decorator";

/**
 * Una franja de disponibilidad: día de la semana con hora de inicio y fin. Un
 * mismo día puede traer varias, que es como se modela la jornada partida.
 *
 * La entrada es una hora del día; la salida admite además las `24:00`, que es
 * como se dice "hasta el filo de la medianoche".
 */
export class SlotDto {
  @IsNumber() @Min(0) @Max(6) dayOfWeek!: number;
  @EsHoraDelDia() startTime!: string;
  @EsHoraDeSalida() endTime!: string;
}

/** Conjunto de franjas que reemplaza la disponibilidad semanal del profesional. */
export class ReplaceAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  slots!: SlotDto[];
}
