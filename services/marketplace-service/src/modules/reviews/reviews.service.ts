import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ReviewEntity } from "../../entities/review.entity";
import { ReviewHelpfulEntity } from "../../entities/review-helpful.entity";
import { BusinessProfilesService } from "../business-profiles/business-profiles.service";
import { ProfessionalProfilesService } from "../professional-profiles/professional-profiles.service";
import { CreateReviewDto, ReviewQueryDto } from "./dto/review.dto";
import { EventBusService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";

export interface RatingDistribution {
  5: number; 4: number; 3: number; 2: number; 1: number;
}

export interface ReviewSummary {
  average: number;
  total: number;
  distribution: RatingDistribution;
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ReviewEntity)
    private readonly repo: Repository<ReviewEntity>,
    @InjectRepository(ReviewHelpfulEntity)
    private readonly helpfulRepo: Repository<ReviewHelpfulEntity>,
    private readonly profilesService: BusinessProfilesService,
    private readonly professionalProfilesService: ProfessionalProfilesService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(dto: CreateReviewDto): Promise<ReviewEntity> {
    // Validar una reseña por cita
    if (dto.appointmentId) {
      const existing = await this.repo.findOne({
        where: { appointmentId: dto.appointmentId },
      });
      if (existing) throw new ConflictException("Ya existe una reseña para esta cita");

      // Si viene de una cita, es verificada
      dto.photos = dto.photos?.slice(0, 3); // Max 3 fotos
    }

    // Si rating < 4 y no hay comentario, requerirlo
    if (dto.rating < 4 && !dto.comment) {
      throw new BadRequestException("El comentario es obligatorio para calificaciones menores a 4 estrellas");
    }

    const review = this.repo.create({
      ...dto,
      isVerified: !!dto.appointmentId,
    });
    const saved = await this.repo.save(review);

    // Actualizar rating del negocio
    await this.profilesService.updateRating(dto.businessId);

    // Actualizar rating del profesional si aplica
    if (dto.professionalId) {
      await this.professionalProfilesService.updateRating(dto.professionalId);
    }

    // Emitir evento de reseña creada
    this.eventBus.emit(EventNames.MARKETPLACE_REVIEW_CREATED, {
      reviewId: saved.id,
      businessId: dto.businessId,
      professionalId: dto.professionalId,
      clientId: dto.clientId,
      rating: dto.rating,
      comment: dto.comment,
      isVerified: saved.isVerified,
    });

    return saved;
  }

  async findByBusiness(businessId: string, query: ReviewQueryDto): Promise<{ items: ReviewEntity[]; total: number }> {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 50);
    const offset = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder("r")
      .where("r.business_id = :businessId", { businessId });

    if (query.rating) {
      qb.andWhere("r.rating = :rating", { rating: query.rating });
    }

    if (query.professionalId) {
      qb.andWhere("r.professional_id = :professionalId", { professionalId: query.professionalId });
    }

    if (query.withPhotos === "true") {
      qb.andWhere("r.photos IS NOT NULL");
      qb.andWhere("jsonb_array_length(r.photos) > 0");
    }

    qb.orderBy("r.created_at", "DESC");

    const [items, total] = await qb.skip(offset).take(limit).getManyAndCount();
    return { items, total };
  }

  async getSummary(businessId: string): Promise<ReviewSummary> {
    const reviews = await this.repo.find({ where: { businessId } });
    const total = reviews.length;

    const distribution: RatingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;

    for (const r of reviews) {
      const key = r.rating as keyof RatingDistribution;
      if (key in distribution) distribution[key]++;
      sum += r.rating;
    }

    return {
      average: total > 0 ? Math.round((sum / total) * 100) / 100 : 0,
      total,
      distribution,
    };
  }

  async findById(id: string): Promise<ReviewEntity> {
    const review = await this.repo.findOne({ where: { id } });
    if (!review) throw new NotFoundException("Reseña no encontrada");
    return review;
  }

  async respond(id: string, response: string): Promise<ReviewEntity> {
    const review = await this.findById(id);
    if (review.response) throw new BadRequestException("Esta reseña ya tiene respuesta");
    review.response = response;
    review.respondedAt = new Date();
    return this.repo.save(review);
  }

  async markHelpful(reviewId: string, userId: string): Promise<void> {
    const existing = await this.helpfulRepo.findOne({
      where: { reviewId, userId },
    });
    if (existing) return; // Ya voto, idempotente

    await this.helpfulRepo.save(this.helpfulRepo.create({ reviewId, userId }));
    // Increment atómico para evitar race conditions
    await this.repo.increment({ id: reviewId }, "helpfulCount", 1);
  }

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
