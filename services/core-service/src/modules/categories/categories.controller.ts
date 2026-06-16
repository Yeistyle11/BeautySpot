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
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post()
  async create(@Req() req: any, @Body() dto: CreateCategoryDto) {
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
    // Si hay paginación, usar el endpoint paginado
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

    // Sin paginación: listar todas (comportamiento anterior)
    return this.service.findByBusiness(
      req.businessId,
      active !== "false",
    );
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
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.update(id, req.businessId, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Delete(":id")
  async remove(@Param("id") id: string, @Req() req: any) {
    await this.service.remove(id, req.businessId);
    return { message: "Categoría desactivada" };
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Patch(":id/toggle")
  async toggleActive(@Param("id") id: string, @Req() req: any) {
    return this.service.toggleActive(id, req.businessId);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Patch(":id/professionals-count")
  async getProfessionalsCount(@Param("id") id: string, @Req() req: any) {
    const count = await this.service.countProfessionals(id, req.businessId);
    return { count };
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
