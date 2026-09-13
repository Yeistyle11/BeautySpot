import { IsString } from "class-validator";
import { EsContrasenaValida } from "./contrasena.decorator";

/** Token de recuperación y la nueva contraseña a establecer. */
export class ResetPasswordDto {
  @IsString()
  token!: string;

  @EsContrasenaValida()
  newPassword!: string;
}

/** Token de recuperación del que solo se pregunta si sigue sirviendo. */
export class ValidarTokenDto {
  @IsString()
  token!: string;
}
