import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  Matches,
  ValidateIf,
} from "class-validator";
import {
  PATRON_TELEFONO,
  MENSAJE_TELEFONO,
} from "@beautyspot/shared-constants";

/** Datos para registrar una cuenta nueva: email, contraseña, nombre y teléfono. */
export class RegisterDto {
  @IsEmail({}, { message: "El email no tiene un formato válido" })
  email!: string;

  @IsString({ message: "La contraseña es obligatoria" })
  @MinLength(8, { message: "La contraseña debe tener al menos 8 caracteres" })
  password!: string;

  @IsString({ message: "El nombre es obligatorio" })
  @MinLength(2, { message: "El nombre debe tener al menos 2 caracteres" })
  name!: string;

  @IsOptional()
  @IsString()
  // Un campo vacío significa "sin teléfono": solo se valida lo que se escriba.
  @ValidateIf((o: { phone?: string }) => !!o.phone)
  @Matches(PATRON_TELEFONO, { message: MENSAJE_TELEFONO })
  phone?: string;
}
