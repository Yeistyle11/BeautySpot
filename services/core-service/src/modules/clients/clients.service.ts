import { Injectable } from "@nestjs/common";
import { InjectRepository, InjectDataSource } from "@nestjs/typeorm";
import { TenantCrudService, OutboxService } from "@beautyspot/nest-common";
import { EventNames } from "@beautyspot/event-types";
import { Repository, Like, DataSource, EntityManager } from "typeorm";
import { escapeLikePattern } from "@beautyspot/shared-utils";
import { paginate, PaginateParams } from "@beautyspot/database";
import { IPaginatedResponse } from "@beautyspot/shared-types";
import { Client } from "../../entities/client.entity";

/** CRUD de la cartera de clientes de un negocio, incluida su fidelización por puntos. */
@Injectable()
export class ClientsService extends TenantCrudService<Client> {
  constructor(
    @InjectRepository(Client) repo: Repository<Client>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly outbox: OutboxService
  ) {
    super(repo, "Cliente no encontrado");
  }

  /** Registra un cliente en el negocio indicado y publica el alta. */
  async create(businessId: string, data: Partial<Client>): Promise<Client> {
    const client = this.repo.create({ ...data, businessId });

    return this.dataSource.transaction(async (manager) => {
      const creado = await manager.getRepository(Client).save(client);

      await this.outbox.enqueue(manager, {
        eventType: EventNames.CORE_CLIENT_CREATED,
        aggregateType: "client",
        aggregateId: creado.id,
        payload: {
          clientId: creado.id,
          businessId,
          name: creado.name,
          email: creado.email,
          phone: creado.phone,
        },
      });

      return creado;
    });
  }

  /** Lista los clientes activos del negocio, con búsqueda por nombre/email/teléfono y paginación. */
  async findByBusiness(
    businessId: string,
    search: string | undefined,
    pagination: PaginateParams
  ): Promise<IPaginatedResponse<Client>> {
    const base = { businessId, active: true };
    const where = search
      ? [
          { ...base, name: Like(`%${escapeLikePattern(search)}%`) },
          { ...base, email: Like(`%${escapeLikePattern(search)}%`) },
          { ...base, phone: Like(`%${escapeLikePattern(search)}%`) },
        ]
      : base;
    return paginate(this.repo, pagination, { where, order: { name: "ASC" } });
  }

  /** Busca el cliente asociado a una cuenta de usuario dentro del negocio. */
  async findByUserId(
    userId: string,
    businessId: string
  ): Promise<Client | null> {
    return this.repo.findOne({ where: { userId, businessId, active: true } });
  }

  /**
   * Ficha más reciente del usuario, sin acotar a un negocio: el cliente final
   * no pertenece a ninguno y puede tener una por cada sitio donde reservó.
   */
  async findMineByUser(userId: string): Promise<Client | null> {
    return this.repo.findOne({
      where: { userId, active: true },
      order: { createdAt: "DESC" },
    });
  }

  /** Actualiza los datos personales en todas las fichas del usuario. */
  async updateMineByUser(
    userId: string,
    data: Pick<Partial<Client>, "name" | "phone">
  ): Promise<Client | null> {
    const fichas = await this.repo.find({ where: { userId } });
    if (fichas.length === 0) return null;

    for (const ficha of fichas) {
      if (data.name !== undefined) ficha.name = data.name;
      if (data.phone !== undefined) ficha.phone = data.phone;
    }
    await this.repo.save(fichas);

    return this.findMineByUser(userId);
  }

  /**
   * Suma puntos de fidelidad al cliente.
   *
   * Acepta un `manager` para poder correr dentro de la transacción de quien
   * llame: acreditar puntos es dinero, y el incremento tiene que confirmarse a
   * la vez que la marca de evento procesado o se duplican o se pierden.
   */
  async addLoyaltyPoints(
    id: string,
    businessId: string,
    points: number,
    manager?: EntityManager
  ): Promise<void> {
    const repo = manager ? manager.getRepository(Client) : this.repo;
    await repo.increment({ id, businessId }, "loyaltyPoints", points);
  }

  /** Resta puntos de fidelidad al cliente, sin bajar de cero. */
  async subtractLoyaltyPoints(
    id: string,
    businessId: string,
    points: number
  ): Promise<void> {
    const client = await this.findById(id, businessId);
    const newPoints = Math.max(0, client.loyaltyPoints - points);
    await this.repo.update({ id, businessId }, { loyaltyPoints: newPoints });
  }
}
