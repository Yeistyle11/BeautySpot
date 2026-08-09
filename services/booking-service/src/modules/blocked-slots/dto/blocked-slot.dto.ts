import { IsString, IsOptional, Matches, MaxLength } from "class-validator";
import { PATRON_HORA } from "@beautyspot/shared-utils";
import { EsFechaSola } from "../../../common/es-fecha-sola.decorator";

const MENSAJE_HORA = "La hora debe tener el formato HH:MM, de 00:00 a 23:59";

/** Datos para bloquear la agenda: fecha, horas y motivo opcional. */
export class CreateBlockedSlotDto {
  @EsFechaSola() date!: string;
  @Matches(PATRON_HORA, { message: MENSAJE_HORA }) startTime!: string;
  @Matches(PATRON_HORA, { message: MENSAJE_HORA }) endTime!: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}
