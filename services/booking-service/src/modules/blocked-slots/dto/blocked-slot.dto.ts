import { IsString, IsOptional, IsDateString } from "class-validator";

/** Datos para bloquear la agenda: fecha, horas y motivo opcional. */
export class CreateBlockedSlotDto {
  @IsDateString() date!: string;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
  @IsOptional() @IsString() reason?: string;
}
