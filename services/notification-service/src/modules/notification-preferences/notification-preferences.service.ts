import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationPreferenceEntity } from "./notification-preference.entity";

/** Gestiona las preferencias de notificación por usuario (qué tipos recibir y por qué canal). */
@Injectable()
export class NotificationPreferencesService {
  constructor(
    @InjectRepository(NotificationPreferenceEntity)
    private readonly repo: Repository<NotificationPreferenceEntity>
  ) {}

  /** Devuelve todas las preferencias del usuario en el negocio. */
  async findByUser(
    userId: string,
    businessId: string
  ): Promise<NotificationPreferenceEntity[]> {
    return this.repo.find({ where: { userId, businessId } });
  }

  /** Crea o actualiza la preferencia de un tipo+canal para el usuario. */
  async upsert(data: {
    businessId: string;
    userId: string;
    type: string;
    channel: string;
    enabled: boolean;
  }): Promise<NotificationPreferenceEntity> {
    const existing = await this.repo.findOne({
      where: {
        businessId: data.businessId,
        userId: data.userId,
        type: data.type,
        channel: data.channel,
      },
    });

    if (existing) {
      existing.enabled = data.enabled;
      return this.repo.save(existing);
    }

    return this.repo.save(this.repo.create(data));
  }

  /** Indica si el usuario acepta ese tipo+canal; por defecto true si no hay preferencia. */
  async isNotificationEnabled(
    userId: string,
    businessId: string,
    type: string,
    channel: string
  ): Promise<boolean> {
    const pref = await this.repo.findOne({
      where: { userId, businessId, type, channel },
    });
    return pref ? pref.enabled : true;
  }
}
