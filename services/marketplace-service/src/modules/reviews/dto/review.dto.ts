import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsArray,
  IsUrl,
  IsUUID,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * Datos para crear una reseña: la cita reseñada, la calificación, el comentario
 * y las fotos.
 *
 * Ni el autor ni el profesional viajan aquí: el primero sale del token y el
 * segundo de la cita. Dejar que los pusiera quien escribe permitía colgarle un
 * 1 estrella al profesional que se quisiera, o reseñar sin haber ido nunca.
 */
export class CreateReviewDto {
  @IsString() businessId!: string;

  /** Obligatoria: sin cita atendida no hay reseña. */
  @IsUUID() appointmentId!: string;

  @IsNumber() @Min(1) @Max(5) rating!: number;

  @IsOptional() @IsString() @MaxLength(1000) comment?: string;

  @IsOptional() @IsString() serviceName?: string;

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
