import { IsEmail, IsString, MinLength, IsOptional } from "class-validator";

/** Datos para registrar una cuenta nueva: email, contraseña, nombre y teléfono. */
export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
