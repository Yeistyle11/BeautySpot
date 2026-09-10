import { Internal } from "@beautyspot/nest-common";
import { Controller, Post, Body, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Service } from "../../entities/service.entity";
import { PreciosService } from "../precios/precios.service";
import type { ServicioResuelto } from "../precios/precios.service";
import { ResolveServicesDto } from "./dto/resolve-services.dto";

export type { ServicioResuelto };

/**
 * Endpoint interno (servicio-a-servicio) para que booking calcule el importe y
 * la duración de una cita con el catálogo real, en vez de con lo que envíe el
 * navegador.
 */
@Internal()
@Controller("internal/services")
export class InternalServicesController {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepo: Repository<Service>,
    private readonly precios: PreciosService
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

    const personalizados = await this.precios.tarifasDe(
      ids,
      dto.professionalId
    );

    const porId = new Map(servicios.map((s) => [s.id, s]));

    // En el orden en que los pidió booking, que es el del reparto de la agenda.
    return ids.map((id) =>
      this.precios.resolver(porId.get(id)!, personalizados.get(id))
    );
  }
}
