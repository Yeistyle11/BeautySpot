import {
  IsString,
  IsArray,
  IsOptional,
  IsEmail,
  IsUUID,
} from "class-validator";
import { EsFechaSola } from "../../../common/es-fecha-sola.decorator";

/** Datos de una reserva pública: negocio, profesional, servicios, horario y datos del invitado. */
export class PublicBookingDto {
  @IsUUID() businessId!: string;
  /** Omitirlo pide "cualquiera disponible". */
  @IsOptional() @IsUUID() professionalId?: string;
  @IsArray() serviceIds!: {
    id: string;
    name: string;
    price: number;
    duration: number;
  }[];
  @EsFechaSola() date!: string;
  @IsString() startTime!: string;
  @IsOptional() @IsString() notes?: string;
  @IsString() guestName!: string;
  @IsOptional() @IsEmail() guestEmail?: string;
  @IsOptional() @IsString() guestPhone?: string;
  /** Usuario que reserva, si tenía sesión. */
  @IsOptional() @IsUUID() userId?: string;
}
