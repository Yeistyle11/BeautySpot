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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { Roles } from '@beautyspot/nest-common';
import { Role } from '@beautyspot/shared-types';
import { ImagesService, UploadResult } from './images.service';
import { GenerateUploadSignatureDto, DeleteImageDto } from './dto';

@Controller('images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post('businesses/:businessId/logo-upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBusinessLogo(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ success: true; data: UploadResult }> {
    if (!file) {
      throw new BadRequestException('Archivo no proporcionado');
    }

    this.imagesService.validateImageFile(file.buffer, file.mimetype);

    const result = await this.imagesService.uploadBusinessLogo(
      req.params.businessId as string,
      file.buffer,
      file.mimetype,
    );

    return { success: true, data: result };
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post('professionals/:professionalId/photo-upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProfessionalPhoto(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ success: true; data: UploadResult }> {
    if (!file) {
      throw new BadRequestException('Archivo no proporcionado');
    }

    this.imagesService.validateImageFile(file.buffer, file.mimetype);

    const result = await this.imagesService.uploadProfessionalPhoto(
      req.params.professionalId as string,
      file.buffer,
      file.mimetype,
    );

    return { success: true, data: result };
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Post('services/:serviceId/image-upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadServiceImage(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ success: true; data: UploadResult }> {
    if (!file) {
      throw new BadRequestException('Archivo no proporcionado');
    }

    this.imagesService.validateImageFile(file.buffer, file.mimetype);

    const result = await this.imagesService.uploadServiceImage(
      req.params.serviceId as string,
      file.buffer,
      file.mimetype,
    );

    return { success: true, data: result };
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Get('upload-signature')
  async generateUploadSignature(
    @Body() dto: GenerateUploadSignatureDto,
  ): Promise<{ success: true; data: any }> {
    const expiresIn = dto.expiresIn ? parseInt(dto.expiresIn) : 3600;

    let result;

    switch (dto.resourceType) {
      case 'business-logo':
        result = await this.imagesService.generatePresignedUploadUrlForBusinessLogo(
          dto.resourceId,
          dto.contentType,
          expiresIn,
        );
        break;
      case 'professional-photo':
        result = await this.imagesService.generatePresignedUploadUrlForProfessionalPhoto(
          dto.resourceId,
          dto.contentType,
          expiresIn,
        );
        break;
      case 'service-image':
        result = await this.imagesService.generatePresignedUploadUrlForServiceImage(
          dto.resourceId,
          dto.contentType,
          expiresIn,
        );
        break;
      default:
        throw new BadRequestException('Tipo de recurso no válido');
    }

    return { success: true, data: result };
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  @Delete(':publicId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteImage(@Body() dto: DeleteImageDto): Promise<void> {
    await this.imagesService.deleteImage(dto.key);
  }

  @Roles(Role.OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.PROFESSIONAL, Role.RECEPTIONIST)
  @Get('presigned-url')
  async getPresignedUrl(
    @Body() body: { key: string; expiresIn?: string },
  ): Promise<{ success: true; data: { url: string } }> {
    const expiresIn = body.expiresIn ? parseInt(body.expiresIn) : 3600;
    const url = await this.imagesService.getImageUrl(body.key, expiresIn);
    return { success: true, data: { url } };
  }
}