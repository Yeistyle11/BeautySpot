import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { OutboxService, InternalHttpClient } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import { In, Repository, DataSource } from "typeorm";
import { Business } from "../../entities/business.entity";
import { Branch } from "../../entities/branch.entity";
import { Service } from "../../entities/service.entity";
import { Professional } from "../../entities/professional.entity";
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
  private readonly logger = new Logger(BusinessesService.name);

  constructor(
    @InjectRepository(Business)
    private readonly repo: Repository<Business>,
    @InjectRepository(Branch)
    private readonly branchRepo: Repository<Branch>,
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(Professional)
    private readonly professionalRepo: Repository<Professional>,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly http: InternalHttpClient
  ) {}

  /** Crea un negocio generando un slug único a partir del nombre. */
  async create(data: Partial<Business>, creadoPor = ""): Promise<Business> {
    const slug = generateSlug(data.name!);
    const existing = await this.repo.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(`El slug "${slug}" ya existe`);
    }

    const business = this.repo.create({ ...data, slug });

    return this.dataSource.transaction(async (manager) => {
      const creado = await manager.getRepository(Business).save(business);

      await this.outbox.enqueue(manager, {
        eventType: EventNames.CORE_BUSINESS_CREATED,
        aggregateType: "business",
        aggregateId: creado.id,
        payload: {
          businessId: creado.id,
          slug: creado.slug,
          name: creado.name,
          businessType: creado.businessType,
          ownerId: creadoPor,
        },
      });

      return creado;
    });
  }

  /**
   * Alta de negocio por parte de quien lo va a regentar: crea el negocio y lo
   * deja con su membresía de OWNER.
   *
   * La membresía vive en auth-service, así que se pide por HTTP interno en vez
   * de por evento: sin ella el usuario no tendría negocio en su token y no
   * podría entrar al panel que acaba de crear.
   */
  async createWithOwner(
    data: Partial<Business>,
    ownerId: string
  ): Promise<Business> {
    const creado = await this.create(data, ownerId);

    try {
      await this.http.enviar("auth", "/internal/memberships", {
        userId: ownerId,
        businessId: creado.id,
        role: Role.OWNER,
      });
    } catch (error) {
      // Sin membresía el negocio queda huérfano y el usuario atascado, así que
      // se deshace en vez de dejar un alta a medias.
      await this.repo.delete({ id: creado.id });
      this.logger.error(
        `No se pudo crear la membresía OWNER del negocio ${creado.id}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }

    return creado;
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
    const qb = this.repo.createQueryBuilder("b");

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
    await this.adjuntarColecciones(items);
    return { items, total, page: params.page, limit: params.limit };
  }

  /**
   * Carga sedes, servicios y profesionales de los negocios de la página, cada
   * colección en su propia consulta por lote.
   */
  private async adjuntarColecciones(negocios: Business[]): Promise<void> {
    if (negocios.length === 0) return;
    const ids = negocios.map((n) => n.id);

    const [branches, services, professionals] = await Promise.all([
      this.branchRepo.find({ where: { businessId: In(ids) } }),
      this.serviceRepo.find({ where: { businessId: In(ids) } }),
      this.professionalRepo.find({ where: { businessId: In(ids) } }),
    ]);

    const porNegocio = <T extends { businessId: string }>(filas: T[]) => {
      const mapa = new Map<string, T[]>();
      for (const fila of filas) {
        const acumulado = mapa.get(fila.businessId);
        if (acumulado) acumulado.push(fila);
        else mapa.set(fila.businessId, [fila]);
      }
      return mapa;
    };

    const sedesPorNegocio = porNegocio(branches);
    const serviciosPorNegocio = porNegocio(services);
    const profesionalesPorNegocio = porNegocio(professionals);

    for (const negocio of negocios) {
      negocio.branches = sedesPorNegocio.get(negocio.id) ?? [];
      negocio.services = serviciosPorNegocio.get(negocio.id) ?? [];
      negocio.professionals = profesionalesPorNegocio.get(negocio.id) ?? [];
    }
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

  /** Nombre de cada negocio pedido, para etiquetar listas de otros servicios. */
  async namesByIds(ids: string[]): Promise<{ id: string; name: string }[]> {
    if (ids.length === 0) return [];

    const negocios = await this.repo.find({
      where: { id: In([...new Set(ids)]) },
      select: ["id", "name"],
    });

    return negocios.map((n) => ({ id: n.id, name: n.name }));
  }

  /** Actualiza un negocio tras verificar el acceso del llamante. */
  async update(
    id: string,
    data: Partial<Business>,
    callerBusinessId?: string,
    callerRole?: Role
  ): Promise<Business> {
    const previo = await this.findById(id, callerBusinessId, callerRole);

    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(Business)
        .update(id, data as Parameters<typeof this.repo.update>[1]);

      await this.outbox.enqueue(manager, {
        eventType: EventNames.CORE_BUSINESS_UPDATED,
        aggregateType: "business",
        aggregateId: id,
        payload: {
          businessId: id,
          slug: previo.slug,
          changes: data as Record<string, unknown>,
        },
      });
    });

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
   * Verifica que el llamante tiene acceso al negocio.
   *
   * Un llamante sin negocio pasa de largo porque las rutas internas
   * (servicio a servicio) no lo llevan, y esas ya están protegidas por el
   * secreto compartido. Se registra igualmente: por HTTP el guard de tenant
   * exige la cabecera, así que llegar aquí sin negocio y con un rol de usuario
   * significa que alguien ha abierto un camino que se salta esa comprobación.
   */
  private assertOwnership(
    businessId: string,
    callerBusinessId?: string,
    callerRole?: Role
  ): void {
    if (callerRole === Role.SUPER_ADMIN) return;

    if (callerBusinessId === undefined) {
      if (callerRole !== undefined) {
        this.logger.warn(
          `Acceso al negocio ${businessId} con rol ${callerRole} y sin negocio resuelto`
        );
      }
      return;
    }

    if (businessId !== callerBusinessId) {
      throw new ForbiddenException("No tienes acceso a este negocio");
    }
  }
}
