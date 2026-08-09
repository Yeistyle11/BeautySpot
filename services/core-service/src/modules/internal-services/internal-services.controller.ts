import { Controller, Post, Body, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Service } from "../../entities/service.entity";
import { ProfessionalService } from "../../entities/professional-service.entity";
import { ResolveServicesDto } from "./dto/resolve-services.dto";

/** Servicio con el precio y la duración que se aplican a una reserva concreta. */
export interface ServicioResuelto {
  id: string;
  name: string;
  price: number;
  duration: number;
}

/**
 * Endpoint interno (servicio-a-servicio) para que booking calcule el importe y
 * la duración de una cita con el catálogo real, en vez de con lo que envíe el
 * navegador.
 */
@Controller("internal/services")
export class InternalServicesController {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    @InjectRepository(ProfessionalService)
    private readonly professionalServiceRepo: Repository<ProfessionalService>
  ) {}

  /**
   * Devuelve precio y duración de los servicios pedidos. Falla si alguno no
   * existe, está inactivo o es de otro negocio: es la comprobación que impide
   * reservar un servicio ajeno al negocio que se está reservando.
   */
  @Post("resolve")
  async resolve(@Body() dto: ResolveServicesDto): Promise<ServicioResuelto[]> {
    const ids = [...new Set(dto.ids)];
    const servicios = await this.serviceRepo.find({
      where: { id: In(ids), businessId: dto.businessId, active: true },
    });

    if (servicios.length !== ids.length) {
      throw new BadRequestException(
        "Alguno de los servicios no existe, no esta activo o no pertenece al negocio"
      );
    }

    const personalizados = await this.preciosDelProfesional(
      ids,
      dto.professionalId
    );

    return servicios.map((servicio) => {
      const propio = personalizados.get(servicio.id);
      return {
        id: servicio.id,
        name: servicio.name,
        price: propio?.customPrice ?? servicio.price,
        duration: propio?.customDuration ?? servicio.duration,
      };
    });
  }

  /**
   * Precio y duración propios del profesional para esos servicios. Las columnas
   * son nullable aunque el tipo diga `number`, así que el `??` de quien llame
   * es el que decide si hay valor propio.
   */
  private async preciosDelProfesional(
    serviceIds: string[],
    professionalId?: string
  ): Promise<Map<string, ProfessionalService>> {
    if (!professionalId) return new Map();

    const filas = await this.professionalServiceRepo.find({
      where: { professionalId, serviceId: In(serviceIds) },
    });

    return new Map(filas.map((fila) => [fila.serviceId, fila]));
  }
}
