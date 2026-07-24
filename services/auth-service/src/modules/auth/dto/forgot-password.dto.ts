import { IsEmail } from "class-validator";

/** Email al que enviar las instrucciones de recuperación de contraseña. */
export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}
