import {
  Controller,
  Post,
  Patch,
  Delete,
  Get,
  Param,
  Body,
  Req,
} from "@nestjs/common";
import { MembershipsService, MembershipActor } from "./memberships.service";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { CreateMembershipDto, UpdateRoleDto } from "./dto/membership.dto";

@Controller("memberships")
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Post()
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async create(@Body() dto: CreateMembershipDto, @Req() req: any) {
    const actor: MembershipActor = {
      userId: req.user.userId,
      role: req.user.role,
      businessId: req.businessId,
    };
    const businessId =
      req.user.role === Role.SUPER_ADMIN ? dto.businessId : req.businessId;
    return this.membershipsService.create(
      {
        userId: dto.userId,
        businessId,
        role: dto.role,
        invitedBy: req.user.userId,
      },
      actor
    );
  }

  @Patch(":id/role")
  @Roles(Role.OWNER, Role.SUPER_ADMIN)
  async updateRole(
    @Param("id") id: string,
    @Body() dto: UpdateRoleDto,
    @Req() req: any
  ) {
    const actor: MembershipActor = {
      userId: req.user.userId,
      role: req.user.role,
      businessId: req.businessId,
    };
    return this.membershipsService.updateRole(id, dto.role, actor);
  }

  @Delete(":id")
  @Roles(Role.OWNER, Role.SUPER_ADMIN)
  async deactivate(@Param("id") id: string, @Req() req: any) {
    const actor: MembershipActor = {
      userId: req.user.userId,
      role: req.user.role,
      businessId: req.businessId,
    };
    await this.membershipsService.deactivate(id, actor);
    return { message: "Membresía desactivada" };
  }

  @Get("business/:businessId")
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async findByBusiness(
    @Param("businessId") businessId: string,
    @Req() req: any
  ) {
    const actor: MembershipActor = {
      userId: req.user.userId,
      role: req.user.role,
      businessId: req.businessId,
    };
    return this.membershipsService.findByBusiness(businessId, actor);
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
