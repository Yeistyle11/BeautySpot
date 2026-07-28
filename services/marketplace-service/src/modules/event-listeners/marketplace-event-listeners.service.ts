import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import {
  BusinessUpdatedEvent,
  EventNames,
  EVENTS_EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  nombreDeCola,
} from "@beautyspot/event-types";
import { BusinessProfileEntity } from "../../entities/business-profile.entity";

/**
 * Campos del negocio que el perfil público duplica, y con qué nombre los guarda.
 * Lo que no aparece aquí (moneda, zona horaria, plan) no se muestra al público.
 */
const CAMPOS_ESPEJADOS: Record<string, keyof BusinessProfileEntity> = {
  name: "name",
  description: "description",
  logo: "logo",
  coverImage: "coverImage",
  phone: "phone",
  email: "email",
  address: "address",
  city: "city",
  state: "state",
  country: "country",
  latitude: "lat",
  longitude: "lng",
  businessType: "businessType",
};

/** Mantiene al día la copia que el marketplace guarda de los datos del negocio. */
@Injectable()
export class MarketplaceEventListeners {
  private readonly logger = new Logger(MarketplaceEventListeners.name);

  constructor(
    @InjectRepository(BusinessProfileEntity)
    private readonly repo: Repository<BusinessProfileEntity>
  ) {}

  /**
   * Copia al perfil público los campos que hayan cambiado en el negocio.
   *
   * El perfil nace desde el propio marketplace, no desde este evento: si el
   * negocio aún no tiene uno, no hay nada que sincronizar.
   */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.CORE_BUSINESS_UPDATED,
    queue: nombreDeCola("marketplace", EventNames.CORE_BUSINESS_UPDATED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleBusinessUpdated(event: BusinessUpdatedEvent): Promise<void> {
    const { businessId, changes } = event.payload;

    const parche: Partial<BusinessProfileEntity> = {};
    for (const [campoNegocio, campoPerfil] of Object.entries(
      CAMPOS_ESPEJADOS
    )) {
      if (campoNegocio in changes) {
        // El destino es heterogéneo (texto y decimales), y el origen viene del
        // contrato como `unknown`: la forma la garantiza CAMPOS_ESPEJADOS.
        (parche as Record<string, unknown>)[campoPerfil] =
          changes[campoNegocio];
      }
    }

    if (Object.keys(parche).length === 0) return;

    const actualizado = await this.repo.update({ businessId }, parche);
    if (!actualizado.affected) {
      this.logger.debug(
        `El negocio ${businessId} no tiene perfil publico todavia`
      );
      return;
    }

    this.logger.log(
      `Perfil de ${businessId} sincronizado: ${Object.keys(parche).join(", ")}`
    );
  }
}
