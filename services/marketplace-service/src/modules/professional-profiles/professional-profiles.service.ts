import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager } from "typeorm";
import { generateSlug } from "@beautyspot/shared-utils";
import { ProfessionalProfileEntity } from "../../entities/professional-profile.entity";
import {
  SyncProfessionalDto,
  UpdateProfessionalProfileDto,
} from "./dto/professional-profile.dto";

/**
 * Gestiona el perfil público de los profesionales en el marketplace: sincronía
 * desde el core, ajustes del negocio, visibilidad y métricas de valoración.
 */
@Injectable()
export class ProfessionalProfilesService {
  constructor(
    @InjectRepository(ProfessionalProfileEntity)
    private readonly repo: Repository<ProfessionalProfileEntity>
  ) {}

  // --- Sincronizacion desde core-service ---

  /** Crea o actualiza el perfil de un profesional con los datos del core, generándole un slug único. */
  async syncFromCore(
    dto: SyncProfessionalDto
  ): Promise<ProfessionalProfileEntity> {
    const existing = await this.repo.findOne({
      where: { professionalId: dto.professionalId },
    });

    if (existing) {
      existing.name = dto.name;
      existing.photo = dto.photo ?? existing.photo;
      existing.bio = dto.bio ?? existing.bio;
      existing.specialties = dto.specialties ?? existing.specialties;
      existing.yearsExp = dto.yearsExp ?? existing.yearsExp;
      return this.repo.save(existing);
    }

    // Generar slug unico a partir del nombre
    const slug = await this.ensureUniqueSlug(dto.name, dto.businessId);

    return this.repo.save(
      this.repo.create({
        ...dto,
        slug,
        specialties: dto.specialties || [],
        yearsExp: dto.yearsExp || 0,
      })
    );
  }

  /** Oculta y desactiva el perfil cuando el profesional se da de baja en el core. */
  async deactivateFromCore(professionalId: string): Promise<void> {
    await this.repo.update(
      { professionalId },
      { active: false, visibleOnProfile: false }
    );
  }

  // --- Actualizacion desde el panel del negocio ---

  /** Actualiza los campos que el negocio controla del perfil (tagline, portafolio, redes, visibilidad). */
  async updateProfile(
    professionalId: string,
    businessId: string,
    dto: UpdateProfessionalProfileDto
  ): Promise<ProfessionalProfileEntity> {
    const profile = await this.repo.findOne({
      where: { professionalId, businessId },
    });
    if (!profile)
      throw new NotFoundException("Perfil de profesional no encontrado");

    if (dto.tagline !== undefined) profile.tagline = dto.tagline;
    if (dto.portfolio !== undefined) profile.portfolio = dto.portfolio;
    if (dto.socialInstagram !== undefined)
      profile.socialInstagram = dto.socialInstagram;
    if (dto.visibleOnProfile !== undefined)
      profile.visibleOnProfile = dto.visibleOnProfile;

    return this.repo.save(profile);
  }

  // --- Visibilidad en el marketplace ---

  /** Muestra u oculta al profesional en el perfil público del negocio. */
  async toggleVisibility(
    professionalId: string,
    businessId: string,
    visible: boolean
  ): Promise<ProfessionalProfileEntity> {
    const profile = await this.repo.findOne({
      where: { professionalId, businessId },
    });
    if (!profile)
      throw new NotFoundException("Perfil de profesional no encontrado");

    profile.visibleOnProfile = visible;
    return this.repo.save(profile);
  }

  // --- Consultas publicas ---

  /** Lista los profesionales activos y visibles de un negocio, mejor valorados primero. */
  async findVisibleByBusiness(
    businessId: string
  ): Promise<ProfessionalProfileEntity[]> {
    return this.repo.find({
      where: { businessId, active: true, visibleOnProfile: true },
      order: { rating: "DESC" },
    });
  }

  /** Devuelve un perfil visible por su slug; lanza 404 si no existe. */
  async findBySlug(slug: string): Promise<ProfessionalProfileEntity> {
    const profile = await this.repo.findOne({
      where: { slug, active: true, visibleOnProfile: true },
    });
    if (!profile)
      throw new NotFoundException("Perfil de profesional no encontrado");
    return profile;
  }

  // --- Consultas internas ---

  /** Lista todos los profesionales activos de un negocio (incluidos los no visibles), para uso interno. */
  async findByBusiness(
    businessId: string
  ): Promise<ProfessionalProfileEntity[]> {
    return this.repo.find({
      where: { businessId, active: true },
      order: { rating: "DESC" },
    });
  }

  /** Obtiene un perfil activo por su id; lanza 404 si no existe. */
  async findById(id: string): Promise<ProfessionalProfileEntity> {
    const profile = await this.repo.findOne({ where: { id, active: true } });
    if (!profile)
      throw new NotFoundException("Perfil de profesional no encontrado");
    return profile;
  }

  // --- Feed: profesionales destacados ---

  /** Devuelve los profesionales visibles mejor valorados para el feed. */
  async findTopRated(limit: number): Promise<ProfessionalProfileEntity[]> {
    return this.repo.find({
      where: { active: true, visibleOnProfile: true },
      order: { rating: "DESC", totalReviews: "DESC" },
      take: limit,
    });
  }

  // --- Metricas ---

  /** Recalcula la media de calificación y el total de reseñas del profesional a partir de sus reviews. */
  async updateRating(
    professionalId: string,
    manager?: EntityManager
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(ProfessionalProfileEntity)
      : this.repo;

    const profile = await repo.findOne({ where: { professionalId } });
    if (!profile) return;

    const querySource = manager || this.repo.manager;
    const result = await querySource
      .createQueryBuilder()
      .select("AVG(r.rating)", "avg")
      .addSelect("COUNT(r.id)", "count")
      .from("reviews", "r")
      .where("r.professional_id = :pid", { pid: professionalId })
      .getRawOne();

    if (result) {
      await repo.update(
        { professionalId },
        {
          rating: Math.round(parseFloat(result.avg || 0) * 100) / 100,
          totalReviews: parseInt(result.count || 0, 10),
        }
      );
    }
  }

  // --- Helpers ---

  /** Genera un slug a partir del nombre, añadiendo un sufijo numérico si ya está en uso. */
  private async ensureUniqueSlug(
    name: string,
    _businessId: string
  ): Promise<string> {
    const baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;

    while (await this.repo.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
