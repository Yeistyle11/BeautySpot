import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, EntityManager } from "typeorm";
import { escapeLikePattern, generateSlug } from "@beautyspot/shared-utils";
import {
  BusinessProfileEntity,
  SectionConfig,
} from "../../entities/business-profile.entity";
import { ProfessionalProfileEntity } from "../../entities/professional-profile.entity";
import {
  UpsertProfileDto,
  CrearPerfilDto,
  UpdateProfileConfigDto,
  AddGalleryImagesDto,
  UpdateGalleryImageDto,
} from "./dto/profile.dto";
import { RedisCacheService } from "@beautyspot/nest-common";
import { ProfessionalProfilesService } from "../professional-profiles/professional-profiles.service";

/**
 * Vigencia de un perfil publico en cache. Las escrituras invalidan aparte, asi
 * que el TTL solo cubre los cambios que llegan por otra via.
 */
const PERFIL_TTL_SEGUNDOS = 300;

/** Secciones del perfil inmersivo activas por defecto, en su orden inicial. */
const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: "story", enabled: true, order: 1 },
  { id: "services", enabled: true, order: 2 },
  { id: "team", enabled: true, order: 3 },
  { id: "gallery", enabled: true, order: 4 },
  { id: "reviews", enabled: true, order: 5 },
  { id: "location", enabled: true, order: 6 },
];

/**
 * Sufijos que se prueban cuando el enlace derivado del nombre ya esta tomado,
 * acotados porque cada intento consulta la base.
 */
const INTENTOS_DE_ENLACE = 20;

/** Detecta la violación de índice único de Postgres (SQLSTATE 23505). */
function esViolacionDeUnicidad(
  error: unknown
): error is { code: string; constraint?: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505"
  );
}

/**
 * Gestiona el perfil público de un negocio en el marketplace: sincronización
 * desde el core, configuración del escaparate, galería, publicación y métricas.
 */
@Injectable()
export class BusinessProfilesService {
  constructor(
    @InjectRepository(BusinessProfileEntity)
    private readonly repo: Repository<BusinessProfileEntity>,
    private readonly professionalProfilesService: ProfessionalProfilesService,
    private readonly cache: RedisCacheService
  ) {}

  /** Prefijo de las claves de caché de este servicio, para poder invalidarlas juntas. */
  private static readonly PREFIJO_CACHE = "marketplace:perfil:";

  // --- Sincronizacion desde core-service ---

  /** Crea o actualiza el perfil de un negocio y recalcula su completitud. */
  async createOrUpdate(dto: UpsertProfileDto): Promise<BusinessProfileEntity> {
    const existing = await this.repo.findOne({
      where: { businessId: dto.businessId },
    });

    if (existing) {
      Object.assign(existing, { ...dto, id: existing.id });
      existing.profileCompleteness = await this.calculateCompleteness(existing);
      return this.guardar(existing);
    }

    const profile = this.repo.create({
      ...dto,
      sectionConfig: { sections: DEFAULT_SECTIONS },
      profileCompleteness: 0,
    });
    profile.profileCompleteness = await this.calculateCompleteness(profile);
    return this.guardar(profile);
  }

  // --- Alta desde el panel ---

  /** Da de alta el escaparate del negocio, en borrador y sin publicarlo. */
  async crearParaNegocio(
    businessId: string,
    dto: CrearPerfilDto
  ): Promise<BusinessProfileEntity> {
    const existente = await this.repo.findOne({ where: { businessId } });
    if (existente) {
      throw new ConflictException(
        "Este negocio ya tiene perfil en el marketplace"
      );
    }

    const slug = await this.resolverEnlace(dto.name, dto.slug);

    try {
      return await this.createOrUpdate({ ...dto, businessId, slug });
    } catch (error) {
      // Las comprobaciones de arriba no son atomicas: la de dos altas a la vez
      // que pierde llega aqui, y el mensaje distingue que unicidad salto.
      if (esViolacionDeUnicidad(error)) {
        throw new ConflictException(
          error.constraint === "uq_business_profiles_negocio"
            ? "Este negocio ya tiene perfil en el marketplace"
            : "Ese enlace ya está en uso, elige otro"
        );
      }
      throw error;
    }
  }

  /**
   * Enlace publico con el que nace el perfil: el que escribe el dueno se
   * respeta o se rechaza; el derivado del nombre se numera al chocar.
   */
  private async resolverEnlace(
    nombre: string,
    pedido?: string
  ): Promise<string> {
    if (pedido) {
      if (await this.enlaceTomado(pedido)) {
        throw new ConflictException("Ese enlace ya está en uso, elige otro");
      }
      return pedido;
    }

    const base = generateSlug(nombre);
    if (!base) {
      throw new BadRequestException(
        "El nombre no sirve para formar un enlace, escribe uno"
      );
    }

    for (let intento = 1; intento <= INTENTOS_DE_ENLACE; intento++) {
      const candidato = intento === 1 ? base : `${base}-${intento}`;
      if (!(await this.enlaceTomado(candidato))) return candidato;
    }

    throw new ConflictException(
      "No encontramos un enlace libre para ese nombre, elige uno"
    );
  }

