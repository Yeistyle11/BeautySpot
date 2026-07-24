import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationEntity } from "./notification.entity";
import {
  NotificationType,
  NotificationChannel,
  IPaginatedResponse,
} from "@beautyspot/shared-types";
import { paginate, PaginateParams } from "@beautyspot/database";

/** Gestiona las notificaciones in-app de cada usuario: creación, listado y marcado de lectura. */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly repo: Repository<NotificationEntity>
  ) {}

  /** Crea una notificación para un usuario (canal in-app por defecto). */
  async create(data: {
    businessId: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    channel?: NotificationChannel;
  }): Promise<NotificationEntity> {
    const notification = this.repo.create({
      ...data,
      channel: data.channel || NotificationChannel.IN_APP,
    });
    return this.repo.save(notification);
  }

  /** Lista las notificaciones del usuario (opcionalmente solo no leídas) con paginación. */
  async findByUser(
    userId: string,
    businessId: string,
    unreadOnly: boolean,
    pagination: PaginateParams
  ): Promise<IPaginatedResponse<NotificationEntity>> {
    const where: Record<string, unknown> = { userId, businessId };
    if (unreadOnly) where.read = false;
    return paginate(this.repo, pagination, {
      where,
      order: { createdAt: "DESC" },
    });
  }

  /** Marca una notificación del usuario como leída; lanza 404 si no existe. */
  async markAsRead(id: string, userId: string): Promise<NotificationEntity> {
    const notification = await this.repo.findOne({ where: { id, userId } });
    if (!notification)
      throw new NotFoundException("Notificación no encontrada");
    notification.read = true;
    return this.repo.save(notification);
  }

  /** Marca como leídas todas las notificaciones no leídas del usuario en el negocio. */
  async markAllAsRead(userId: string, businessId: string): Promise<void> {
    await this.repo.update({ userId, businessId, read: false }, { read: true });
  }

  /** Devuelve el número de notificaciones no leídas del usuario. */
  async getUnreadCount(userId: string, businessId: string): Promise<number> {
    return this.repo.count({ where: { userId, businessId, read: false } });
  }
}
