import {
  ArrayNotEmpty,
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsUUID,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { EsFechaSola } from "../../../common/es-fecha-sola.decorator";

/** Datos para crear una cita: profesional, cliente, servicios, fecha y hora de inicio. */
export class CreateAppointmentDto {
  @IsUUID() professionalId!: string;
  @IsUUID() clientId!: string;
  /** Solo los ids: el precio y la duración los resuelve el backend contra el catálogo. */
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID("4", { each: true })
  serviceIds!: string[];
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
  /** Profesional concreto; si se omite hace falta `businessId`. */
  @IsOptional() @IsUUID() professionalId?: string;
  /** Negocio entero: devuelve las franjas libres de cualquiera de su equipo. */
  @IsOptional() @IsUUID() businessId?: string;
  @EsFechaSola() date!: string;
  @Type(() => Number)
  @IsNumber()
  @Min(5)
  duration!: number;
}
