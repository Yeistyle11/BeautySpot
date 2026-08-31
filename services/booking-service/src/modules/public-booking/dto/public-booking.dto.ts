import {
  ArrayNotEmpty,
  IsString,
  IsArray,
  IsOptional,
  IsEmail,
  IsUUID,
  Matches,
  MaxLength,
  Validate,
  ValidatorConstraint,
} from "class-validator";
import type { ValidatorConstraintInterface } from "class-validator";
import {
  PATRON_TELEFONO,
  MENSAJE_TELEFONO,
} from "@beautyspot/shared-constants";
import { EsFechaSola } from "@beautyspot/nest-common";
import { EsHoraDelDia } from "../../../common/es-hora-del-dia.decorator";

/**
 * Al menos una via de contacto. Sin telefono ni correo el negocio recibe un
 * nombre y nada mas: no puede confirmar la vispera, ni avisar de un retraso, ni
 * recolocar el hueco si el cliente cancela —y el no-show es el mayor coste de
 * una barberia—. El cliente tampoco puede recuperar su cita, porque no dejo
 * rastro con el que identificarse.
 */
@ValidatorConstraint({ name: "hayContacto" })
class HayContacto implements ValidatorConstraintInterface {
  validate(_valor: unknown, args?: { object: object }): boolean {
    const reserva = (args?.object ?? {}) as {
      guestEmail?: string;
      guestPhone?: string;
    };
    return Boolean(reserva.guestEmail?.trim() || reserva.guestPhone?.trim());
  }

  defaultMessage(): string {
    return "Deja un teléfono o un correo para poder confirmarte la cita";
  }
}

/**
 * Datos de una reserva publica: negocio, profesional, servicios, horario y
 * datos del invitado. Sin `userId`: la ruta va sin token.
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
  /**
   * La regla del contacto cuelga del nombre, que es el campo que siempre
   * viene: `@IsOptional` se salta **todos** los validadores de su propiedad
   * cuando el valor no llega, y colgarla del correo la habría desactivado justo
   * en la reserva que no trae ninguno.
   */
  @Validate(HayContacto)
  @IsString({ message: "Escribe tu nombre para reservar" })
  guestName!: string;
  @IsOptional()
  @IsEmail({}, { message: "El correo no tiene un formato válido" })
  @MaxLength(255, { message: "El correo no puede pasar de 255 caracteres" })
  guestEmail?: string;
  // El mismo formato que exige la ficha de cliente: de este telefono sale la
  // ficha del negocio, y un numero mal formado no se coteja con nada.
  @IsOptional()
  @IsString()
  @Matches(PATRON_TELEFONO, { message: MENSAJE_TELEFONO })
  @MaxLength(30, { message: "El teléfono no puede pasar de 30 caracteres" })
  guestPhone?: string;
}
