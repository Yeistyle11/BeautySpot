import { IsString, IsEnum } from "class-validator";
import { Role } from "@beautyspot/shared-types";

export class CreateMembershipDto {
  @IsString()
  userId!: string;

  @IsString()
  businessId!: string;

  @IsEnum(Role)
  role!: Role;
}

export class UpdateRoleDto {
  @IsEnum(Role)
  role!: Role;
}
