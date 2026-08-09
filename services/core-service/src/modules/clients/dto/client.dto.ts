import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsEmail,
  Matches,
  ValidateIf,
  MaxLength,
} from "class-validator";
import {
  PATRON_TELEFONO,
  MENSAJE_TELEFONO,
} from "@beautyspot/shared-constants";

/**
 * Datos para registrar un cliente: nombre, contacto, notas y etiquetas.
 *
 * El teléfono se valida de formato porque es el canal por el que el negocio
 * avisa y recuerda las citas: un texto libre ahí es un cliente inalcanzable.
 */
export class CreateClientDto {
  @IsString({ message: "El nombre es obligatorio" })
  @MaxLength(200, { message: "El nombre no puede pasar de 200 caracteres" })
  name!: string;
  @IsOptional()
  @ValidateIf((o: { email?: string }) => !!o.email)
  @IsEmail({}, { message: "El email no tiene un formato válido" })
  @MaxLength(255, { message: "El email no puede pasar de 255 caracteres" })
  email?: string;
  @IsOptional()
  @IsString()
  // Un campo vacío significa "sin teléfono": solo se valida el formato de lo
  // que se haya escrito.
  @ValidateIf((o: { phone?: string }) => !!o.phone)
  @Matches(PATRON_TELEFONO, { message: MENSAJE_TELEFONO })
  @MaxLength(30, { message: "El teléfono no puede pasar de 30 caracteres" })
  phone?: string;
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: "El documento no puede pasar de 30 caracteres" })
  documento?: string;
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: "Las notas no pueden pasar de 1000 caracteres" })
  notes?: string;
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsArray() tags?: string[];
}

/** Campos editables de un cliente (todos opcionales). */
export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: "El nombre no puede pasar de 200 caracteres" })
  name?: string;
  @IsOptional()
  @ValidateIf((o: { email?: string }) => !!o.email)
  @IsEmail({}, { message: "El email no tiene un formato válido" })
  @MaxLength(255, { message: "El email no puede pasar de 255 caracteres" })
  email?: string;
  @IsOptional()
  @IsString()
  // Un campo vacío significa "sin teléfono": solo se valida el formato de lo
  // que se haya escrito.
  @ValidateIf((o: { phone?: string }) => !!o.phone)
  @Matches(PATRON_TELEFONO, { message: MENSAJE_TELEFONO })
  @MaxLength(30, { message: "El teléfono no puede pasar de 30 caracteres" })
  phone?: string;
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: "El documento no puede pasar de 30 caracteres" })
  documento?: string;
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: "Las notas no pueden pasar de 1000 caracteres" })
  notes?: string;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}
