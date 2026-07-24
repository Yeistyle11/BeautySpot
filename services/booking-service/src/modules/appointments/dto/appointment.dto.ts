import {
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
  IsNumber,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

/** Un servicio incluido en la cita, con su id, nombre, precio y duración. */
export class AppointmentServiceItemDto {
  @IsString() id!: string;
  @IsString() name!: string;
  @IsNumber() @Min(0) price!: number;
  @IsNumber() @Min(5) duration!: number;
}

/** Datos para crear una cita: profesional, cliente, servicios, fecha y hora de inicio. */
export class CreateAppointmentDto {
  @IsString() professionalId!: string;
  @IsString() clientId!: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppointmentServiceItemDto)
  serviceIds!: AppointmentServiceItemDto[];
  @IsDateString() date!: string;
  @IsString() startTime!: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() branchId?: string;
}

/** Motivo de cancelación de una cita. */
export class CancelDto {
  @IsString() reason!: string;
}

/** Nueva fecha y hora de inicio para reagendar una cita. */
export class RescheduleDto {
  @IsDateString() date!: string;
  @IsString() startTime!: string;
}
