import { Controller, Post, Get, Body, Param, Query } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, Repository } from "typeorm";
import {
  escapeLikePattern,
  normalizarEmail,
  normalizarTelefono,
} from "@beautyspot/shared-utils";
import { Client } from "../../entities/client.entity";
import { FindOrCreateClientDto } from "./dto/find-or-create-client.dto";

/** Tope de clientes que devuelve una búsqueda, para acotar el `IN` de booking. */
const MAXIMO_CLIENTES_BUSCADOS = 200;

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

  /** Puntos de fidelidad disponibles del cliente, para quien vaya a canjearlos. */
  @Get(":id/puntos")
  async puntos(
    @Param("id") id: string,
    @Query("businessId") businessId: string
  ): Promise<{ loyaltyPoints: number } | null> {
    const cliente = await this.clientRepo.findOne({
      where: { id, businessId },
      select: ["id", "loyaltyPoints"],
    });
    return cliente ? { loyaltyPoints: cliente.loyaltyPoints } : null;
  }

  /** Lista los clientes vinculados a un usuario, uno por cada negocio donde reservó. */
  @Get("by-user/:userId")
  async findByUser(@Param("userId") userId: string): Promise<Client[]> {
    return this.clientRepo.find({ where: { userId } });
  }

  /**
   * Ids de los clientes del negocio que casan con el texto por nombre, email o
   * teléfono. Lo usa booking para buscar citas por cliente.
   */
  @Get("search")
  async search(
    @Query("businessId") businessId: string,
    @Query("q") q: string
  ): Promise<string[]> {
    if (!businessId || !q?.trim()) return [];

    const patron = `%${escapeLikePattern(q.trim())}%`;
    const clientes = await this.clientRepo.find({
      where: [
        { businessId, name: ILike(patron) },
        { businessId, email: ILike(patron) },
        { businessId, phone: ILike(patron) },
      ],
      select: ["id"],
      take: MAXIMO_CLIENTES_BUSCADOS,
    });

    return clientes.map((c) => c.id);
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

  /**
   * Busca un cliente del negocio por usuario, luego por email y luego por
   * teléfono. El contacto se coteja normalizado: "+57 300 123 4567" y
   * "+573001234567" son la misma persona.
   */
  private async findExistingClient(
    dto: FindOrCreateClientDto
  ): Promise<Client | null> {
    if (dto.userId) {
      const byUser = await this.clientRepo.findOne({
        where: { businessId: dto.businessId, userId: dto.userId },
      });
      if (byUser) return byUser;
    }

    const email = normalizarEmail(dto.email);
    if (email) {
      const byEmail = await this.clientRepo.findOne({
        where: { businessId: dto.businessId, email },
      });
      if (byEmail) return byEmail;
    }

    const phone = normalizarTelefono(dto.phone);
    if (phone) {
      const byPhone = await this.clientRepo.findOne({
        where: { businessId: dto.businessId, phone },
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
    client.email = normalizarEmail(dto.email);
    client.phone = normalizarTelefono(dto.phone);
    client.userId = dto.userId ?? (null as unknown as string);
    client.tags = [];
    return this.clientRepo.save(client);
  }
}
