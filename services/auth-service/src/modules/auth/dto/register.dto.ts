import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  ValidateIf,
} from "class-validator";
import {
  PATRON_TELEFONO,
  MENSAJE_TELEFONO,
} from "@beautyspot/shared-constants";
import { EsContrasenaValida } from "./contrasena.decorator";

/** Datos para registrar una cuenta nueva: email, contraseña, nombre y teléfono. */
export class RegisterDto {
  @IsEmail({}, { message: "El email no tiene un formato válido" })
  email!: string;

  @EsContrasenaValida()
  password!: string;

  @IsString({ message: "El nombre es obligatorio" })
  @MinLength(2, { message: "El nombre debe tener al menos 2 caracteres" })
  @MaxLength(120, { message: "El nombre no puede pasar de 120 caracteres" })
  name!: string;

  @IsOptional()
  @IsString()
  // Un campo vacío significa "sin teléfono": solo se valida lo que se escriba.
  @ValidateIf((o: { phone?: string }) => !!o.phone)
  @Matches(PATRON_TELEFONO, { message: MENSAJE_TELEFONO })
  phone?: string;
}
