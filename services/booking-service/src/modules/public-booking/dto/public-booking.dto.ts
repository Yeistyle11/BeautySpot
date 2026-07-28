import { IsString, IsArray, IsOptional, IsEmail, IsUUID } from "class-validator";
import { EsFechaSola } from "../../../common/es-fecha-sola.decorator";

/** Datos de una reserva pública: negocio, profesional, servicios, horario y datos del invitado. */
export class PublicBookingDto {
  @IsUUID() businessId!: string;
  // Exige un profesional concreto: un id que no sea UUID llegaría hasta la
  // consulta y reventaría como error de servidor en vez de rechazarse aquí.
  @IsUUID() professionalId!: string;
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
}
