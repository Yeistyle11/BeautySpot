import { IsEmail, IsString, IsOptional, MinLength } from "class-validator";

export class UpdateStaffDto {
  @IsOptional() @IsString()
  @MinLength(2, { message: "El nombre debe tener al menos 2 caracteres" })
  name?: string;

  @IsOptional() @IsEmail({}, { message: "El email no es valido" })
  email?: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsString()
  avatar?: string;
}
