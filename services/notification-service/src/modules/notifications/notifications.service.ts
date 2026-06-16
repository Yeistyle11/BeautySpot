import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationEntity } from "./notification.entity";
import { NotificationType, NotificationChannel } from "@beautyspot/shared-types";

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(NotificationEntity) private readonly repo: Repository<NotificationEntity>) {}

  async create(data: {
    businessId: string; userId: string; type: NotificationType;
    title: string; message: string; data?: Record<string, unknown>;
    channel?: NotificationChannel;
  }): Promise<NotificationEntity> {
    const notification = this.repo.create({
      ...data,
      channel: data.channel || NotificationChannel.IN_APP,
    });
    return this.repo.save(notification);
  }

  async findByUser(userId: string, businessId: string, unreadOnly = false): Promise<NotificationEntity[]> {
    const where: Record<string, unknown> = { userId, businessId };
    if (unreadOnly) where.read = false;
    return this.repo.find({ where, order: { createdAt: "DESC" } });
  }

  async markAsRead(id: string, userId: string): Promise<NotificationEntity> {
    const notification = await this.repo.findOne({ where: { id, userId } });
    if (!notification) throw new NotFoundException("Notificación no encontrada");
    notification.read = true;
    return this.repo.save(notification);
  }

  async markAllAsRead(userId: string, businessId: string): Promise<void> {
    await this.repo.update({ userId, businessId, read: false }, { read: true });
  }

  async getUnreadCount(userId: string, businessId: string): Promise<number> {
    return this.repo.count({ where: { userId, businessId, read: false } });
  }
}
