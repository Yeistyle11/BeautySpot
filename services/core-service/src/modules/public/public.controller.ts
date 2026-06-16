import { Controller, Get, Post, Param, Query, Body } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Public } from "@beautyspot/nest-common";
import { escapeLikePattern } from "@beautyspot/shared-utils";
import { Business } from "../../entities/business.entity";
import { Service } from "../../entities/service.entity";
import { Professional } from "../../entities/professional.entity";
import { Client } from "../../entities/client.entity";

@Public()
@Controller("public")
export class PublicController {
  constructor(
    @InjectRepository(Business) private readonly businessRepo: Repository<Business>,
    @InjectRepository(Service) private readonly serviceRepo: Repository<Service>,
    @InjectRepository(Professional) private readonly proRepo: Repository<Professional>,
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
  ) {}

  @Get("businesses")
  async listBusinesses(@Query("q") q?: string, @Query("city") city?: string) {
    const qb = this.businessRepo.createQueryBuilder("b")
      .where("b.active = true")
      .select(["b.id", "b.slug", "b.name", "b.description", "b.city", "b.address", "b.phone", "b.logo", "b.coverImage", "b.businessType"]);

    if (q) qb.andWhere("b.name ILIKE :q", { q: `%${escapeLikePattern(q)}%` });
    if (city) qb.andWhere("b.city ILIKE :city", { city: `%${escapeLikePattern(city)}%` });

    return qb.limit(50).getMany();
  }

  @Get("businesses/slug/:slug")
  async getBusinessBySlug(@Param("slug") slug: string) {
    const business = await this.businessRepo.findOne({ where: { slug, active: true } });
    if (!business) return null;
    return business;
  }

  @Get("businesses/:id/services")
  async getBusinessServices(@Param("id") businessId: string) {
    return this.serviceRepo.find({ where: { businessId, active: true }, select: ["id", "name", "description", "price", "duration", "category"] });
  }

  @Get("businesses/:id/professionals")
  async getBusinessProfessionals(@Param("id") businessId: string) {
    return this.proRepo.find({ where: { businessId, active: true }, select: ["id", "bio", "specialties", "yearsExp", "rating", "totalReviews"] });
  }

  @Post("internal/clients/find-or-create")
  async findOrCreateClient(@Body() body: { businessId: string; name: string; email?: string; phone?: string }) {
    let client: any = null;

    if (body.email) {
      client = await this.clientRepo.findOne({ where: { businessId: body.businessId, email: body.email } });
    }
    if (!client && body.phone) {
      client = await this.clientRepo.findOne({ where: { businessId: body.businessId, phone: body.phone } });
    }
    if (!client) {
      const newClient = new Client();
      newClient.businessId = body.businessId;
      newClient.name = body.name;
      newClient.email = body.email || "";
      newClient.phone = body.phone || "";
      newClient.userId = null as any;
      newClient.tags = [];
      client = await this.clientRepo.save(newClient);
    }
    return client;
  }
}
