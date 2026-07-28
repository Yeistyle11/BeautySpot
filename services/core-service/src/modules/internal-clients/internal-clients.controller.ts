import { Controller, Post, Get, Body, Param } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Client } from "../../entities/client.entity";
import { FindOrCreateClientDto } from "./dto/find-or-create-client.dto";

/** Endpoint interno (servicio-a-servicio) para resolver el cliente de una reserva. */
@Controller("internal/clients")
export class InternalClientsController {
  constructor(
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>
  ) {}

  /** Devuelve el cliente existente que coincida por email/teléfono, o lo crea si no hay ninguno. */
  @Post("find-or-create")
  async findOrCreate(@Body() dto: FindOrCreateClientDto): Promise<Client> {
    const existing = await this.findExistingClient(dto);
    if (existing) return this.vincularUsuario(existing, dto.userId);
    return this.createNewClient(dto);
  }

  /** Lista los clientes vinculados a un usuario, uno por cada negocio donde reservó. */
  @Get("by-user/:userId")
  async findByUser(@Param("userId") userId: string): Promise<Client[]> {
    return this.clientRepo.find({ where: { userId } });
  }

  /** Ata la ficha al usuario que reserva, si aun no tiene ninguno. */
  private async vincularUsuario(
    client: Client,
    userId?: string
  ): Promise<Client> {
    if (!userId || client.userId) return client;
    client.userId = userId;
    return this.clientRepo.save(client);
  }

  /** Busca un cliente del negocio por usuario, luego por email y luego por teléfono. */
  private async findExistingClient(
    dto: FindOrCreateClientDto
  ): Promise<Client | null> {
    if (dto.userId) {
      const byUser = await this.clientRepo.findOne({
        where: { businessId: dto.businessId, userId: dto.userId },
      });
      if (byUser) return byUser;
    }
    if (dto.email) {
      const byEmail = await this.clientRepo.findOne({
        where: { businessId: dto.businessId, email: dto.email },
      });
      if (byEmail) return byEmail;
    }
    if (dto.phone) {
      const byPhone = await this.clientRepo.findOne({
        where: { businessId: dto.businessId, phone: dto.phone },
      });
      if (byPhone) return byPhone;
    }
    return null;
  }

  /** Crea un cliente mínimo en el negocio a partir de los datos de la reserva. */
  private async createNewClient(dto: FindOrCreateClientDto): Promise<Client> {
    const client = new Client();
    client.businessId = dto.businessId;
    client.name = dto.name;
    client.email = dto.email ?? "";
    client.phone = dto.phone ?? "";
    client.userId = dto.userId ?? (null as unknown as string);
    client.tags = [];
    return this.clientRepo.save(client);
  }
}
