import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Business } from "../../entities/business.entity";
import {
  generateSlug,
  parsePaginationQuery,
  escapeLikePattern,
} from "@beautyspot/shared-utils";
import { Role } from "@beautyspot/shared-types";

/**
 * CRUD de negocios con control de acceso por tenant: cada llamante solo ve y
 * modifica su propio negocio, salvo SUPER_ADMIN que accede a todos.
 */
@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly repo: Repository<Business>
  ) {}

  /** Crea un negocio generando un slug único a partir del nombre. */
  async create(data: Partial<Business>): Promise<Business> {
    const slug = generateSlug(data.name!);
    const existing = await this.repo.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(`El slug "${slug}" ya existe`);
    }

    const business = this.repo.create({ ...data, slug });
    return this.repo.save(business);
  }

  /**
   * Lista negocios. SUPER_ADMIN ve todos; resto scoped a su businessId.
   */
  async findAll(
    query: Record<string, unknown>,
    callerBusinessId?: string,
    callerRole?: Role
  ) {
    const params = parsePaginationQuery(query, [
      "createdAt",
      "updatedAt",
      "name",
      "city",
      "active",
    ]);
    const qb = this.repo
      .createQueryBuilder("b")
      .leftJoinAndSelect("b.branches", "branches")
      .leftJoinAndSelect("b.services", "services")
      .leftJoinAndSelect("b.professionals", "professionals");

    // Los llamantes que no son SUPER_ADMIN quedan acotados a su propio negocio.
    if (callerRole !== Role.SUPER_ADMIN && callerBusinessId) {
      qb.andWhere("b.id = :bid", { bid: callerBusinessId });
    }

    if (query.city)
      qb.andWhere("b.city ILIKE :city", {
        city: `%${escapeLikePattern(String(query.city))}%`,
      });
    if (query.businessType)
      qb.andWhere("b.business_type = :type", { type: query.businessType });
    if (query.active !== undefined)
      qb.andWhere("b.active = :active", { active: query.active === "true" });
    if (params.search) {
      const escaped = escapeLikePattern(params.search);
      qb.andWhere("(b.name ILIKE :search OR b.description ILIKE :search)", {
        search: `%${escaped}%`,
      });
    }

    qb.orderBy(`b.${params.sort}`, params.order)
      .skip(params.offset)
      .take(params.limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page: params.page, limit: params.limit };
  }

  /**
   * Obtiene un negocio por id. Verifica ownership salvo SUPER_ADMIN.
   */
  async findById(
    id: string,
    callerBusinessId?: string,
    callerRole?: Role
  ): Promise<Business> {
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
    this.assertOwnership(business.id, callerBusinessId, callerRole);
    return business;
  }

  /**
   * Obtiene un negocio por slug. Verifica ownership salvo SUPER_ADMIN.
   * Internal callers (sin callerBusinessId) bypass el check.
   */
  async findBySlug(
    slug: string,
    callerBusinessId?: string,
    callerRole?: Role
  ): Promise<Business> {
    const business = await this.repo.findOne({
      where: { slug },
      relations: {
        branches: true,
        services: true,
        professionals: true,
      },
    });

    if (!business)
      throw new NotFoundException(`Negocio "${slug}" no encontrado`);
    if (callerBusinessId !== undefined) {
      this.assertOwnership(business.id, callerBusinessId, callerRole);
    }
    return business;
  }

  /** Actualiza un negocio tras verificar el acceso del llamante. */
  async update(
    id: string,
    data: Partial<Business>,
    callerBusinessId?: string,
    callerRole?: Role
  ): Promise<Business> {
    await this.findById(id, callerBusinessId, callerRole);
    await this.repo.update(id, data as Parameters<typeof this.repo.update>[1]);
    return this.findById(id, callerBusinessId, callerRole);
  }

  /** Da de baja (baja lógica) un negocio tras verificar el acceso del llamante. */
  async deactivate(
    id: string,
    callerBusinessId?: string,
    callerRole?: Role
  ): Promise<void> {
    await this.findById(id, callerBusinessId, callerRole);
    await this.repo.update(id, { active: false });
  }

  /**
   * Verifica que el caller tiene acceso al negocio.
   * SUPER_ADMIN bypass. Sin callerBusinessId (internal) bypass.
   */
  private assertOwnership(
    businessId: string,
    callerBusinessId?: string,
    callerRole?: Role
  ): void {
    if (callerRole === Role.SUPER_ADMIN) return;
    if (callerBusinessId === undefined) return;
    if (businessId !== callerBusinessId) {
      throw new ForbiddenException("No tienes acceso a este negocio");
    }
  }
}
