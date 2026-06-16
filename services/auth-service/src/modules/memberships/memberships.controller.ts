import { Controller, Post, Patch, Delete, Get, Param, Body } from "@nestjs/common";
import { MembershipsService } from "./memberships.service";
import { Roles, CurrentUser } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { CreateMembershipDto, UpdateRoleDto } from "./dto/membership.dto";

@Controller("memberships")
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async create(@Body() dto: CreateMembershipDto, @CurrentUser("userId") userId: string) {
    return this.membershipsService.create({ ...dto, invitedBy: userId });
  }

  @Patch(":id/role")
  @Roles(Role.OWNER, Role.SUPER_ADMIN)
  async updateRole(
    @Param("id") id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser("role") requesterRole: Role,
  ) {
    return this.membershipsService.updateRole(id, dto.role, requesterRole);
  }

  @Delete(":id")
  @Roles(Role.OWNER, Role.SUPER_ADMIN)
  async deactivate(@Param("id") id: string) {
    await this.membershipsService.deactivate(id);
    return { message: "Membresía desactivada" };
  }

  @Get("business/:businessId")
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async findByBusiness(@Param("businessId") businessId: string) {
    return this.membershipsService.findByBusiness(businessId);
  }
}

/** Internal endpoint — protegido por InternalSecretGuard (requiere header x-internal-secret) */
@Controller("internal/memberships")
export class InternalMembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  async create(@Body() dto: CreateMembershipDto & { invitedBy?: string }) {
    return this.membershipsService.create({ ...dto, invitedBy: dto.invitedBy || dto.userId });
  }
}
