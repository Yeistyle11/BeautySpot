import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";
import {
  PATRON_TELEFONO,
  MENSAJE_TELEFONO,
} from "@beautyspot/shared-constants";
import { EsFechaSola } from "@beautyspot/nest-common";
import { EsHoraDelDia } from "../../../common/es-hora-del-dia.decorator";

/**
 * Datos de una reserva del escaparate con la sesión iniciada. No lleva `userId`
 * a propósito: quien reserva sale del token. El contacto tampoco es
 * obligatorio, solo sirve para corregir con qué datos quiere que le avisen.
 */
export class MiReservaDto {
  @IsUUID() businessId!: string;
  /** Omitirlo pide "cualquiera disponible". */
  @IsOptional() @IsUUID() professionalId?: string;
  /** Solo los ids: el precio y la duración los resuelve el backend. */
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID("4", { each: true })
  serviceIds!: string[];
  @EsFechaSola() date!: string;
  @EsHoraDelDia() startTime!: string;
  @IsOptional() @IsString() notes?: string;
  @IsString({ message: "Escribe tu nombre para reservar" })
  @MaxLength(200, { message: "El nombre no puede pasar de 200 caracteres" })
  guestName!: string;
  @IsOptional()
  @IsEmail({}, { message: "El correo no tiene un formato válido" })
  @MaxLength(255, { message: "El correo no puede pasar de 255 caracteres" })
  guestEmail?: string;
  @IsOptional()
  @IsString()
  @Matches(PATRON_TELEFONO, { message: MENSAJE_TELEFONO })
  @MaxLength(30, { message: "El teléfono no puede pasar de 30 caracteres" })
  guestPhone?: string;
}
