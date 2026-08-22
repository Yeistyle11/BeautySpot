import {
  Controller,
  Post,
  Delete,
  Get,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Roles, BusinessId, CurrentUser } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";
import { URL_PREFIRMADA_SEGUNDOS } from "@beautyspot/shared-constants";
import {
  ImagesService,
  UploadResult,
  MAXIMO_BYTES_IMAGEN,
} from "./images.service";
import { ProfessionalsService } from "../professionals/professionals.service";
import { ServicesService } from "../services/services.service";
import { GenerateUploadSignatureDto, PresignedUrlQueryDto } from "./dto";

/**
 * Recepción del archivo, que multer corta en cuanto supera el tamaño máximo en
 * vez de cargarlo entero en memoria.
 */
const SUBIDA_DE_IMAGEN = FileInterceptor("file", {
  limits: { fileSize: MAXIMO_BYTES_IMAGEN, files: 1 },
});

/** Contexto de autorización derivado del usuario autenticado y su tenant. */
interface OwnershipContext {
  role: string;
  businessId?: string;
}

/**
 * Endpoints de subida y borrado de imágenes (logo, foto de profesional, imagen
 * de servicio), verificando que el recurso pertenezca al negocio del usuario.
 */
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
    ctx: OwnershipContext
  ): Promise<void> {
    if (ctx.role === Role.SUPER_ADMIN) return;
    if (!ctx.businessId) {
      throw new ForbiddenException(
        "No se pudo determinar el negocio del usuario"
      );
    }

    switch (resourceType) {
      case "businesses":
        if (resourceId !== ctx.businessId) {
          throw new ForbiddenException("No tienes acceso a este negocio");
        }
        break;
      case "professionals":
        await this.professionalsService.findById(resourceId, ctx.businessId);
        break;
      case "services":
        await this.servicesService.findById(resourceId, ctx.businessId);
        break;
      default:
        throw new BadRequestException("Tipo de recurso no válido");
    }
  }

  /**
   * Verifica que una clave de S3 sea del negocio del usuario, rechazando las
   * que traen `..` en algún segmento.
   */
  private async verifyKeyOwnership(
    key: string,
    ctx: OwnershipContext
  ): Promise<void> {
    // Formato del key: {tipo}/{id}/... — p. ej. businesses/{id}/logo/{uuid}.
    const parts = key.split("/");
    if (parts.length < 2 || parts.some((parte) => parte === "..")) {
      throw new ForbiddenException("Key de imagen no válido");
    }

    if (ctx.role === Role.SUPER_ADMIN) return;

    await this.verifyResourceOwnership(parts[0], parts[1], ctx);
  }

  /** Sube el logo de un negocio (multipart) tras validar acceso y tipo/tamaño. */
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post("businesses/:businessId/logo-upload")
  @UseInterceptors(SUBIDA_DE_IMAGEN)
  async uploadBusinessLogo(
    @Param("businessId") businessId: string,
    @CurrentUser("role") role: string,
    @BusinessId() tenantBusinessId: string,
    @UploadedFile() file: Express.Multer.File
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException("Archivo no proporcionado");
    }

    await this.verifyResourceOwnership("businesses", businessId, {
      role,
      businessId: tenantBusinessId,
    });

    this.imagesService.validateImageFile(file.buffer, file.mimetype);

    const result = await this.imagesService.uploadBusinessLogo(
      businessId,
      file.buffer,
      file.mimetype
    );

    return result;
  }

  /** Sube la foto de un profesional (multipart) tras validar acceso y tipo/tamaño. */
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post("professionals/:professionalId/photo-upload")
  @UseInterceptors(SUBIDA_DE_IMAGEN)
  async uploadProfessionalPhoto(
    @Param("professionalId") professionalId: string,
    @CurrentUser("role") role: string,
    @BusinessId() tenantBusinessId: string,
    @UploadedFile() file: Express.Multer.File
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException("Archivo no proporcionado");
    }

    await this.verifyResourceOwnership("professionals", professionalId, {
      role,
      businessId: tenantBusinessId,
    });

    this.imagesService.validateImageFile(file.buffer, file.mimetype);

    const result = await this.imagesService.uploadProfessionalPhoto(
      professionalId,
      file.buffer,
      file.mimetype
    );

    return result;
  }

  /** Sube la imagen de un servicio (multipart) tras validar acceso y tipo/tamaño. */
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post("services/:serviceId/image-upload")
  @UseInterceptors(SUBIDA_DE_IMAGEN)
  async uploadServiceImage(
    @Param("serviceId") serviceId: string,
    @CurrentUser("role") role: string,
    @BusinessId() tenantBusinessId: string,
    @UploadedFile() file: Express.Multer.File
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException("Archivo no proporcionado");
    }

    await this.verifyResourceOwnership("services", serviceId, {
      role,
      businessId: tenantBusinessId,
    });

    this.imagesService.validateImageFile(file.buffer, file.mimetype);

    const result = await this.imagesService.uploadServiceImage(
      serviceId,
      file.buffer,
      file.mimetype
    );

    return result;
  }

  /** Genera una URL presignada para que el cliente suba la imagen directo a S3. */
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Get("upload-signature")
  async generateUploadSignature(
    @CurrentUser("role") role: string,
    @BusinessId() tenantBusinessId: string,
    @Query() dto: GenerateUploadSignatureDto
  ) {
    const expiresIn = dto.expiresIn ?? URL_PREFIRMADA_SEGUNDOS;

    // Mapea el tipo de recurso a su prefijo en S3 y verifica el acceso al recurso.
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

    await this.verifyResourceOwnership(mapping.verifyAs, dto.resourceId, {
      role,
      businessId: tenantBusinessId,
    });

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

    return result;
  }

  /** Borra una imagen de S3 tras verificar que su key pertenezca al negocio. */
  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Delete(":publicId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteImage(
    @CurrentUser("role") role: string,
    @BusinessId() tenantBusinessId: string,
    @Param("publicId") publicId: string
  ): Promise<void> {
    const key = decodeURIComponent(publicId);
    await this.verifyKeyOwnership(key, {
      role,
      businessId: tenantBusinessId,
    });
    await this.imagesService.deleteImage(key);
  }

  /** Devuelve una URL presignada de lectura para una imagen del negocio. */
  @Roles(
    Role.OWNER,
    Role.ADMIN,
    Role.SUPER_ADMIN,
    Role.PROFESSIONAL,
    Role.RECEPTIONIST
  )
  @Get("presigned-url")
  async getPresignedUrl(
    @CurrentUser("role") role: string,
    @BusinessId() tenantBusinessId: string,
    @Query() query: PresignedUrlQueryDto
  ): Promise<{ url: string }> {
    await this.verifyKeyOwnership(query.key, {
      role,
      businessId: tenantBusinessId,
    });
    const expiresIn = query.expiresIn ?? URL_PREFIRMADA_SEGUNDOS;
    const url = await this.imagesService.getImageUrl(query.key, expiresIn);
    return { url };
  }
}
