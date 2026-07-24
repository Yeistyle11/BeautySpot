import { Controller, Get, Param, Query } from "@nestjs/common";
import { Public } from "@beautyspot/nest-common";
import { PublicService } from "./public.service";

/** Endpoints públicos (sin token) para el escaparate de negocios del marketplace. */
@Public()
@Controller("public")
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  /** Lista negocios activos, con filtro por nombre y ciudad. */
  @Get("businesses")
  async listBusinesses(@Query("q") q?: string, @Query("city") city?: string) {
    return this.publicService.listBusinesses(q, city);
  }

  /** Devuelve el perfil público de un negocio por su slug. */
  @Get("businesses/slug/:slug")
  async getBusinessBySlug(@Param("slug") slug: string) {
    return this.publicService.getBusinessBySlug(slug);
  }

  /** Lista los servicios públicos de un negocio. */
  @Get("businesses/:id/services")
  async getBusinessServices(@Param("id") businessId: string) {
    return this.publicService.getBusinessServices(businessId);
  }

  /** Lista los profesionales públicos de un negocio. */
  @Get("businesses/:id/professionals")
  async getBusinessProfessionals(@Param("id") businessId: string) {
    return this.publicService.getBusinessProfessionals(businessId);
  }
}
