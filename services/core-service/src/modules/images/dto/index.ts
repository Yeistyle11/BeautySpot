import { IsString, IsOptional, MaxLength, Matches } from "class-validator";

/** Datos para subir el logo de un negocio: id, tipo de imagen y nombre opcional. */
export class UploadBusinessLogoDto {
  @IsString()
  @MaxLength(50)
  businessId: string;

  @Matches(/^(image\/jpeg|image\/jpg|image\/png|image\/webp|image\/gif)$/)
  contentType: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;
}

/** Datos para subir la foto de un profesional: id, tipo de imagen y nombre opcional. */
export class UploadProfessionalPhotoDto {
  @IsString()
  @MaxLength(50)
  professionalId: string;

  @Matches(/^(image\/jpeg|image\/jpg|image\/png|image\/webp|image\/gif)$/)
  contentType: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;
}

/** Datos para subir la imagen de un servicio: id, tipo de imagen y nombre opcional. */
export class UploadServiceImageDto {
  @IsString()
  @MaxLength(50)
  serviceId: string;

  @Matches(/^(image\/jpeg|image\/jpg|image\/png|image\/webp|image\/gif)$/)
  contentType: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;
}

/** Datos para pedir una URL presignada: tipo y id del recurso, tipo de imagen y vencimiento. */
export class GenerateUploadSignatureDto {
  @Matches(/^(business-logo|professional-photo|service-image)$/)
  resourceType: "business-logo" | "professional-photo" | "service-image";

  @IsString()
  @MaxLength(50)
  resourceId: string;

  @Matches(/^(image\/jpeg|image\/jpg|image\/png|image\/webp|image\/gif)$/)
  contentType: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  expiresIn?: string;
}

/** Clave de S3 de la imagen a eliminar. */
export class DeleteImageDto {
  @IsString()
  key: string;
}
