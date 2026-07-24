import { IsString, IsOptional, IsNotEmpty } from "class-validator";

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
}
