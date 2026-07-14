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

export interface ProfileResolution {
  client: ResolvedClient | null;
  professional: ResolvedProfessional | null;
  business: ResolvedBusiness | null;
}

/** Internal endpoint — protegido por InternalSecretGuard (requiere header x-internal-secret) */
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

  private async resolveClient(id: string): Promise<ResolvedClient | null> {
    const c = await this.clientRepo.findOne({
      where: { id },
      select: ["name", "email"],
    });
    if (!c) return null;
    return { name: c.name, email: c.email ?? "" };
  }

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
