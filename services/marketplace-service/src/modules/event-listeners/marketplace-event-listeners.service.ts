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
import { BusinessProfilesService } from "../business-profiles/business-profiles.service";

/**
 * Campos del negocio que el perfil público duplica, y con qué nombre los guarda.
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
    private readonly repo: Repository<BusinessProfileEntity>,
    private readonly profiles: BusinessProfilesService
  ) {}

  /**
   * Copia al perfil público los campos que hayan cambiado en el negocio, si ya
   * tiene perfil, e invalida su caché. Repetir el parche deja el mismo estado,
   * así que no lleva control de duplicados.
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

    await this.profiles.invalidarCache(businessId);

    this.logger.log(
      `Perfil de ${businessId} sincronizado: ${Object.keys(parche).join(", ")}`
    );
  }
}
