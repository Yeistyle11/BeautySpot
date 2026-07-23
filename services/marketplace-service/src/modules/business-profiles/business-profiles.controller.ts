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

@Controller("business-profiles")
export class BusinessProfilesController {
  constructor(private readonly service: BusinessProfilesService) {}

  @Get()
  @Roles(Role.OWNER, Role.ADMIN)
  async findMyProfile(@BusinessId() businessId: string) {
    return this.service.findByBusinessId(businessId);
  }

  @Put("config")
  @Roles(Role.OWNER, Role.ADMIN)
  async updateConfig(
    @BusinessId() businessId: string,
    @Body() dto: UpdateProfileConfigDto
  ) {
    return this.service.updateConfig(businessId, dto);
  }

  @Post("gallery")
  @Roles(Role.OWNER, Role.ADMIN)
  async addGalleryImages(
    @BusinessId() businessId: string,
    @Body() dto: AddGalleryImagesDto
  ) {
    return this.service.addGalleryImages(businessId, dto);
  }

  @Put("gallery")
  @Roles(Role.OWNER, Role.ADMIN)
  async updateGalleryImage(
    @BusinessId() businessId: string,
    @Body() dto: UpdateGalleryImageDto
  ) {
    return this.service.updateGalleryImage(businessId, dto);
  }

  @Delete("gallery/:index")
  @Roles(Role.OWNER, Role.ADMIN)
  async removeGalleryImage(
    @BusinessId() businessId: string,
    @Param("index") index: number
  ) {
    return this.service.removeGalleryImage(businessId, index);
  }

  @Post("publish")
  @Roles(Role.OWNER, Role.ADMIN)
  async publish(@BusinessId() businessId: string) {
    return this.service.publish(businessId);
  }

  @Post("unpublish")
  @Roles(Role.OWNER, Role.ADMIN)
  async unpublish(@BusinessId() businessId: string) {
    return this.service.unpublish(businessId);
  }
}

@Controller("internal/business-profiles")
@Public()
export class InternalBusinessProfilesController {
  constructor(private readonly service: BusinessProfilesService) {}

  @Post("sync")
  async createOrUpdate(@Body() dto: UpsertProfileDto) {
    return this.service.createOrUpdate(dto);
  }

  @Get("id/:id")
  async findById(@Param("id") id: string) {
    return this.service.findById(id);
  }
}

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
    @Param("professionalSlug") professionalSlug: string
  ) {
    return this.service.findProfessionalBySlug(slug, professionalSlug);
  }
}