  /** Indica si ya hay un perfil con ese enlace. */
  private async enlaceTomado(slug: string): Promise<boolean> {
    return (await this.repo.countBy({ slug })) > 0;
  }

  // --- Lectura publica ---

  /** Devuelve el perfil publicado por slug junto con su equipo, si la sección "team" está activa. */
  async findBySlug(slug: string): Promise<{
    profile: BusinessProfileEntity;
    professionals: ProfessionalProfileEntity[];
  }> {
    return this.cache.remember(
      `${BusinessProfilesService.PREFIJO_CACHE}slug:${slug}`,
      PERFIL_TTL_SEGUNDOS,
      () => this.cargarPorSlug(slug),
      ({ profile }) => BusinessProfilesService.etiquetaDe(profile.businessId)
    );
  }

  /** Lectura real del perfil publicado y su equipo, sin pasar por la caché. */
  private async cargarPorSlug(slug: string): Promise<{
    profile: BusinessProfileEntity;
    professionals: ProfessionalProfileEntity[];
  }> {
    const profile = await this.repo.findOne({
      where: { slug, active: true, isPublished: true },
    });
    if (!profile)
      throw new NotFoundException("Perfil de negocio no encontrado");

    // Incluir profesionales si la seccion "team" esta habilitada
    const teamSection = profile.sectionConfig?.sections?.find(
      (s) => s.id === "team"
    );
    let professionals: ProfessionalProfileEntity[] = [];

    if (teamSection?.enabled !== false) {
      professionals =
        await this.professionalProfilesService.findVisibleByBusiness(
          profile.businessId
        );
    }

    return { profile, professionals };
  }

  /** Devuelve un profesional por slug validando que pertenezca al negocio y que su equipo sea visible. */
  async findProfessionalBySlug(
    businessSlug: string,
    professionalSlug: string
  ): Promise<ProfessionalProfileEntity> {
    const business = await this.repo.findOne({
      where: { slug: businessSlug, active: true, isPublished: true },
    });
    if (!business)
      throw new NotFoundException("Perfil de negocio no encontrado");

    // Verificar que la seccion "team" este habilitada
    const teamSection = business.sectionConfig?.sections?.find(
      (s) => s.id === "team"
    );
    if (teamSection?.enabled === false) {
      throw new NotFoundException("Seccion de equipo no disponible");
    }

    const professional =
      await this.professionalProfilesService.findBySlug(professionalSlug);

    // Verificar que el profesional pertenece a este negocio
    if (professional.businessId !== business.businessId) {
      throw new NotFoundException("Profesional no encontrado en este negocio");
    }

    return professional;
  }

  /** Obtiene un perfil por su id; lanza 404 si no existe. */
  async findById(id: string): Promise<BusinessProfileEntity> {
    const profile = await this.repo.findOne({ where: { id } });
    if (!profile)
      throw new NotFoundException("Perfil de negocio no encontrado");
    return profile;
  }

  /** Obtiene el perfil asociado a un negocio; lanza 404 si no existe. */
  async findByBusinessId(businessId: string): Promise<BusinessProfileEntity> {
    const profile = await this.repo.findOne({ where: { businessId } });
    if (!profile)
      throw new NotFoundException("Perfil de negocio no encontrado");
    return profile;
  }

  // --- Configuracion del perfil inmersivo ---

  /** Actualiza los campos del perfil inmersivo (historia, redes, secciones) y recalcula la completitud. */
  async updateConfig(
    businessId: string,
    dto: UpdateProfileConfigDto
  ): Promise<BusinessProfileEntity> {
    const profile = await this.findByBusinessId(businessId);

    if (dto.tagline !== undefined) profile.tagline = dto.tagline;
    if (dto.storyTitle !== undefined) profile.storyTitle = dto.storyTitle;
    if (dto.storyText !== undefined) profile.storyText = dto.storyText;
    if (dto.storyImage !== undefined) profile.storyImage = dto.storyImage;
    if (dto.foundedYear !== undefined) profile.foundedYear = dto.foundedYear;
    if (dto.founders !== undefined) profile.founders = dto.founders;
    if (dto.socialLinks !== undefined) profile.socialLinks = dto.socialLinks;

    if (dto.sectionConfig !== undefined) {
      profile.sectionConfig = { sections: dto.sectionConfig };
    }

    profile.profileCompleteness = await this.calculateCompleteness(profile);
    return this.guardar(profile);
  }

