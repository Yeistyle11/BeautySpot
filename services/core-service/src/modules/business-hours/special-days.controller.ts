import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { SpecialDaysService } from "./special-days.service";
import { CreateSpecialDayDto } from "./dto/special-day.dto";

/** Festivos, vacaciones y jornadas con horario propio del negocio. */
@Roles(Role.OWNER, Role.ADMIN)
@Controller("business-hours/especiales")
export class SpecialDaysController {
  constructor(private readonly service: SpecialDaysService) {}

  @Get()
  async findAll(@BusinessId() businessId: string) {
    return this.service.findByBusiness(businessId);
  }

  @Post()
  async create(
    @BusinessId() businessId: string,
    @Body() dto: CreateSpecialDayDto
  ) {
    return this.service.create(businessId, dto);
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @BusinessId() businessId: string) {
    await this.service.remove(id, businessId);
    return { message: "Día especial eliminado" };
  }
}
