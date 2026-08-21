import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, In, Repository } from "typeorm";
import {
  escapeLikePattern,
  normalizarEmail,
  normalizarTelefono,
} from "@beautyspot/shared-utils";
import { Client } from "../../entities/client.entity";
import { FindOrCreateClientDto } from "./dto/find-or-create-client.dto";
import { MoverPuntosDto } from "./dto/mover-puntos.dto";
import { ClientsService } from "../clients/clients.service";

/** Tope de clientes que devuelve una búsqueda, para acotar el `IN` de booking. */
const MAXIMO_CLIENTES_BUSCADOS = 200;

/** Endpoint interno (servicio-a-servicio) para resolver el cliente de una reserva. */
@Controller("internal/clients")
export class InternalClientsController {
  constructor(
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
    private readonly clients: ClientsService
  ) {}

  /** Devuelve el cliente que coincida por email o telefono, o lo crea. */
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

  /**
   * Descuenta los puntos del cliente si le alcanzan y devuelve el saldo que le
   * queda. Responde 409 si no llegan: quien cobra necesita saberlo antes de
   * aplicar el descuento, no después.
   */
  @Post(":id/puntos/reservar")
  async reservarPuntos(
    @Param("id") id: string,
    @Body() dto: MoverPuntosDto
  ): Promise<{ loyaltyPoints: number }> {
    const pudo = await this.clients.redeemLoyaltyPoints(
      id,
      dto.businessId,
      dto.puntos
    );
    if (!pudo) {
      throw new ConflictException(
        "El cliente no tiene puntos suficientes o no pertenece a este negocio"
      );
    }
    return this.saldoDe(id, dto.businessId);
  }

  /**
   * Devuelve al cliente unos puntos ya reservados, cuando el cobro que los
   * gastaba no llegó a registrarse.
   */
  @Post(":id/puntos/devolver")
  async devolverPuntos(
    @Param("id") id: string,
    @Body() dto: MoverPuntosDto
  ): Promise<{ loyaltyPoints: number }> {
    await this.clients.addLoyaltyPoints(id, dto.businessId, dto.puntos);
    return this.saldoDe(id, dto.businessId);
  }

  /** Saldo de puntos del cliente tras moverlo. */
  private async saldoDe(
    id: string,
    businessId: string
  ): Promise<{ loyaltyPoints: number }> {
    const cliente = await this.clientRepo.findOne({
      where: { id, businessId },
      select: ["id", "loyaltyPoints"],
    });
    return { loyaltyPoints: cliente?.loyaltyPoints ?? 0 };
  }

  /**
   * Nombre de los clientes pedidos, acotado al negocio y resuelto en cada
   * lectura.
   */
  @Get("names")
  async names(
    @Query("businessId") businessId: string,
    @Query("ids") ids?: string
  ): Promise<{ id: string; name: string }[]> {
    const pedidos = (ids ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, MAXIMO_CLIENTES_BUSCADOS);

    if (!businessId || pedidos.length === 0) return [];

    return this.clientRepo.find({
      where: { businessId, id: In(pedidos) },
      select: { id: true, name: true },
    });
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
   * telefono, cotejando el contacto normalizado.
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