  // --- Galeria ---

  /** Añade imágenes a la galería del perfil. */
  async addGalleryImages(
    businessId: string,
    dto: AddGalleryImagesDto
  ): Promise<BusinessProfileEntity> {
    const profile = await this.findByBusinessId(businessId);
    const current = profile.galleryImages || [];
    profile.galleryImages = [...current, ...dto.images];
    profile.profileCompleteness = await this.calculateCompleteness(profile);
    return this.guardar(profile);
  }

  /** Actualiza los metadatos de una imagen de la galería por su índice. */
  async updateGalleryImage(
    businessId: string,
    dto: UpdateGalleryImageDto
  ): Promise<BusinessProfileEntity> {
    const profile = await this.findByBusinessId(businessId);
    const images = profile.galleryImages || [];

    if (dto.index < 0 || dto.index >= images.length) {
      throw new BadRequestException("Indice de imagen invalido");
    }

    if (dto.title !== undefined) images[dto.index].title = dto.title;
    if (dto.category !== undefined) images[dto.index].category = dto.category;
    if (dto.featured !== undefined) images[dto.index].featured = dto.featured;

    profile.galleryImages = images;
    return this.guardar(profile);
  }

  /** Elimina una imagen de la galería por su índice y recalcula la completitud. */
  async removeGalleryImage(
    businessId: string,
    index: number
  ): Promise<BusinessProfileEntity> {
    const profile = await this.findByBusinessId(businessId);
    const images = profile.galleryImages || [];

    if (index < 0 || index >= images.length) {
      throw new BadRequestException("Indice de imagen invalido");
    }

    images.splice(index, 1);
    profile.galleryImages = images;
    profile.profileCompleteness = await this.calculateCompleteness(profile);
    return this.guardar(profile);
  }

  // --- Publicacion ---

  /** Publica el perfil (lo hace visible en el marketplace); exige nombre y slug. */
  async publish(businessId: string): Promise<BusinessProfileEntity> {
    const profile = await this.findByBusinessId(businessId);
    if (!profile.name || !profile.slug) {
      throw new BadRequestException(
        "El perfil debe tener nombre y slug para publicarse"
      );
    }
    profile.isPublished = true;
    return this.guardar(profile);
  }

  /** Retira el perfil del marketplace (deja de estar publicado). */
  async unpublish(businessId: string): Promise<BusinessProfileEntity> {
    const profile = await this.findByBusinessId(businessId);
    profile.isPublished = false;
    return this.guardar(profile);
  }

  // --- Rating ---

  /** Recalcula la media de calificación y el total de reseñas del negocio a partir de sus reviews. */
  async updateRating(
    businessId: string,
    manager?: EntityManager
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(BusinessProfileEntity)
      : this.repo;
    const querySource = manager || this.repo.manager;

    const result = await querySource
      .createQueryBuilder()
      .select("AVG(r.rating)", "avg")
      .addSelect("COUNT(r.id)", "count")
      .from("reviews", "r")
      .where("r.business_id = :bid", { bid: businessId })
      .getRawOne();

    const totalReviews = parseInt(result?.count || "0", 10);
    const rating =
      totalReviews > 0
        ? Math.round(parseFloat(result?.avg || "0") * 100) / 100
        : 0;

    await repo.update({ businessId }, { rating, totalReviews });
  }

  /**
   * Invalida la caché del perfil de un negocio; se llama fuera de la
   * transacción de la reseña, una vez confirmada.
   */
  async invalidarCache(businessId: string): Promise<void> {
    await this.cache.invalidarEtiqueta(
      BusinessProfilesService.etiquetaDe(businessId)
    );
  }

  // --- Feed helpers ---

