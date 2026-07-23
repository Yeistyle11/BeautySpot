import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { escapeLikePattern } from "@beautyspot/shared-utils";
import { BusinessProfileEntity } from "../../entities/business-profile.entity";
import { ProfessionalProfileEntity } from "../../entities/professional-profile.entity";

export interface SearchFilters {
  q?: string;
  city?: string;
  businessType?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  ratingMin?: number;
  page?: number;
  limit?: number;
  type?: "business" | "professional" | "all";
}

export interface SearchResult {
  items: (BusinessProfileEntity | ProfessionalProfileEntity)[];
  total: number;
  page: number;
  limit: number;
  type: "business" | "professional" | "all";
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(BusinessProfileEntity)
    private readonly repo: Repository<BusinessProfileEntity>,
    @InjectRepository(ProfessionalProfileEntity)
    private readonly proRepo: Repository<ProfessionalProfileEntity>
  ) {}

  async search(filters: SearchFilters): Promise<SearchResult> {
    const type = filters.type || "business";

    if (type === "professional") {
      return { ...(await this.searchProfessionals(filters)), type };
    }

    if (type === "all") {
      const [businesses, professionals] = await Promise.all([
        this.searchBusinesses(filters),
        this.searchProfessionals(filters),
      ]);
      return {
        items: [...businesses.items, ...professionals.items],
        total: businesses.total + professionals.total,
        page: businesses.page,
        limit: businesses.limit,
        type,
      };
    }

    return { ...(await this.searchBusinesses(filters)), type };
  }

  private async searchBusinesses(
    filters: SearchFilters
  ): Promise<Omit<SearchResult, "type">> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 50);
    const offset = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder("bp")
      .where("bp.active = :active", { active: true })
      .andWhere("bp.is_published = :published", { published: true });

    if (filters.q) {
      const escaped = escapeLikePattern(filters.q);
      qb.andWhere(
        "(bp.name ILIKE :q OR bp.description ILIKE :q OR bp.city ILIKE :q OR bp.tagline ILIKE :q)",
        { q: `%${escaped}%` }
      );
    }

    if (filters.city) {
      qb.andWhere("bp.city ILIKE :city", {
        city: `%${escapeLikePattern(filters.city)}%`,
      });
    }

    if (filters.businessType) {
      qb.andWhere("bp.business_type = :businessType", {
        businessType: filters.businessType,
      });
    }

    if (filters.ratingMin) {
      qb.andWhere("bp.rating >= :ratingMin", { ratingMin: filters.ratingMin });
    }

    if (filters.lat && filters.lng) {
      const radius = filters.radius || 10;
      qb.andWhere(
        `(6371 * acos(cos(radians(:lat)) * cos(radians(bp.lat)) * cos(radians(bp.lng) - radians(:lng)) + sin(radians(:lat)) * sin(radians(bp.lat)))) <= :radius`,
        { lat: filters.lat, lng: filters.lng, radius }
      );
      qb.orderBy(
        `(6371 * acos(cos(radians(:lat2)) * cos(radians(bp.lat)) * cos(radians(bp.lng) - radians(:lng2)) + sin(radians(:lat2)) * sin(radians(bp.lat))))`,
        "ASC"
      );
      qb.setParameters({ lat2: filters.lat, lng2: filters.lng });
    } else {
      qb.orderBy("bp.rating", "DESC").addOrderBy("bp.total_reviews", "DESC");
    }

    const [items, total] = await qb.skip(offset).take(limit).getManyAndCount();

    return { items, total, page, limit };
  }

  private async searchProfessionals(
    filters: SearchFilters
  ): Promise<Omit<SearchResult, "type">> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 50);
    const offset = (page - 1) * limit;

    const qb = this.proRepo
      .createQueryBuilder("pp")
      .where("pp.active = :active", { active: true })
      .andWhere("pp.visible_on_profile = :visible", { visible: true });

    if (filters.q) {
      const escaped = escapeLikePattern(filters.q);
      qb.andWhere(
        "(pp.name ILIKE :q OR pp.bio ILIKE :q OR pp.specialties ILIKE :q)",
        { q: `%${escaped}%` }
      );
    }

    // Filtrar por ciudad a traves del perfil del negocio
    if (filters.city) {
      qb.innerJoin(
        "business_profiles",
        "bp",
        "bp.business_id = pp.business_id"
      ).andWhere("bp.city ILIKE :city", {
        city: `%${escapeLikePattern(filters.city)}%`,
      });
    }

    if (filters.ratingMin) {
      qb.andWhere("pp.rating >= :ratingMin", { ratingMin: filters.ratingMin });
    }

    qb.orderBy("pp.rating", "DESC").addOrderBy("pp.total_reviews", "DESC");

    const [items, total] = await qb.skip(offset).take(limit).getManyAndCount();

    return { items, total, page, limit };
  }
}
