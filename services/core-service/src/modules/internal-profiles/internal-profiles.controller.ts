import { Controller, Get, Query } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Client } from "../../entities/client.entity";
import { Professional } from "../../entities/professional.entity";
import { Business } from "../../entities/business.entity";
import { BusinessConfig } from "../../entities/business-config.entity";
import { ZONA_POR_DEFECTO } from "@beautyspot/shared-utils";

export interface ResolvedClient {
  name: string;
  email: string;
  phone: string;
  /** Documento de identidad; vacío si el cliente no lo aportó. */
  documento: string;
  /** Cuenta asociada, si la ficha corresponde a un usuario registrado. */
  userId: string | null;
}

export interface ResolvedProfessional {
  name: string;
}

/** Datos fiscales que el negocio configura para emitir sus facturas. */
export interface DatosDeFacturacion {
  nit?: string;
  razonSocial?: string;
  regimen?: string;
  direccionFiscal?: string;
}

export interface ResolvedBusiness {
  name: string;
  address: string;
  phone: string;
  email: string;
  /** Huso en el que el negocio lee sus horas; decide dónde empieza su día. */
  timezone: string;
  /** Vacío mientras el negocio no haya configurado su facturación. */
  facturacion: DatosDeFacturacion;
}

/** Clave de `business_config` donde viven los datos fiscales del negocio. */
export const CLAVE_FACTURACION = "facturacion";

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
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(BusinessConfig)
    private readonly configRepo: Repository<BusinessConfig>
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

  /** Nombre y datos de contacto e identificación del cliente indicado. */
  private async resolveClient(id: string): Promise<ResolvedClient | null> {
    const c = await this.clientRepo.findOne({
      where: { id },
      select: ["name", "email", "phone", "documento", "userId"],
    });
    if (!c) return null;
    // El invitado que reserva sin cuenta no tiene usuario, y sin él no se le
    // puede dejar una notificación dentro de la aplicación.
    return {
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      documento: c.documento ?? "",
      userId: c.userId ?? null,
    };
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

  /** Nombre, contacto y datos fiscales del negocio indicado. */
  private async resolveBusiness(id: string): Promise<ResolvedBusiness | null> {
    const [b, config] = await Promise.all([
      this.businessRepo.findOne({
        where: { id },
        select: ["name", "address", "phone", "email", "timezone"],
      }),
      // Los datos fiscales viven en business_config y no en columnas propias:
      // la facturación electrónica va a necesitar bastantes más campos que un
      // NIT, y ahí crecen sin migrar el esquema.
      this.configRepo.findOne({
        where: { businessId: id, key: CLAVE_FACTURACION },
      }),
    ]);
    if (!b) return null;
    return {
      name: b.name,
      address: b.address ?? "",
      phone: b.phone ?? "",
      email: b.email ?? "",
      timezone: b.timezone ?? ZONA_POR_DEFECTO,
      facturacion: (config?.value as DatosDeFacturacion) ?? {},
    };
  }
}
