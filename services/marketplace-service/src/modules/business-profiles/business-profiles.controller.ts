import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from "@nestjs/common";
import { BusinessProfilesService } from "./business-profiles.service";
import {
  UpsertProfileDto,
  UpdateProfileConfigDto,
  AddGalleryImagesDto,
  UpdateGalleryImageDto,
} from "./dto/profile.dto";
import { Roles, Public, BusinessId } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

/** Endpoints con los que el dueño configura y publica el perfil de su negocio en el marketplace. */
@Controller("business-profiles")
export class BusinessProfilesController {
  constructor(private readonly service: BusinessProfilesService) {}

  /** Devuelve el perfil del negocio del usuario. */
  @Get()
  @Roles(Role.OWNER, Role.ADMIN)
  async findMyProfile(@BusinessId() businessId: string) {
    return this.service.findByBusinessId(businessId);
  }

  /** Actualiza la configuración del perfil inmersivo. */
  @Put("config")
  @Roles(Role.OWNER, Role.ADMIN)
  async updateConfig(
    @BusinessId() businessId: string,
    @Body() dto: UpdateProfileConfigDto
  ) {
    return this.service.updateConfig(businessId, dto);
  }

  /** Añade imágenes a la galería del perfil. */
  @Post("gallery")
  @Roles(Role.OWNER, Role.ADMIN)
  async addGalleryImages(
    @BusinessId() businessId: string,
    @Body() dto: AddGalleryImagesDto
  ) {
    return this.service.addGalleryImages(businessId, dto);
  }

  /** Actualiza los metadatos de una imagen de la galería. */
  @Put("gallery")
  @Roles(Role.OWNER, Role.ADMIN)
  async updateGalleryImage(
    @BusinessId() businessId: string,
    @Body() dto: UpdateGalleryImageDto
  ) {
    return this.service.updateGalleryImage(businessId, dto);
  }

  /** Elimina una imagen de la galería por su índice. */
  @Delete("gallery/:index")
  @Roles(Role.OWNER, Role.ADMIN)
  async removeGalleryImage(
    @BusinessId() businessId: string,
    @Param("index") index: number
  ) {
    return this.service.removeGalleryImage(businessId, index);
  }

  /** Publica el perfil en el marketplace. */
  @Post("publish")
  @Roles(Role.OWNER, Role.ADMIN)
  async publish(@BusinessId() businessId: string) {
    return this.service.publish(businessId);
  }

  /** Retira el perfil del marketplace. */
  @Post("unpublish")
  @Roles(Role.OWNER, Role.ADMIN)
  async unpublish(@BusinessId() businessId: string) {
    return this.service.unpublish(businessId);
  }
}

/** Endpoint interno con el que el core sincroniza el perfil del negocio en el marketplace. */
@Controller("internal/business-profiles")
@Public()
export class InternalBusinessProfilesController {
  constructor(private readonly service: BusinessProfilesService) {}

  /** Crea o actualiza el perfil a partir de los datos del core-service. */
  @Post("sync")
  async createOrUpdate(@Body() dto: UpsertProfileDto) {
    return this.service.createOrUpdate(dto);
  }

  /** Obtiene un perfil por su id interno. */
  @Get("id/:id")
  async findById(@Param("id") id: string) {
    return this.service.findById(id);
  }
}

/** Endpoints públicos (sin token) que sirven el perfil del negocio y de sus profesionales. */
@Controller("profiles")
@Public()
export class PublicProfilesController {
  constructor(private readonly service: BusinessProfilesService) {}

  /** Devuelve el perfil público de un negocio por su slug. */
  @Get(":slug")
  async findBySlug(@Param("slug") slug: string) {
    return this.service.findBySlug(slug);
  }

  /** Devuelve el perfil público de un profesional dentro de un negocio. */
  @Get(":slug/professionals/:professionalSlug")
  async findProfessionalBySlug(
    @Param("slug") slug: string,
    @Param("professionalSlug") professionalSlug: string
  ) {
    return this.service.findProfessionalBySlug(slug, professionalSlug);
  }
}
