import { IsString, IsIn } from "class-validator";
import { Role } from "@beautyspot/shared-types";

export const ASSIGNABLE_ROLES: readonly Role[] = [
  Role.OWNER,
  Role.ADMIN,
  Role.PROFESSIONAL,
  Role.RECEPTIONIST,
  Role.CLIENT,
];

export class CreateMembershipDto {
  @IsString()
  userId!: string;

  @IsString()
  businessId!: string;

  @IsIn(ASSIGNABLE_ROLES, { message: "No se puede asignar el rol SUPER_ADMIN" })
  role!: Role;
}

export class UpdateRoleDto {
  @IsIn(ASSIGNABLE_ROLES, { message: "No se puede asignar el rol SUPER_ADMIN" })
  role!: Role;
}
