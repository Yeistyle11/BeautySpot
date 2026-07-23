import { Controller, Get, Post, Delete, Param, Body } from "@nestjs/common";
import { BlockedSlotsService } from "./blocked-slots.service";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { CreateBlockedSlotDto } from "./dto/blocked-slot.dto";

@Roles(Role.OWNER, Role.ADMIN)
@Controller("professionals/:professionalId/blocked-slots")
export class BlockedSlotsController {
  constructor(private readonly service: BlockedSlotsService) {}

  @Get()
  async findAll(
    @Param("professionalId") professionalId: string,
    @BusinessId() businessId: string
  ) {
    return this.service.findByProfessional(businessId, professionalId);
  }

  @Post()
  async create(
    @Param("professionalId") professionalId: string,
    @BusinessId() businessId: string,
    @Body() dto: CreateBlockedSlotDto
  ) {
    return this.service.create(businessId, professionalId, dto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @BusinessId() businessId: string) {
    await this.service.remove(id, businessId);
    return { message: "Bloqueo eliminado" };
  }
}
