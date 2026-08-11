import { IsNumber, Min, Max, IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { EsHoraDelDia } from "../../../common/es-hora-del-dia.decorator";

/**
 * Una franja de disponibilidad: día de la semana con hora de inicio y fin. Un
 * mismo día puede traer varias, que es como se modela la jornada partida.
 */
export class SlotDto {
  @IsNumber() @Min(0) @Max(6) dayOfWeek!: number;
  @EsHoraDelDia() startTime!: string;
  @EsHoraDelDia() endTime!: string;
}

/** Conjunto de franjas que reemplaza la disponibilidad semanal del profesional. */
export class ReplaceAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  slots!: SlotDto[];
}
