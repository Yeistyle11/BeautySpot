import { IsString, MinLength } from "class-validator";

/** Datos para cambiar la contraseña propia: la actual y la nueva. */
export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
