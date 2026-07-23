import { Controller, Post, Patch, Delete, Get, Param, Body } from "@nestjs/common";
import { MembershipsService, MembershipActor } from "./memberships.service";
import { Roles, BusinessId, CurrentUser } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { CreateMembershipDto, UpdateRoleDto } from "./dto/membership.dto";

@Controller("memberships")
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async create(
    @Body() dto: CreateMembershipDto,
    @CurrentUser("userId") userId: string,
    @CurrentUser("role") role: Role,
    @BusinessId() businessId: string
  ) {
    const actor: MembershipActor = { userId, role, businessId };
    // El SUPER_ADMIN puede crear membresías en cualquier negocio; el resto queda
    // acotado a su propio businessId.
    const targetBusinessId =
      role === Role.SUPER_ADMIN ? dto.businessId : businessId;
    return this.membershipsService.create(
      {
        userId: dto.userId,
        businessId: targetBusinessId,
        role: dto.role,
        invitedBy: userId,
      },
      actor
    );
  }

  @Patch(":id/role")
  @Roles(Role.OWNER, Role.SUPER_ADMIN)
  async updateRole(
    @Param("id") id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser("userId") userId: string,
    @CurrentUser("role") role: Role,
    @BusinessId() businessId: string
  ) {
    const actor: MembershipActor = { userId, role, businessId };
    return this.membershipsService.updateRole(id, dto.role, actor);
  }

  @Delete(":id")
  @Roles(Role.OWNER, Role.SUPER_ADMIN)
  async deactivate(
    @Param("id") id: string,
    @CurrentUser("userId") userId: string,
    @CurrentUser("role") role: Role,
    @BusinessId() businessId: string
  ) {
    const actor: MembershipActor = { userId, role, businessId };
    await this.membershipsService.deactivate(id, actor);
    return { message: "Membresía desactivada" };
  }

  @Get("business/:businessId")
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async findByBusiness(
    @Param("businessId") targetBusinessId: string,
    @CurrentUser("userId") userId: string,
    @CurrentUser("role") role: Role,
    @BusinessId() businessId: string
  ) {
    const actor: MembershipActor = { userId, role, businessId };
    return this.membershipsService.findByBusiness(targetBusinessId, actor);
  }
}

@Controller("internal/memberships")
export class InternalMembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  async create(@Body() dto: CreateMembershipDto & { invitedBy?: string }) {
    return this.membershipsService.create({
      userId: dto.userId,
      businessId: dto.businessId,
      role: dto.role,
      invitedBy: dto.invitedBy || dto.userId,
    });
  }
}
