import { IsEmail, IsString } from "class-validator";

/** Credenciales de inicio de sesión: email y contraseña. */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
