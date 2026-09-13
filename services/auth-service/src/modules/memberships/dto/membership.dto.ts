import { IsString, IsIn, IsOptional } from "class-validator";
import { Role } from "@beautyspot/shared-types";

/** Roles que un administrador puede asignar; SUPER_ADMIN queda excluido a propósito. */
export const ASSIGNABLE_ROLES: readonly Role[] = [
  Role.OWNER,
  Role.ADMIN,
  Role.PROFESSIONAL,
  Role.RECEPTIONIST,
  Role.CLIENT,
];

/** Datos para crear una membresía: usuario, negocio y rol a asignar. */
export class CreateMembershipDto {
  @IsString()
  userId!: string;

  @IsString()
  businessId!: string;

  @IsIn(ASSIGNABLE_ROLES, { message: "No se puede asignar el rol SUPER_ADMIN" })
  role!: Role;
}

/**
 * Alta de membresía pedida por otro servicio. `invitedBy` va declarado aquí y
 * no añadido con una intersección: de un tipo intersección TypeScript emite
 * `Object` como metadato, y con ese el ValidationPipe se salta el handler
 * entero —ni el rol asignable, ni los campos de más—.
 */
export class CrearMembresiaInternaDto extends CreateMembershipDto {
  @IsOptional()
  @IsString()
  invitedBy?: string;
}

/** Nuevo rol a asignar a una membresía existente. */
export class UpdateRoleDto {
  @IsIn(ASSIGNABLE_ROLES, { message: "No se puede asignar el rol SUPER_ADMIN" })
  role!: Role;
}
