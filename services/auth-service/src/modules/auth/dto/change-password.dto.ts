import { IsString } from "class-validator";
import { EsContrasenaValida } from "./contrasena.decorator";

/** Datos para cambiar la contraseña propia: la actual y la nueva. */
export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @EsContrasenaValida()
  newPassword!: string;
}
