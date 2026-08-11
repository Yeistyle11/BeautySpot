import {
  ArrayNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  IsEmail,
  IsUUID,
} from "class-validator";
import { EsFechaSola } from "../../../common/es-fecha-sola.decorator";
import { EsHoraDelDia } from "../../../common/es-hora-del-dia.decorator";

/**
 * Datos de una reserva pública: negocio, profesional, servicios, horario y datos
 * del invitado.
 *
 * No lleva `userId`: la ruta es pública y sin token, así que aceptarlo dejaría
 * atar la ficha de cliente a la cuenta de cualquiera. Quien tenga sesión reserva
 * por la ruta autenticada.
 */
export class PublicBookingDto {
  @IsUUID() businessId!: string;
  /** Omitirlo pide "cualquiera disponible". */
  @IsOptional() @IsUUID() professionalId?: string;
  /** Solo los ids: el precio y la duración los resuelve el backend contra el catálogo. */
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID("4", { each: true })
  serviceIds!: string[];
  @EsFechaSola() date!: string;
  @EsHoraDelDia() startTime!: string;
  @IsOptional() @IsString() notes?: string;
  @IsString() guestName!: string;
  @IsOptional() @IsEmail() guestEmail?: string;
  @IsOptional() @IsString() guestPhone?: string;
}
