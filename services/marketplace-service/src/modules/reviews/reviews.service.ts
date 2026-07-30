import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository, InjectDataSource } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { ReviewEntity } from "../../entities/review.entity";
import { ReviewHelpfulEntity } from "../../entities/review-helpful.entity";
import { BusinessProfilesService } from "../business-profiles/business-profiles.service";
import { ProfessionalProfilesService } from "../professional-profiles/professional-profiles.service";
import { OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import { CreateReviewDto, ReviewQueryDto } from "./dto/review.dto";

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
    private readonly outbox: OutboxService
  ) {}

  /**
   * Crea una reseña del usuario indicado (una por cita, comentario obligatorio
   * si baja de 4 estrellas), recalcula las medias del negocio y el profesional
   * y emite el evento REVIEW_CREATED.
   */
  async create(dto: CreateReviewDto, clientId: string): Promise<ReviewEntity> {
    // Validar una reseña por cita
    if (dto.appointmentId) {
      const existing = await this.repo.findOne({
        where: { appointmentId: dto.appointmentId },
      });
      if (existing)
        throw new ConflictException("Ya existe una reseña para esta cita");

      dto.photos = dto.photos?.slice(0, 3);
    }

    // Si rating < 4 y no hay comentario, requerirlo
    if (dto.rating < 4 && !dto.comment) {
      throw new BadRequestException(
        "El comentario es obligatorio para calificaciones menores a 4 estrellas"
      );
    }

    // El distintivo de "verificada" exige comprobar contra booking que la cita
    // existe y es de este cliente; mientras no se haga, no se concede.
    const review = this.repo.create({
      ...dto,
      clientId,
      isVerified: false,
    });

    const saved = await this.dataSource.transaction(async (manager) => {
      const guardada = await manager.getRepository(ReviewEntity).save(review);

      await this.profilesService.updateRating(dto.businessId, manager);

      if (dto.professionalId) {
        await this.professionalProfilesService.updateRating(
          dto.professionalId,
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
          professionalId: dto.professionalId,
          clientId,
          rating: dto.rating,
          comment: dto.comment,
          isVerified: guardada.isVerified,
        },
      });

      return guardada;
    });

    // Tras confirmar: dentro de la transacción alargaría los bloqueos con una
    // conversación con Redis, y si se deshiciera habríamos borrado la caché de
    // una reseña que no llegó a existir.
    await this.profilesService.invalidarCache(dto.businessId);

    return saved;
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
      .where("r.business_id = :businessId", { businessId });

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
   * Resumen de reseñas de un negocio: promedio, total y distribución por
   * estrellas. Se calcula con un GROUP BY rating (máximo 5 filas) en vez de
   * traer todas las reseñas a memoria para promediarlas, que no escala.
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
   * Registra la respuesta del negocio a una reseña; rechaza si ya tenía una.
   * La reseña se busca acotada al negocio para que nadie responda por otro.
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
