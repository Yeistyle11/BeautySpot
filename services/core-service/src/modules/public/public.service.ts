import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { escapeLikePattern } from "@beautyspot/shared-utils";
import { Business } from "../../entities/business.entity";
import { Service } from "../../entities/service.entity";
import { Professional } from "../../entities/professional.entity";
import { PreciosService } from "../precios/precios.service";

/** Servicio tal como lo ve quien reserva desde el escaparate. */
export interface ServicioPublico {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
  /**
   * El precio depende de con quién se atienda y todavía no hay profesional
   * elegido: lo que se enseña es el del catálogo, y se dice «desde».
   */
  precioVariable?: boolean;
}

/**
 * Consultas públicas (sin autenticación) de negocios, servicios y profesionales,
 * devolviendo solo los campos aptos para mostrar en el marketplace.
 */
@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepo: Repository<Business>,
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(Professional)
    private readonly proRepo: Repository<Professional>,
    private readonly precios: PreciosService
  ) {}

  /** Lista negocios activos con filtro opcional por nombre y ciudad (máx. 50). */
  async listBusinesses(q?: string, city?: string) {
    const qb = this.businessRepo
      .createQueryBuilder("b")
      .where("b.active = true")
      .select([
        "b.id",
        "b.slug",
        "b.name",
        "b.description",
        "b.city",
        "b.address",
        "b.phone",
        "b.logo",
        "b.coverImage",
        "b.businessType",
      ]);

    if (q) qb.andWhere("b.name ILIKE :q", { q: `%${escapeLikePattern(q)}%` });
    if (city)
      qb.andWhere("b.city ILIKE :city", {
        city: `%${escapeLikePattern(city)}%`,
      });

    return qb.limit(50).getMany();
  }

  /** Devuelve el perfil público de un negocio activo por su slug. */
  async getBusinessBySlug(slug: string) {
    const business = await this.businessRepo.findOne({
      where: { slug, active: true },
      select: [
        "id",
        "slug",
        "name",
        "description",
        "city",
        "address",
        "phone",
        "logo",
        "coverImage",
        "businessType",
        "website",
        "currency",
        "timezone",
      ],
    });
    return business;
  }

  /**
   * Lista los servicios activos de un negocio para su perfil público, con el
   * precio y la duración que se van a aplicar. Con profesional elegido va su
   * tarifa; sin él, la del catálogo marcando cuáles pueden variar.
   */
  async getBusinessServices(
    businessId: string,
    professionalId?: string
  ): Promise<ServicioPublico[]> {
    const servicios = await this.serviceRepo.find({
      where: { businessId, active: true },
      select: [
        "id",
        "name",
        "description",
        "price",
        "duration",
        "category",
        "procesadoDesde",
        "procesadoMinutos",
        "bufferDespues",
      ],
    });

    const ids = servicios.map((s) => s.id);

    if (professionalId) {
      await this.exigirProfesionalDelNegocio(businessId, professionalId);
      const tarifas = await this.precios.tarifasDe(ids, professionalId);

      return servicios.map((servicio) => {
        const efectivo = this.precios.resolver(
          servicio,
          tarifas.get(servicio.id)
        );
        return {
          ...this.comoPublico(servicio),
          price: efectivo.price,
          duration: efectivo.duration,
        };
      });
    }

    const variables = await this.precios.idsConTarifaPropia(ids);

    return servicios.map((servicio) => ({
      ...this.comoPublico(servicio),
      precioVariable: variables.has(servicio.id),
    }));
  }

  /** Los campos del servicio que se publican, sin los del reparto de agenda. */
  private comoPublico(servicio: Service): ServicioPublico {
    return {
      id: servicio.id,
      name: servicio.name,
      description: servicio.description,
      price: servicio.price,
      duration: servicio.duration,
      category: servicio.category,
    };
  }

  /**
   * Corta la tarifa de un profesional de otro negocio: la ruta es pública y el
   * identificador llega del navegador.
   */
  private async exigirProfesionalDelNegocio(
    businessId: string,
    professionalId: string
  ): Promise<void> {
    const suyo = await this.proRepo.findOne({
      where: { id: professionalId, businessId, active: true },
      select: ["id"],
    });
    if (!suyo) {
      throw new BadRequestException(
        "El profesional indicado no es de este negocio"
      );
    }
  }

  /** Lista los profesionales activos de un negocio para su perfil público. */
  async getBusinessProfessionals(businessId: string) {
    return this.proRepo.find({
      where: { businessId, active: true },
      select: [
        "id",
        "name",
        "photo",
        "bio",
        "specialties",
        "yearsExp",
        "rating",
        "totalReviews",
      ],
    });
  }
}
