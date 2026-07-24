import { Controller, Post, Body } from "@nestjs/common";
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
    if (existing) return existing;
    return this.createNewClient(dto);
  }

  /** Busca un cliente del negocio por email y luego por teléfono; null si no hay coincidencia. */
  private async findExistingClient(
    dto: FindOrCreateClientDto
  ): Promise<Client | null> {
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
    client.userId = null as unknown as string;
    client.tags = [];
    return this.clientRepo.save(client);
  }
}
