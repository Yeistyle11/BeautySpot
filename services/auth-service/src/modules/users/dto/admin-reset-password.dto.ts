import { IsString, MinLength } from "class-validator";

export class AdminResetPasswordDto {
  @IsString()
  @MinLength(8, {
    message: "La nueva contrasena debe tener al menos 8 caracteres",
  })
  newPassword!: string;
}
