import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsArray,
  IsUrl,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";

/** Datos para crear una reseña: negocio/profesional, cita, calificación, comentario y fotos. */
export class CreateReviewDto {
  @IsString() businessId!: string;

  @IsOptional() @IsString() appointmentId?: string;

  @IsString() clientId!: string;

  @IsOptional() @IsString() professionalId?: string;

  @IsNumber() @Min(1) @Max(5) rating!: number;

  @IsOptional() @IsString() @MaxLength(1000) comment?: string;

  // Campos enriquecidos
  @IsOptional() @IsString() serviceName?: string;

  @IsOptional() @IsString() professionalName?: string;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  photos?: string[];
}

/** Texto de la respuesta del negocio a una reseña. */
export class RespondReviewDto {
  @IsString() @MaxLength(500) response!: string;
}

/** Filtros de listado de reseñas: página, estrellas, profesional y si tienen fotos. */
export class ReviewQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(50) limit?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(5) rating?: number;

  @IsOptional() withPhotos?: string;

  @IsOptional() @IsString() professionalId?: string;
}
