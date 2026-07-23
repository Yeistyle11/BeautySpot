import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post()
  async create(@BusinessId() businessId: string, @Body() dto: CreateCategoryDto) {
    return this.service.create(businessId, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.PROFESSIONAL, Role.RECEPTIONIST)
  @Get()
  async findAll(
    @BusinessId() businessId: string,
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
        businessId,
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
      businessId,
      active !== "false",
    );
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.PROFESSIONAL, Role.RECEPTIONIST)
  @Get(":id")
  async findById(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.findById(id, businessId);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.service.update(id, businessId, dto);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Delete(":id")
  async remove(@Param("id") id: string, @BusinessId() businessId: string) {
    await this.service.remove(id, businessId);
    return { message: "Categoría desactivada" };
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Patch(":id/toggle")
  async toggleActive(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.toggleActive(id, businessId);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Patch(":id/professionals-count")
  async getProfessionalsCount(@Param("id") id: string, @BusinessId() businessId: string) {
    const count = await this.service.countProfessionals(id, businessId);
    return { count };
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post("reorder")
  async reorder(
    @BusinessId() businessId: string,
    @Body() body: { items: { id: string; sortOrder: number }[] },
  ) {
    await this.service.reorder(businessId, body.items);
    return { message: "Orden actualizado" };
  }
}
