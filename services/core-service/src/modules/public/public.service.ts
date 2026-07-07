import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { escapeLikePattern } from "@beautyspot/shared-utils";
import { Business } from "../../entities/business.entity";
import { Service } from "../../entities/service.entity";
import { Professional } from "../../entities/professional.entity";

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(Professional)
    private readonly proRepo: Repository<Professional>
  ) {}

  async listBusinesses(q?: string, city?: string) {
    const qb = this.businessRepo
      .createQueryBuilder("b")
      .where("b.active = true")
      .select([
        "b.id",
        "b.slug",
        "b.name",
        "b.description",
        "b.city",
        "b.address",
        "b.phone",
        "b.logo",
        "b.coverImage",
        "b.businessType",
      ]);

    if (q) qb.andWhere("b.name ILIKE :q", { q: `%${escapeLikePattern(q)}%` });
    if (city)
      qb.andWhere("b.city ILIKE :city", {
        city: `%${escapeLikePattern(city)}%`,
      });

    return qb.limit(50).getMany();
  }

  async getBusinessBySlug(slug: string) {
    const business = await this.businessRepo.findOne({
      where: { slug, active: true },
      select: [
        "id",
        "slug",
        "name",
        "description",
        "city",
        "address",
        "phone",
        "logo",
        "coverImage",
        "businessType",
        "website",
        "currency",
        "timezone",
      ],
    });
    return business;
  }

  async getBusinessServices(businessId: string) {
    return this.serviceRepo.find({
      where: { businessId, active: true },
      select: ["id", "name", "description", "price", "duration", "category"],
    });
  }

  async getBusinessProfessionals(businessId: string) {
    return this.proRepo.find({
      where: { businessId, active: true },
      select: [
        "id",
        "bio",
        "specialties",
        "yearsExp",
        "rating",
        "totalReviews",
      ],
    });
  }
}
