import {
  IsString,
  IsOptional,
  MaxLength,
  Matches,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { applyDecorators } from "@nestjs/common";
import {
  URL_PREFIRMADA_MAXIMO_SEGUNDOS,
  URL_PREFIRMADA_MINIMO_SEGUNDOS,
} from "@beautyspot/shared-constants";

/**
 * Validez pedida para una URL prefirmada, en segundos. Numérica y acotada: era
 * texto libre, así que entraban tanto "999999999" como "abc", que llegaba a
 * AWS convertido en NaN.
 */
function ValidezPedida() {
  return applyDecorators(
    IsOptional(),
    Type(() => Number),
    IsInt(),
    Min(URL_PREFIRMADA_MINIMO_SEGUNDOS),
    Max(URL_PREFIRMADA_MAXIMO_SEGUNDOS)
  );
}

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

  @ValidezPedida()
  expiresIn?: number;
}

/** Clave de S3 de la imagen y validez de la URL de lectura. */
export class PresignedUrlQueryDto {
  @IsString()
  @MaxLength(500)
  key: string;

  @ValidezPedida()
  expiresIn?: number;
}
