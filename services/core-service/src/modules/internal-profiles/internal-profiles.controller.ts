import { Controller, Get, Query } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Client } from "../../entities/client.entity";
import { Professional } from "../../entities/professional.entity";
import { Business } from "../../entities/business.entity";

export interface ResolvedClient {
  name: string;
  email: string;
}

export interface ResolvedProfessional {
  name: string;
}

export interface ResolvedBusiness {
  name: string;
  address: string;
  phone: string;
}

/** Datos resueltos de cliente, profesional y negocio para enriquecer notificaciones/documentos. */
export interface ProfileResolution {
  client: ResolvedClient | null;
  professional: ResolvedProfessional | null;
  business: ResolvedBusiness | null;
}

/**
 * Endpoint interno (protegido por InternalSecretGuard) que traduce ids de
 * cliente, profesional y negocio a sus nombres y datos de contacto.
 */
@Controller("internal/profiles")
export class InternalProfilesController {
  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Professional)
    private readonly professionalRepo: Repository<Professional>,
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>
  ) {}

  /** Resuelve en paralelo los datos de los ids recibidos; cada campo es null si no se pidió o no existe. */
  @Get("resolve")
  async resolve(
    @Query("clientId") clientId?: string,
    @Query("professionalId") professionalId?: string,
    @Query("businessId") businessId?: string
  ): Promise<ProfileResolution> {
    const [client, professional, business] = await Promise.all([
      clientId ? this.resolveClient(clientId) : null,
      professionalId ? this.resolveProfessional(professionalId) : null,
      businessId ? this.resolveBusiness(businessId) : null,
    ]);

    return { client, professional, business };
  }

  /** Nombre y email del cliente indicado. */
  private async resolveClient(id: string): Promise<ResolvedClient | null> {
    const c = await this.clientRepo.findOne({
      where: { id },
      select: ["name", "email"],
    });
    if (!c) return null;
    return { name: c.name, email: c.email ?? "" };
  }

  /** Nombre del profesional indicado. */
  private async resolveProfessional(
    id: string
  ): Promise<ResolvedProfessional | null> {
    const p = await this.professionalRepo.findOne({
      where: { id },
      select: ["name"],
    });
    if (!p) return null;
    return { name: p.name };
  }

  /** Nombre y datos de contacto del negocio indicado. */
  private async resolveBusiness(id: string): Promise<ResolvedBusiness | null> {
    const b = await this.businessRepo.findOne({
      where: { id },
      select: ["name", "address", "phone"],
    });
    if (!b) return null;
    return {
      name: b.name,
      address: b.address ?? "",
      phone: b.phone ?? "",
    };
  }
}
