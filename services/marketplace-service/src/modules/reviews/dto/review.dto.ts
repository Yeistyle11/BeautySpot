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
  ArrayMaxSize,
  IsEnum,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { MAX_PAGE } from "@beautyspot/shared-utils";
import { ReviewEntity, ReviewStatus } from "../../../entities/review.entity";
import { ReviewReportReason } from "../../../entities/review-report.entity";

/** Fotos que admite una reseña. */
export const MAXIMO_FOTOS = 3;

/**
 * Datos para crear una resena: la cita resenada, la calificacion, el
 * comentario y las fotos. El autor sale del token y el profesional, de la cita.
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
  @ArrayMaxSize(MAXIMO_FOTOS, {
    message: `No se pueden adjuntar más de ${MAXIMO_FOTOS} fotos`,
  })
  @IsUrl({}, { each: true })
  photos?: string[];
}

/**
 * Cambios que el autor puede hacer sobre su reseña. Ni la cita ni el negocio se
 * pueden mover: eso convertiría la reseña en otra distinta.
 */
export class UpdateReviewDto {
  @IsOptional() @IsNumber() @Min(1) @Max(5) rating?: number;

  @IsOptional() @IsString() @MaxLength(1000) comment?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAXIMO_FOTOS, {
    message: `No se pueden adjuntar más de ${MAXIMO_FOTOS} fotos`,
  })
  @IsUrl({}, { each: true })
  photos?: string[];
}

/** Texto de la respuesta del negocio a una reseña. */
export class RespondReviewDto {
  @IsString() @MaxLength(500) response!: string;
}

/** Filtros de listado de reseñas: página, estrellas, profesional y si tienen fotos. */
export class ReviewQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(MAX_PAGE)
  page?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(50) limit?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(5) rating?: number;

  @IsOptional() withPhotos?: string;

  @IsOptional() @IsString() professionalId?: string;
}

/** Tope de citas por consulta; el listado del cliente pinta como mucho una página. */
const MAXIMO_CITAS = 200;

/**
 * Filtros del listado propio del cliente. `appointmentIds` llega como lista
 * separada por comas y se acota.
 */
export class MisResenasQueryDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string"
      ? value
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, MAXIMO_CITAS)
      : undefined
  )
  @IsArray()
  @IsUUID("4", { each: true, message: "Cada id de cita debe ser un UUID" })
  appointmentIds?: string[];
}

/** Denuncia de una reseña. */
export class ReportReviewDto {
  @IsEnum(ReviewReportReason, { message: "El motivo no es válido" })
  reason!: ReviewReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "El detalle no puede pasar de 500 caracteres" })
  detalle?: string;
}

/** Nueva visibilidad de una reseña. */
export class ModerarReviewDto {
  @IsEnum(ReviewStatus, { message: "El estado no es válido" })
  status!: ReviewStatus;
}

/**
 * Reseña tal y como se sirve al público: sin el vínculo con el usuario que la
 * escribió, la cita que la originó ni el recuento de denuncias, que son
 * internos del negocio y de la moderación.
 */
export interface ResenaPublica {
  id: string;
  businessId: string;
  professionalId: string | null;
  rating: number;
  comment: string | null;
  response: string | null;
  respondedAt: Date | null;
  editedAt: Date | null;
  serviceName: string | null;
  professionalName: string | null;
  photos: string[] | null;
  isVerified: boolean;
  helpfulCount: number;
  createdAt: Date;
}

/** Proyecta la reseña guardada a lo que se publica de ella. */
export function aResenaPublica(review: ReviewEntity): ResenaPublica {
  return {
    id: review.id,
    businessId: review.businessId,
    professionalId: review.professionalId ?? null,
    rating: review.rating,
    comment: review.comment ?? null,
    response: review.response,
    respondedAt: review.respondedAt,
    editedAt: review.editedAt,
    serviceName: review.serviceName ?? null,
    professionalName: review.professionalName ?? null,
    photos: review.photos,
    isVerified: review.isVerified,
    helpfulCount: review.helpfulCount,
    createdAt: review.createdAt,
  };
}
