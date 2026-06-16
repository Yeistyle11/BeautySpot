import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Business } from "../../entities/business.entity";
import { generateSlug, parsePaginationQuery, escapeLikePattern } from "@beautyspot/shared-utils";

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly repo: Repository<Business>,
  ) {}

  async create(data: Partial<Business>): Promise<Business> {
    const slug = generateSlug(data.name!);
    const existing = await this.repo.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(`El slug "${slug}" ya existe`);
    }

    const business = this.repo.create({ ...data, slug });
    return this.repo.save(business);
  }

  async findAll(query: Record<string, unknown>) {
    const params = parsePaginationQuery(query, ["createdAt", "updatedAt", "name", "city", "active"]);
    const qb = this.repo.createQueryBuilder("b")
      .leftJoinAndSelect("b.branches", "branches")
      .leftJoinAndSelect("b.services", "services")
      .leftJoinAndSelect("b.professionals", "professionals");

    if (query.city) qb.andWhere("b.city ILIKE :city", { city: `%${escapeLikePattern(String(query.city))}%` });
    if (query.businessType) qb.andWhere("b.business_type = :type", { type: query.businessType });
    if (query.active !== undefined) qb.andWhere("b.active = :active", { active: query.active === "true" });
    if (params.search) {
      const escaped = escapeLikePattern(params.search);
      qb.andWhere("(b.name ILIKE :search OR b.description ILIKE :search)", { search: `%${escaped}%` });
    }

    qb.orderBy(`b.${params.sort}`, params.order)
      .skip(params.offset)
      .take(params.limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: params.page, limit: params.limit };
  }

  async findById(id: string): Promise<Business> {
    const business = await this.repo.findOne({
      where: { id },
      relations: {
        branches: true,
        services: true,
        professionals: true,
        configs: true,
        hours: true,
      },
    });

    if (!business) throw new NotFoundException("Negocio no encontrado");
    return business;
  }

  async findBySlug(slug: string): Promise<Business> {
    const business = await this.repo.findOne({
      where: { slug },
      relations: {
        branches: true,
        services: true,
        professionals: true,
      },
    });

    if (!business) throw new NotFoundException(`Negocio "${slug}" no encontrado`);
    return business;
  }

  async update(id: string, data: Partial<Business>): Promise<Business> {
    await this.repo.update(id, data as any);
    return this.findById(id);
  }

  async deactivate(id: string): Promise<void> {
    await this.repo.update(id, { active: false });
  }
}
