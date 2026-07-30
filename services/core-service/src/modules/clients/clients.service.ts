import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { TenantCrudService } from "@beautyspot/nest-common";
import { Repository, Like } from "typeorm";
import { escapeLikePattern } from "@beautyspot/shared-utils";
import { paginate, PaginateParams } from "@beautyspot/database";
import { IPaginatedResponse } from "@beautyspot/shared-types";
import { Client } from "../../entities/client.entity";

/** CRUD de la cartera de clientes de un negocio, incluida su fidelización por puntos. */
@Injectable()
export class ClientsService extends TenantCrudService<Client> {
  constructor(@InjectRepository(Client) repo: Repository<Client>) {
    super(repo, "Cliente no encontrado");
  }

  /** Registra un cliente en el negocio indicado. */
  async create(businessId: string, data: Partial<Client>): Promise<Client> {
    const client = this.repo.create({ ...data, businessId });
    return this.repo.save(client);
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

  /** Suma puntos de fidelidad al cliente. */
  async addLoyaltyPoints(
    id: string,
    businessId: string,
    points: number
  ): Promise<void> {
    await this.repo.increment({ id, businessId }, "loyaltyPoints", points);
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
