import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from "@nestjs/common";
import { ServiceCategoriesService } from "./service-categories.service";
import {
  CreateServiceCategoryDto,
  UpdateServiceCategoryDto,
} from "./dto/service-category.dto";
import { Roles, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

/** Endpoints de categorías de servicios; la lectura la comparten todos los roles del negocio. */
@Controller("service-categories")
export class ServiceCategoriesController {
  constructor(private readonly service: ServiceCategoriesService) {}

  /** Crea una categoría de servicio. */
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post()
  async create(
    @BusinessId() businessId: string,
    @Body() dto: CreateServiceCategoryDto
  ) {
    return this.service.create(businessId, dto);
  }

  /** Lista las categorías de servicio; modo paginado si llegan page/limit, o completo si no. */
  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.PROFESSIONAL,
    Role.RECEPTIONIST
  )
  @Get()
  async findAll(
    @BusinessId() businessId: string,
    @Query("active") active?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
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
        search
      );
    }

    return this.service.findByBusiness(businessId, active !== "false");
  }

  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.PROFESSIONAL,
    Role.RECEPTIONIST
  )
  /** Obtiene una categoría de servicio por id. */
  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.PROFESSIONAL,
    Role.RECEPTIONIST
  )
  @Get(":id")
  async findById(@Param("id") id: string, @BusinessId() businessId: string) {
    return this.service.findById(id, businessId);
  }

  /** Actualiza una categoría de servicio. */
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @BusinessId() businessId: string,
    @Body() dto: UpdateServiceCategoryDto
  ) {
    return this.service.update(id, businessId, dto);
  }

  /** Da de baja una categoría de servicio. */
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Delete(":id")
  async remove(@Param("id") id: string, @BusinessId() businessId: string) {
    await this.service.remove(id, businessId);
    return { message: "Categoría de servicio desactivada" };
  }

  /** Alterna el estado activo/inactivo de una categoría de servicio. */
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Patch(":id/toggle")
  async toggleActive(
    @Param("id") id: string,
    @BusinessId() businessId: string
  ) {
    return this.service.toggleActive(id, businessId);
  }

  /** Aplica un nuevo orden a las categorías de servicio. */
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post("reorder")
  async reorder(
    @BusinessId() businessId: string,
    @Body() body: { items: { id: string; sortOrder: number }[] }
  ) {
    await this.service.reorder(businessId, body.items);
    return { message: "Orden actualizado" };
  }
}
