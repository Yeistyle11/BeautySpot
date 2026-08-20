import { IsNumber, Min, Max, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import {
  EsHoraDelDia,
  EsHoraDeSalida,
} from "../../../common/es-hora-del-dia.decorator";

/**
 * Una franja de disponibilidad: dia de la semana con hora de inicio y fin, y
 * varias por dia en la jornada partida. La salida admite las `24:00`.
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
