import { IsString, MinLength } from "class-validator";

/** Token de recuperación y la nueva contraseña a establecer. */
export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
