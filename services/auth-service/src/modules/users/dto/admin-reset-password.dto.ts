import { EsContrasenaValida } from "../../auth/dto/contrasena.decorator";

/** Nueva contraseña que un administrador fija para un miembro del staff. */
export class AdminResetPasswordDto {
  @EsContrasenaValida()
  newPassword!: string;
}
