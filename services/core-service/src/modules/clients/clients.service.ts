import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like } from "typeorm";
import { escapeLikePattern } from "@beautyspot/shared-utils";
import { Client } from "../../entities/client.entity";

@Injectable()
export class ClientsService {
  constructor(@InjectRepository(Client) private readonly repo: Repository<Client>) {}

  async create(businessId: string, data: Partial<Client>): Promise<Client> {
    const client = this.repo.create({ ...data, businessId });
    return this.repo.save(client);
  }

  async findByBusiness(businessId: string, search?: string): Promise<Client[]> {
    const where: Record<string, unknown> = { businessId, active: true };
    if (search) {
      const escaped = escapeLikePattern(search);
      return this.repo.find({
        where: [
          { businessId, active: true, name: Like(`%${escaped}%`) },
          { businessId, active: true, email: Like(`%${escaped}%`) },
          { businessId, active: true, phone: Like(`%${escaped}%`) },
        ],
        order: { name: "ASC" },
      });
    }
    return this.repo.find({ where, order: { name: "ASC" } });
  }

  async findById(id: string, businessId: string): Promise<Client> {
    const client = await this.repo.findOne({ where: { id, businessId } });
    if (!client) throw new NotFoundException("Cliente no encontrado");
    return client;
  }

  async findByUserId(userId: string, businessId: string): Promise<Client | null> {
    return this.repo.findOne({ where: { userId, businessId, active: true } });
  }

  async update(id: string, businessId: string, data: Partial<Client>): Promise<Client> {
    await this.repo.update({ id, businessId }, data as any);
    return this.findById(id, businessId);
  }

  async addLoyaltyPoints(id: string, businessId: string, points: number): Promise<void> {
    await this.repo.increment({ id, businessId }, "loyaltyPoints", points);
  }

  async subtractLoyaltyPoints(id: string, businessId: string, points: number): Promise<void> {
    const client = await this.findById(id, businessId);
    const newPoints = Math.max(0, client.loyaltyPoints - points);
    await this.repo.update({ id, businessId }, { loyaltyPoints: newPoints });
  }
}
