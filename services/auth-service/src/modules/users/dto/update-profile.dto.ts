import { IsString, IsOptional } from "class-validator";

/** Campos editables del perfil propio: nombre, teléfono y avatar. */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
