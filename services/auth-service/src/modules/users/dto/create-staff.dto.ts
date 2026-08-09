import {
  IsEmail,
  IsString,
  IsOptional,
  IsIn,
  MinLength,
} from "class-validator";
import { Role } from "@beautyspot/shared-types";
import { ASSIGNABLE_ROLES } from "../../memberships/dto/membership.dto";
import { EsContrasenaValida } from "../../auth/dto/contrasena.decorator";

/** Datos para que un admin cree una cuenta de staff y su membresía en el negocio. */
export class CreateStaffDto {
  @IsEmail({}, { message: "El email no es valido" })
  email!: string;

  @EsContrasenaValida()
  password!: string;

  @IsString()
  @MinLength(2, { message: "El nombre debe tener al menos 2 caracteres" })
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsIn(ASSIGNABLE_ROLES, { message: "No se puede asignar el rol SUPER_ADMIN" })
  role!: Role;

  @IsOptional()
  @IsString()
  professionalId?: string;
}
