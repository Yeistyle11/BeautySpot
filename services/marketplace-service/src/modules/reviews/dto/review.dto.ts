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
import { ReviewStatus } from "../../../entities/review.entity";
import { ReviewReportReason } from "../../../entities/review-report.entity";

/** Fotos que admite una reseña. */
export const MAXIMO_FOTOS = 3;

/**
 * Datos para crear una reseña: la cita reseñada, la calificación, el comentario
 * y las fotos.
 *
 * Ni el autor ni el profesional viajan aquí: el primero sale del token y el
 * segundo de la cita, para que quien escribe no elija a quién califica.
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
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(50) limit?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(5) rating?: number;

  @IsOptional() withPhotos?: string;

  @IsOptional() @IsString() professionalId?: string;
}

/** Tope de citas por consulta; el listado del cliente pinta como mucho una página. */
const MAXIMO_CITAS = 200;

/**
 * Filtros del listado propio del cliente.
 *
 * `appointmentIds` sirve para marcar en pantalla qué citas ya tienen reseña sin
 * traerse el historial entero; llega como lista separada por comas y se acota,
 * porque sin tope un `?appointmentIds=` largo arma un `IN (...)` de miles de
 * elementos con una sola petición.
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
