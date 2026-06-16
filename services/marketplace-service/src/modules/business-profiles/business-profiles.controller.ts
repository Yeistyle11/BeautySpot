import { Controller, Get, Post, Put, Delete, Param, Body, Req } from "@nestjs/common";
import { BusinessProfilesService } from "./business-profiles.service";
import { UpsertProfileDto, UpdateProfileConfigDto, AddGalleryImagesDto, UpdateGalleryImageDto } from "./dto/profile.dto";
import { Roles, Public } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

@Controller("business-profiles")
export class BusinessProfilesController {
  constructor(private readonly service: BusinessProfilesService) {}

  // --- Perfil del negocio actual (por businessId del token) ---

  @Get()
  @Roles(Role.OWNER, Role.ADMIN)
  async findMyProfile(@Req() req: any) {
    return this.service.findByBusinessId(req.businessId);
  }

  // --- Sincronizacion desde core-service (interno) ---

  @Post()
  @Public()
  async createOrUpdate(@Body() dto: UpsertProfileDto) {
    return this.service.createOrUpdate(dto);
  }

  // --- Configuracion del perfil inmersivo ---

  @Put("config")
  @Roles(Role.OWNER, Role.ADMIN)
  async updateConfig(@Req() req: any, @Body() dto: UpdateProfileConfigDto) {
    return this.service.updateConfig(req.businessId, dto);
  }

  // --- Galeria ---

  @Post("gallery")
  @Roles(Role.OWNER, Role.ADMIN)
  async addGalleryImages(@Req() req: any, @Body() dto: AddGalleryImagesDto) {
    return this.service.addGalleryImages(req.businessId, dto);
  }

  @Put("gallery")
  @Roles(Role.OWNER, Role.ADMIN)
  async updateGalleryImage(@Req() req: any, @Body() dto: UpdateGalleryImageDto) {
    return this.service.updateGalleryImage(req.businessId, dto);
  }

  @Delete("gallery/:index")
  @Roles(Role.OWNER, Role.ADMIN)
  async removeGalleryImage(@Req() req: any, @Param("index") index: number) {
    return this.service.removeGalleryImage(req.businessId, index);
  }

  // --- Publicacion ---

  @Post("publish")
  @Roles(Role.OWNER, Role.ADMIN)
  async publish(@Req() req: any) {
    return this.service.publish(req.businessId);
  }

  @Post("unpublish")
  @Roles(Role.OWNER, Role.ADMIN)
  async unpublish(@Req() req: any) {
    return this.service.unpublish(req.businessId);
  }

  // --- Consulta por ID (interno) ---

  @Get("id/:id")
  @Public()
  async findById(@Param("id") id: string) {
    return this.service.findById(id);
  }
}

// --- Controlador publico: perfiles visibles en el marketplace ---

@Controller("profiles")
@Public()
export class PublicProfilesController {
  constructor(private readonly service: BusinessProfilesService) {}

  @Get(":slug")
  async findBySlug(@Param("slug") slug: string) {
    return this.service.findBySlug(slug);
  }

  @Get(":slug/professionals/:professionalSlug")
  async findProfessionalBySlug(
    @Param("slug") slug: string,
    @Param("professionalSlug") professionalSlug: string,
  ) {
    return this.service.findProfessionalBySlug(slug, professionalSlug);
  }
}
