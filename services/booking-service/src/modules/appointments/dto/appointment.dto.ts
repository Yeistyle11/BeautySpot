import {
  ArrayNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { EsFechaSola } from "../../../common/es-fecha-sola.decorator";

/** Un servicio incluido en la cita, con su id, nombre, precio y duración. */
export class AppointmentServiceItemDto {
  @IsString() id!: string;
  @IsString() name!: string;
  @IsNumber() @Min(0) price!: number;
  @IsNumber() @Min(5) duration!: number;
}

/** Datos para crear una cita: profesional, cliente, servicios, fecha y hora de inicio. */
export class CreateAppointmentDto {
  // Exige un profesional y un cliente concretos: un id que no sea UUID llegaría
  // hasta la consulta y reventaría como error de servidor en vez de rechazarse
  // aquí.
  @IsUUID() professionalId!: string;
  @IsUUID() clientId!: string;
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AppointmentServiceItemDto)
  serviceIds!: AppointmentServiceItemDto[];
  @EsFechaSola() date!: string;
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
  @EsFechaSola() date!: string;
  @IsString() startTime!: string;
}

/** Profesional, día y duración de los que se piden los huecos libres. */
export class AvailabilityQueryDto {
  @IsString() professionalId!: string;
  @EsFechaSola() date!: string;
  // Llega por query, siempre como texto, asi que se convierte antes de validar.
  @Type(() => Number)
  @IsNumber()
  @Min(5)
  duration!: number;
}
