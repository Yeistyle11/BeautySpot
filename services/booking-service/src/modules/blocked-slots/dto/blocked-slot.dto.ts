import { IsString, IsOptional } from "class-validator";
import { EsFechaSola } from "../../../common/es-fecha-sola.decorator";

/** Datos para bloquear la agenda: fecha, horas y motivo opcional. */
export class CreateBlockedSlotDto {
  @EsFechaSola() date!: string;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
  @IsOptional() @IsString() reason?: string;
}
