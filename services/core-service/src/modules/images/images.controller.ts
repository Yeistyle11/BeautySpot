import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { ImagesService, UploadResult } from "./images.service";
import { ProfessionalsService } from "../professionals/professionals.service";
import { ServicesService } from "../services/services.service";
import { GenerateUploadSignatureDto, DeleteImageDto } from "./dto";

@Controller("images")
export class ImagesController {
  constructor(
    private readonly imagesService: ImagesService,
    private readonly professionalsService: ProfessionalsService,
    private readonly servicesService: ServicesService
  ) {}

  /** Verifica ownership del recurso. SUPER_ADMIN bypass. */
  private async verifyResourceOwnership(
    resourceType: string,
    resourceId: string,
    req: any
  ): Promise<void> {
    if (req.user?.role === Role.SUPER_ADMIN) return;
    const businessId: string | undefined = req.businessId;
    if (!businessId) {
      throw new ForbiddenException(
        "No se pudo determinar el negocio del usuario"
      );
    }

    switch (resourceType) {
      case "businesses":
        if (resourceId !== businessId) {
          throw new ForbiddenException("No tienes acceso a este negocio");
        }
        break;
      case "professionals":
        await this.professionalsService.findById(resourceId, businessId);
        break;
      case "services":
        await this.servicesService.findById(resourceId, businessId);
        break;
      default:
        throw new BadRequestException("Tipo de recurso no válido");
    }
  }

  /** Verifica ownership de un S3 key (para delete/presigned-url). */
  private async verifyKeyOwnership(key: string, req: any): Promise<void> {
    if (req.user?.role === Role.SUPER_ADMIN) return;

    // Key format: businesses/{id}/logo/{uuid} | professionals/{id}/photo/{uuid} | services/{id}/image/{uuid}
    const parts = key.split("/");
    if (parts.length < 2) {
      throw new ForbiddenException("Key de imagen no válido");
    }

    const resourceType = parts[0]; // "businesses" | "professionals" | "services"
    const resourceId = parts[1];
    await this.verifyResourceOwnership(resourceType, resourceId, req);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post("businesses/:businessId/logo-upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadBusinessLogo(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File
  ): Promise<{ success: true; data: UploadResult }> {
    if (!file) {
      throw new BadRequestException("Archivo no proporcionado");
    }

    const businessId = req.params.businessId as string;
    await this.verifyResourceOwnership("businesses", businessId, req);

    this.imagesService.validateImageFile(file.buffer, file.mimetype);

    const result = await this.imagesService.uploadBusinessLogo(
      businessId,
      file.buffer,
      file.mimetype
    );

    return { success: true, data: result };
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post("professionals/:professionalId/photo-upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadProfessionalPhoto(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File
  ): Promise<{ success: true; data: UploadResult }> {
    if (!file) {
      throw new BadRequestException("Archivo no proporcionado");
    }

    const professionalId = req.params.professionalId as string;
    await this.verifyResourceOwnership("professionals", professionalId, req);

    this.imagesService.validateImageFile(file.buffer, file.mimetype);

    const result = await this.imagesService.uploadProfessionalPhoto(
      professionalId,
      file.buffer,
      file.mimetype
    );

    return { success: true, data: result };
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post("services/:serviceId/image-upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadServiceImage(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File
  ): Promise<{ success: true; data: UploadResult }> {
    if (!file) {
      throw new BadRequestException("Archivo no proporcionado");
    }

    const serviceId = req.params.serviceId as string;
    await this.verifyResourceOwnership("services", serviceId, req);

    this.imagesService.validateImageFile(file.buffer, file.mimetype);

    const result = await this.imagesService.uploadServiceImage(
      serviceId,
      file.buffer,
      file.mimetype
    );

    return { success: true, data: result };
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Get("upload-signature")
  async generateUploadSignature(
    @Req() req: any,
    @Body() dto: GenerateUploadSignatureDto
  ): Promise<{ success: true; data: any }> {
    const expiresIn = dto.expiresIn ? parseInt(dto.expiresIn) : 3600;

    // Map resourceType to S3 key prefix + verify ownership
    const resourceMap: Record<string, { prefix: string; verifyAs: string }> = {
      "business-logo": { prefix: "businesses", verifyAs: "businesses" },
      "professional-photo": {
        prefix: "professionals",
        verifyAs: "professionals",
      },
      "service-image": { prefix: "services", verifyAs: "services" },
    };

    const mapping = resourceMap[dto.resourceType];
    if (!mapping) {
      throw new BadRequestException("Tipo de recurso no válido");
    }

    await this.verifyResourceOwnership(mapping.verifyAs, dto.resourceId, req);

    let result;
    switch (dto.resourceType) {
      case "business-logo":
        result =
          await this.imagesService.generatePresignedUploadUrlForBusinessLogo(
            dto.resourceId,
            dto.contentType,
            expiresIn
          );
        break;
      case "professional-photo":
        result =
          await this.imagesService.generatePresignedUploadUrlForProfessionalPhoto(
            dto.resourceId,
            dto.contentType,
            expiresIn
          );
        break;
      case "service-image":
        result =
          await this.imagesService.generatePresignedUploadUrlForServiceImage(
            dto.resourceId,
            dto.contentType,
            expiresIn
          );
        break;
      default:
        throw new BadRequestException("Tipo de recurso no válido");
    }

    return { success: true, data: result };
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Delete(":publicId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteImage(
    @Req() req: any,
    @Body() dto: DeleteImageDto
  ): Promise<void> {
    await this.verifyKeyOwnership(dto.key, req);
    await this.imagesService.deleteImage(dto.key);
  }

  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.PROFESSIONAL,
    Role.RECEPTIONIST
  )
  @Get("presigned-url")
  async getPresignedUrl(
    @Req() req: any,
    @Body() body: { key: string; expiresIn?: string }
  ): Promise<{ success: true; data: { url: string } }> {
    await this.verifyKeyOwnership(body.key, req);
    const expiresIn = body.expiresIn ? parseInt(body.expiresIn) : 3600;
    const url = await this.imagesService.getImageUrl(body.key, expiresIn);
    return { success: true, data: { url } };
  }
}
