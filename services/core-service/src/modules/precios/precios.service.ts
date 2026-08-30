import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Not, IsNull, Repository } from "typeorm";
import { Service } from "../../entities/service.entity";
import { ProfessionalService } from "../../entities/professional-service.entity";

/** Servicio con el precio y la duración que se aplican a una reserva concreta. */
export interface ServicioResuelto {
  id: string;
  name: string;
  price: number;
  duration: number;
  /** Ventana en que el profesional queda libre dentro del servicio. */
  procesadoDesde: number | null;
  procesadoMinutos: number | null;
  /** Limpieza posterior, en la que sigue ocupado. */
  bufferDespues: number;
}

/**
 * Tarifa efectiva de un servicio: la del catálogo, salvo que el profesional que
 * lo atiende tenga la suya.
 *
 * Vive aquí y no dentro de un controlador porque la aplican dos sitios que
 * tienen que coincidir: lo que el escaparate le enseña al cliente y lo que la
 * agenda le cobra. Enseñar un precio y cobrar otro es la manera más rápida de
 * perder a alguien en el mostrador.
 */
@Injectable()
export class PreciosService {
  constructor(
    @InjectRepository(ProfessionalService)
    private readonly tarifasRepo: Repository<ProfessionalService>
  ) {}

  /**
   * Tarifas propias del profesional para esos servicios, indexadas por
   * servicio. Las columnas son nullable aunque el tipo diga `number`, así que
   * es el `??` de `resolver` el que decide si hay valor propio.
   */
  async tarifasDe(
    serviceIds: string[],
    professionalId?: string
  ): Promise<Map<string, ProfessionalService>> {
    if (!professionalId || serviceIds.length === 0) return new Map();

    const filas = await this.tarifasRepo.find({
      where: { professionalId, serviceId: In(serviceIds) },
    });

    return new Map(filas.map((fila) => [fila.serviceId, fila]));
  }

  /** Aplica al servicio los valores propios del profesional, si los tiene. */
  resolver(servicio: Service, propia?: ProfessionalService): ServicioResuelto {
    const duration = propia?.customDuration ?? servicio.duration;

    // La ventana solo se propaga si sigue cabiendo en la duración efectiva.
    const cabe =
      servicio.procesadoDesde !== null &&
      servicio.procesadoMinutos !== null &&
      servicio.procesadoDesde + servicio.procesadoMinutos <= duration;

    return {
      id: servicio.id,
      name: servicio.name,
      price: propia?.customPrice ?? servicio.price,
      duration,
      procesadoDesde: cabe ? servicio.procesadoDesde : null,
      procesadoMinutos: cabe ? servicio.procesadoMinutos : null,
      bufferDespues: servicio.bufferDespues,
    };
  }

  /**
   * De esos servicios, los que algún profesional cobra o dura distinto. Es lo
   * que permite decir «desde» cuando el cliente aún no ha elegido con quién se
   * atiende y el precio, por tanto, todavía no está decidido.
   */
  async idsConTarifaPropia(serviceIds: string[]): Promise<Set<string>> {
    if (serviceIds.length === 0) return new Set();

    const filas = await this.tarifasRepo.find({
      where: [
        { serviceId: In(serviceIds), customPrice: Not(IsNull()) },
        { serviceId: In(serviceIds), customDuration: Not(IsNull()) },
      ],
      select: ["serviceId"],
    });

    return new Set(filas.map((fila) => fila.serviceId));
  }
}
