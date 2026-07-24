import { IsString, IsIn } from "class-validator";
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

/** Nuevo rol a asignar a una membresía existente. */
export class UpdateRoleDto {
  @IsIn(ASSIGNABLE_ROLES, { message: "No se puede asignar el rol SUPER_ADMIN" })
  role!: Role;
}
