import {
  IsNumber,
  IsString,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

/** Una franja de disponibilidad: día de la semana con hora de inicio y fin. */
export class SlotDto {
  @IsNumber() @Min(0) @Max(6) dayOfWeek!: number;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
}

/** Conjunto de franjas que reemplaza la disponibilidad semanal del profesional. */
export class ReplaceAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SlotDto)
  slots!: SlotDto[];
}
