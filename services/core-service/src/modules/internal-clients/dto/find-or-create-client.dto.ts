import { IsString, IsOptional, IsNotEmpty, IsUUID } from "class-validator";

/** Datos mínimos del cliente de una reserva para buscarlo o crearlo en el negocio. */
export class FindOrCreateClientDto {
  @IsString()
  @IsNotEmpty()
  businessId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  /** Usuario que reserva; ausente en una reserva de invitado. */
  @IsUUID()
  @IsOptional()
  userId?: string;

  /**
   * Correo que el token de quien reserva acredita suyo. Solo viaja junto a
   * `userId` y es el único contacto que sirve para identificar: `email` y
   * `phone` los escribe la persona en el formulario y cualquiera puede poner
   * los de otro.
   */
  @IsString()
  @IsOptional()
  userEmail?: string;
}