  /** Lista perfiles publicados con filtros por ciudad/tipo y orden por cercanía, rating o novedad. */
  async findPublished(options: {
    city?: string;
    businessType?: string;
    lat?: number;
    lng?: number;
    radius?: number;
    page?: number;
    limit?: number;
    orderBy?: "rating" | "distance" | "createdAt";
  }): Promise<{ items: BusinessProfileEntity[]; total: number }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 50);
    const offset = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder("bp")
      .where("bp.active = :active", { active: true })
      .andWhere("bp.is_published = :published", { published: true });

    if (options.city) {
      qb.andWhere("bp.city ILIKE :city", {
        city: `%${escapeLikePattern(options.city)}%`,
      });
    }

    if (options.businessType) {
      qb.andWhere("bp.business_type = :type", { type: options.businessType });
    }

    if (options.lat && options.lng) {
      const radius = options.radius || 10;
      qb.andWhere(
        `(6371 * acos(cos(radians(:lat)) * cos(radians(bp.lat)) * cos(radians(bp.lng) - radians(:lng)) + sin(radians(:lat)) * sin(radians(bp.lat)))) <= :radius`,
        { lat: options.lat, lng: options.lng, radius }
      );
      qb.orderBy(
        `(6371 * acos(cos(radians(:lat2)) * cos(radians(bp.lat)) * cos(radians(bp.lng) - radians(:lng2)) + sin(radians(:lat2)) * sin(radians(bp.lat))))`,
        "ASC"
      );
      qb.setParameters({ lat2: options.lat, lng2: options.lng });
    } else if (options.orderBy === "createdAt") {
      qb.orderBy("bp.created_at", "DESC");
    } else {
      qb.orderBy("bp.rating", "DESC");
    }

    const [items, total] = await qb.skip(offset).take(limit).getManyAndCount();
    return { items, total };
  }

  /** Cuenta los perfiles publicados de cada tipo de negocio, en una sola consulta. */
  async contarPorTipo(): Promise<Map<string, number>> {
    const filas = await this.repo
      .createQueryBuilder("bp")
      .select("bp.business_type", "tipo")
      .addSelect("COUNT(*)", "total")
      .where("bp.active = :active", { active: true })
      .andWhere("bp.is_published = :published", { published: true })
      .groupBy("bp.business_type")
      .getRawMany<{ tipo: string; total: string }>();

    return new Map(filas.map((f) => [f.tipo, Number(f.total)]));
  }

  /** Devuelve los perfiles publicados mejor valorados. */
  async findTopRated(limit: number): Promise<BusinessProfileEntity[]> {
    return this.repo.find({
      where: { active: true, isPublished: true },
      order: { rating: "DESC" },
      take: limit,
    });
  }

  /** Devuelve los perfiles publicados recientemente, priorizando los más completos. */
  async findRecent(
    days: number,
    limit: number
  ): Promise<BusinessProfileEntity[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return this.repo
      .createQueryBuilder("bp")
      .where("bp.active = :active", { active: true })
      .andWhere("bp.is_published = :published", { published: true })
      .andWhere("bp.created_at >= :since", { since })
      .orderBy("bp.profile_completeness", "DESC")
      .take(limit)
      .getMany();
  }

  // --- Completitud ---

  /**
   * Punto único por el que pasan las escrituras del perfil: lo persiste e
   * invalida por etiqueta las claves con que se sirve ese negocio.
   */
  private async guardar(
    profile: BusinessProfileEntity
  ): Promise<BusinessProfileEntity> {
    const guardado = await this.repo.save(profile);
    // Mejor esfuerzo: un fallo al invalidar no tumba la escritura, y las
    // entradas caducan solas por TTL.
    await this.cache.invalidarEtiqueta(
      BusinessProfilesService.etiquetaDe(guardado.businessId)
    );
    return guardado;
  }

  /** Etiqueta que agrupa las claves de caché de un negocio. */
  private static etiquetaDe(businessId: string): string {
    return `${BusinessProfilesService.PREFIJO_CACHE}negocio:${businessId}`;
  }

  private async calculateCompleteness(
    profile: BusinessProfileEntity
  ): Promise<number> {
    let score = 0;

    // Datos basicos (30 pts)
    if (profile.name) score += 5;
    if (profile.description) score += 5;
    if (profile.logo) score += 10;
    if (profile.coverImage) score += 10;

    // Historia (15 pts)
    if (profile.storyText && profile.storyText.length > 100) score += 10;
    if (profile.storyImage) score += 5;

    // Galeria (10 pts)
    const imgCount = profile.galleryImages?.length || 0;
    if (imgCount >= 3) score += 7;
    if (imgCount >= 6) score += 3;

    // Redes sociales (10 pts)
    if (profile.socialLinks?.instagram) score += 5;
    if (profile.socialLinks?.facebook || profile.socialLinks?.tiktok)
      score += 5;

    // Ubicacion (10 pts)
    if (profile.address && profile.city) score += 5;
    if (profile.lat && profile.lng) score += 5;

    // Configuracion de secciones (5 pts)
    if (profile.sectionConfig) score += 3;
    if (profile.isPublished) score += 2;

    // Tagline (5 pts)
    if (profile.tagline) score += 5;

    // Equipo (15 pts)
    const visibleProfessionals =
      await this.professionalProfilesService.findVisibleByBusiness(
        profile.businessId
      );
    if (visibleProfessionals.length >= 1) score += 7;
    if (visibleProfessionals.length >= 3) score += 8;

    return Math.min(score, 100);
  }
}
