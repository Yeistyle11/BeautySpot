import { Controller, Get, Post, Delete, Param, Body, Req } from "@nestjs/common";
import { BlockedSlotsService } from "./blocked-slots.service";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { CreateBlockedSlotDto } from "./dto/blocked-slot.dto";

@Roles(Role.OWNER, Role.ADMIN)
@Controller("professionals/:professionalId/blocked-slots")
export class BlockedSlotsController {
  constructor(private readonly service: BlockedSlotsService) {}

  @Get()
  async findAll(@Param("professionalId") professionalId: string, @Req() req: any) {
    return this.service.findByProfessional(req.businessId, professionalId);
  }

  @Post()
  async create(@Param("professionalId") professionalId: string, @Req() req: any, @Body() dto: CreateBlockedSlotDto) {
    return this.service.create(req.businessId, professionalId, dto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @Req() req: any) {
    await this.service.remove(id, req.businessId);
    return { message: "Bloqueo eliminado" };
  }
}
