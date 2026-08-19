import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository, InjectDataSource } from "@nestjs/typeorm";
import { Repository, DataSource, EntityManager, In } from "typeorm";
import { paginate, PaginateParams } from "@beautyspot/database";
import { IPaginatedResponse } from "@beautyspot/shared-types";
import { ReviewEntity, ReviewStatus } from "../../entities/review.entity";
import { ReviewHelpfulEntity } from "../../entities/review-helpful.entity";
import {
  ReviewReportEntity,
  ReviewReportReason,
} from "../../entities/review-report.entity";
import { BusinessProfilesService } from "../business-profiles/business-profiles.service";
import { ProfessionalProfilesService } from "../professional-profiles/professional-profiles.service";
import { InternalHttpClient, OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import {
  CreateReviewDto,
  ReviewQueryDto,
  UpdateReviewDto,
} from "./dto/review.dto";

/** Código de Postgres para violación de restricción única. */
const VIOLACION_DE_UNICIDAD = "23505";

/** Conteo de reseñas por número de estrellas (1 a 5). */
export interface RatingDistribution {
  5: number;
  4: number;
  3: number;
  2: number;
  1: number;
}

/** Resumen de reseñas de un negocio: promedio, total y distribución por estrellas. */
export interface ReviewSummary {
  average: number;
  total: number;
  distribution: RatingDistribution;
}

/**
 * Gestiona las reseñas del marketplace: alta con reglas de negocio, respuestas,
 * votos de utilidad y actualización de las calificaciones agregadas.
 */
@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ReviewEntity)
    private readonly repo: Repository<ReviewEntity>,
    @InjectRepository(ReviewHelpfulEntity)
    private readonly helpfulRepo: Repository<ReviewHelpfulEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly profilesService: BusinessProfilesService,
    private readonly professionalProfilesService: ProfessionalProfilesService,
    private readonly outbox: OutboxService,
    private readonly http: InternalHttpClient
  ) {}

  /**
   * Crea una resena del usuario indicado (una por cita, con comentario si baja
   * de 4 estrellas), recalcula las medias y emite REVIEW_CREATED.
   */
  async create(dto: CreateReviewDto, clientId: string): Promise<ReviewEntity> {
    const existing = await this.repo.findOne({
      where: { appointmentId: dto.appointmentId },
    });
    if (existing)
      throw new ConflictException("Ya existe una reseña para esta cita");

    // Si rating < 4 y no hay comentario, requerirlo
    if (dto.rating < 4 && !dto.comment) {
      throw new BadRequestException(
        "El comentario es obligatorio para calificaciones menores a 4 estrellas"
      );
    }

    // El profesional sale de la cita, no del cuerpo: quien reseña no elige a
    // quién califica.
    const cita = await this.verificarCita(dto, clientId);
    const professionalId = cita.professionalId;

    const review = this.repo.create({
      ...dto,
      professionalId,
      serviceName: dto.serviceName ?? cita.servicios?.join(", "),
      clientId,
      isVerified: true,
    });

    // El findOne de arriba no basta: dos altas simultáneas lo pasan las dos y
    // es el índice único quien las separa.
    const saved = await this.guardarReseña(
      review,
      dto,
      clientId,
      professionalId
    ).catch((error: unknown) => {
      if ((error as { code?: string })?.code === VIOLACION_DE_UNICIDAD) {
        throw new ConflictException("Ya existe una reseña para esta cita");
      }
      throw error;
    });

    // Tras confirmar: dentro de la transaccion alargaria los bloqueos con una
    // conversacion con Redis.
    await this.profilesService.invalidarCache(dto.businessId);

    return saved;
  }

  /**
   * Modifica la reseña del propio autor. La cita y el negocio no se tocan: eso
   * la convertiría en otra reseña distinta.
   */
  async update(
    id: string,
    clientId: string,
    dto: UpdateReviewDto
  ): Promise<ReviewEntity> {
    const review = await this.reseñaPropia(id, clientId);

    const rating = dto.rating ?? review.rating;
    const comment = dto.comment ?? review.comment;
    if (rating < 4 && !comment) {
      throw new BadRequestException(
        "El comentario es obligatorio para calificaciones menores a 4 estrellas"
      );
    }

    Object.assign(review, dto, { editedAt: new Date() });

    const guardada = await this.dataSource.transaction(async (manager) => {
      const actualizada = await manager
        .getRepository(ReviewEntity)
        .save(review);
      await this.recalcularMedias(actualizada, manager);
      return actualizada;
    });

    await this.profilesService.invalidarCache(review.businessId);
    return guardada;
  }

  /**
   * Borra la reseña del propio autor. El índice único por cita queda libre, así
   * que puede volver a escribirla.
   */
  async remove(id: string, clientId: string): Promise<void> {
    const review = await this.reseñaPropia(id, clientId);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ReviewEntity).delete({ id });
      await this.recalcularMedias(review, manager);
    });

    await this.profilesService.invalidarCache(review.businessId);
  }

  /** Registra la denuncia de un usuario sobre una reseña, una por usuario. */
  async denunciar(
    id: string,
    userId: string,
    datos: { reason: ReviewReportReason; detalle?: string }
  ): Promise<{ denunciada: true }> {
    const review = await this.repo.findOne({ where: { id } });
    if (!review) throw new NotFoundException("Reseña no encontrada");

    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(ReviewReportEntity).insert({
          reviewId: id,
          userId,
          reason: datos.reason,
          detalle: datos.detalle ?? null,
        });
        await manager
          .getRepository(ReviewEntity)
          .increment({ id }, "reportCount", 1);
      });
    } catch (error: unknown) {
      if ((error as { code?: string })?.code !== VIOLACION_DE_UNICIDAD) {
        throw error;
      }
    }

    return { denunciada: true };
  }

  /** Oculta o vuelve a publicar una reseña del negocio y recalcula las medias. */
  async moderar(
    id: string,
    businessId: string,
    status: ReviewStatus
  ): Promise<ReviewEntity> {
    const review = await this.reseñaDelNegocio(id, businessId);
    review.status = status;

    const guardada = await this.dataSource.transaction(async (manager) => {
      const actualizada = await manager
        .getRepository(ReviewEntity)
        .save(review);
      await this.recalcularMedias(actualizada, manager);
      return actualizada;
    });

    await this.profilesService.invalidarCache(businessId);
    return guardada;
  }

  /** Reseña existente que pertenece a quien la pide; si no, 403. */
  private async reseñaPropia(
    id: string,
    clientId: string
  ): Promise<ReviewEntity> {
    const review = await this.repo.findOne({ where: { id } });
    if (!review) throw new NotFoundException("Reseña no encontrada");
    if (review.clientId !== clientId) {
      throw new ForbiddenException("Solo puedes tocar tus propias reseñas");
    }
    return review;
  }

  /** Recalcula la media del negocio y la del profesional de la reseña. */
  private async recalcularMedias(
    review: ReviewEntity,
    manager: EntityManager
  ): Promise<void> {
    await this.profilesService.updateRating(review.businessId, manager);
    if (review.professionalId) {
      await this.professionalProfilesService.updateRating(
        review.professionalId,
        manager
      );
    }
  }

  /** Persiste la reseña, recalcula las medias y emite el evento, todo en una transacción. */
  private async guardarReseña(
    review: ReviewEntity,
    dto: CreateReviewDto,
    clientId: string,
    professionalId?: string
  ): Promise<ReviewEntity> {
    return this.dataSource.transaction(async (manager) => {
      const guardada = await manager.getRepository(ReviewEntity).save(review);

      await this.profilesService.updateRating(dto.businessId, manager);

      if (professionalId) {
        await this.professionalProfilesService.updateRating(
          professionalId,
          manager
        );
      }

      await this.outbox.enqueue(manager, {
        eventType: EventNames.MARKETPLACE_REVIEW_CREATED,
        aggregateType: "review",
        aggregateId: guardada.id,
        payload: {
          reviewId: guardada.id,
          businessId: dto.businessId,
          professionalId,
          clientId,
          rating: dto.rating,
          comment: dto.comment,
          isVerified: guardada.isVerified,
        },
      });

      return guardada;
    });
  }

  /**
   * Exige a booking que la cita exista, sea de este usuario y de este negocio,
   * y este atendida; si booking no responde, el alta falla.
   */
  private async verificarCita(
    dto: CreateReviewDto,
    clientId: string
  ): Promise<{ professionalId?: string; servicios?: string[] }> {
    const parametros = new URLSearchParams({
      userId: clientId,
      businessId: dto.businessId,
    });
    const respuesta = await this.http.pedir<{
      resenable: boolean;
      professionalId?: string;
      servicios?: string[];
    }>(
      "booking",
      `/internal/appointments/${dto.appointmentId}/resenable?${parametros}`
    );

    if (respuesta?.resenable !== true) {
      throw new ForbiddenException(
        "Solo puedes reseñar una cita tuya que ya se haya atendido"
      );
    }

    return respuesta;
  }

  /** Lista las reseñas de un negocio con filtros (estrellas, profesional, con fotos) y paginación. */
  async findByBusiness(
    businessId: string,
    query: ReviewQueryDto
  ): Promise<{ items: ReviewEntity[]; total: number }> {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const offset = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder("r")
      .where("r.business_id = :businessId", { businessId })
      .andWhere("r.status = :publicada", {
        publicada: ReviewStatus.PUBLICADA,
      });

    if (query.rating) {
      qb.andWhere("r.rating = :rating", { rating: query.rating });
    }

    if (query.professionalId) {
      qb.andWhere("r.professional_id = :professionalId", {
        professionalId: query.professionalId,
      });
    }

    if (query.withPhotos === "true") {
      qb.andWhere("r.photos IS NOT NULL");
      qb.andWhere("jsonb_array_length(r.photos) > 0");
    }

    qb.orderBy("r.created_at", "DESC");

    const [items, total] = await qb.skip(offset).take(limit).getManyAndCount();
    return { items, total };
  }

  /**
   * Resumen de resenas de un negocio: promedio, total y distribucion por
   * estrellas, calculada con un GROUP BY rating.
   */
  async getSummary(businessId: string): Promise<ReviewSummary> {
    const rows = await this.repo
      .createQueryBuilder("r")
      .select("r.rating", "rating")
      .addSelect("COUNT(*)", "count")
      .where("r.business_id = :businessId", { businessId })
      .groupBy("r.rating")
      .getRawMany<{ rating: number; count: string }>();

    const distribution: RatingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let total = 0;
    let sum = 0;

    for (const row of rows) {
      const rating = Number(row.rating);
      const count = Number(row.count);
      const key = rating as keyof RatingDistribution;
      if (key in distribution) distribution[key] = count;
      total += count;
      sum += rating * count;
    }

    return {
      average: total > 0 ? Math.round((sum / total) * 100) / 100 : 0,
      total,
      distribution,
    };
  }

  /** Obtiene una reseña por id; lanza 404 si no existe. */
  async findById(id: string): Promise<ReviewEntity> {
    const review = await this.repo.findOne({ where: { id } });
    if (!review) throw new NotFoundException("Reseña no encontrada");
    return review;
  }

  /**
   * Reseñas escritas por el usuario autenticado. `clientId` guarda el id de
   * usuario del token, el mismo que recibe `create`.
   */
  async findByClientUser(
    userId: string,
    pagination: PaginateParams,
    appointmentIds?: string[]
  ): Promise<IPaginatedResponse<ReviewEntity>> {
    // Una lista de citas vacía no es "sin filtro": es que no hay ninguna por la
    // que preguntar, y devolver el historial entero sería justo lo contrario.
    const where = appointmentIds
      ? { clientId: userId, appointmentId: In(appointmentIds) }
      : { clientId: userId };

    return paginate(this.repo, pagination, {
      where,
      order: { createdAt: "DESC" },
    });
  }

  /** Reseñas asociadas a una cita; el listado del cliente comprueba si ya opinó. */
  async findByAppointment(appointmentId: string): Promise<ReviewEntity[]> {
    return this.repo.find({
      where: { appointmentId },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Registra la respuesta del negocio a una reseña suya; rechaza si ya tiene
   * una.
   */
  async respond(
    id: string,
    businessId: string,
    response: string
  ): Promise<ReviewEntity> {
    const review = await this.repo.findOne({ where: { id, businessId } });
    if (!review) throw new NotFoundException("Reseña no encontrada");
    if (review.response)
      throw new BadRequestException("Esta reseña ya tiene respuesta");
    review.response = response;
    review.respondedAt = new Date();
    return this.repo.save(review);
  }

  /** Reescribe la respuesta del negocio a una reseña ya respondida. */
  async editarRespuesta(
    id: string,
    businessId: string,
    response: string
  ): Promise<ReviewEntity> {
    const review = await this.reseñaDelNegocio(id, businessId);
    if (!review.response) {
      throw new BadRequestException("Esta reseña todavía no tiene respuesta");
    }
    review.response = response;
    review.respondedAt = new Date();
    return this.repo.save(review);
  }

  /** Retira la respuesta del negocio; la reseña se queda como estaba. */
  async borrarRespuesta(id: string, businessId: string): Promise<ReviewEntity> {
    const review = await this.reseñaDelNegocio(id, businessId);
    review.response = null;
    review.respondedAt = null;
    return this.repo.save(review);
  }

  /** Reseña que pertenece al negocio indicado; si no, 404. */
  private async reseñaDelNegocio(
    id: string,
    businessId: string
  ): Promise<ReviewEntity> {
    const review = await this.repo.findOne({ where: { id, businessId } });
    if (!review) throw new NotFoundException("Reseña no encontrada");
    return review;
  }

  /** Marca una reseña como útil por parte de un usuario (idempotente). */
  async markHelpful(reviewId: string, userId: string): Promise<void> {
    const existing = await this.helpfulRepo.findOne({
      where: { reviewId, userId },
    });
    if (existing) return; // Ya voto, idempotente

    await this.helpfulRepo.save(this.helpfulRepo.create({ reviewId, userId }));
    // Increment atómico para evitar race conditions
    await this.repo.increment({ id: reviewId }, "helpfulCount", 1);
  }

  /** Quita el voto de "útil" de un usuario sobre una reseña (idempotente). */
  async unmarkHelpful(reviewId: string, userId: string): Promise<void> {
    const existing = await this.helpfulRepo.findOne({
      where: { reviewId, userId },
    });
    if (!existing) return;

    await this.helpfulRepo.remove(existing);
    // Decrement atómico con protección contra valores negativos
    await this.repo.decrement({ id: reviewId }, "helpfulCount", 1);
  }
}
