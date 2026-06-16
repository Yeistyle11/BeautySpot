import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
} from "@nestjs/common";
import { ServiceCategoriesService } from "./service-categories.service";
import { CreateServiceCategoryDto, UpdateServiceCategoryDto } from "./dto/service-category.dto";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

@Controller("service-categories")
export class ServiceCategoriesController {
  constructor(private readonly service: ServiceCategoriesService) {}

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post()
  async create(@Req() req: any, @Body() dto: CreateServiceCategoryDto) {
    return this.service.create(req.businessId, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.PROFESSIONAL, Role.RECEPTIONIST)
  @Get()
  async findAll(
    @Req() req: any,
    @Query("active") active?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    if (page || limit) {
      const p = Math.max(1, parseInt(page || "1", 10));
      const l = Math.min(100, Math.max(1, parseInt(limit || "20", 10)));
      return this.service.findPaginated(
        req.businessId,
        {
          page: p,
          limit: l,
          offset: (p - 1) * l,
          sort: "sortOrder",
          order: "ASC",
        },
        active === "true" ? true : active === "false" ? false : undefined,
        search,
      );
    }

    return this.service.findByBusiness(req.businessId, active !== "false");
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.PROFESSIONAL, Role.RECEPTIONIST)
  @Get(":id")
  async findById(@Param("id") id: string, @Req() req: any) {
    return this.service.findById(id, req.businessId);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Req() req: any,
    @Body() dto: UpdateServiceCategoryDto,
  ) {
    return this.service.update(id, req.businessId, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Delete(":id")
  async remove(@Param("id") id: string, @Req() req: any) {
    await this.service.remove(id, req.businessId);
    return { message: "Categoría de servicio desactivada" };
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Patch(":id/toggle")
  async toggleActive(@Param("id") id: string, @Req() req: any) {
    return this.service.toggleActive(id, req.businessId);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post("reorder")
  async reorder(
    @Req() req: any,
    @Body() body: { items: { id: string; sortOrder: number }[] },
  ) {
    await this.service.reorder(req.businessId, body.items);
    return { message: "Orden actualizado" };
  }
}
