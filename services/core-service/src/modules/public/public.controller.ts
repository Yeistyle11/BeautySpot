import { Controller, Get, Param, Query } from "@nestjs/common";
import { Public } from "@beautyspot/nest-common";
import { PublicService } from "./public.service";

@Public()
@Controller("public")
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get("businesses")
  async listBusinesses(@Query("q") q?: string, @Query("city") city?: string) {
    return this.publicService.listBusinesses(q, city);
  }

  @Get("businesses/slug/:slug")
  async getBusinessBySlug(@Param("slug") slug: string) {
    return this.publicService.getBusinessBySlug(slug);
  }

  @Get("businesses/:id/services")
  async getBusinessServices(@Param("id") businessId: string) {
    return this.publicService.getBusinessServices(businessId);
  }

  @Get("businesses/:id/professionals")
  async getBusinessProfessionals(@Param("id") businessId: string) {
    return this.publicService.getBusinessProfessionals(businessId);
  }
}
