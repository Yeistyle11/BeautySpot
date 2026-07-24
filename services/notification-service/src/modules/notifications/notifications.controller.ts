import { Controller, Get, Post, Body, Param, Query } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import {
  CreateNotificationDto,
  QueryNotificationsDto,
} from "./dto/create-notification.dto";
import { Roles, CurrentUser, BusinessId } from "@beautyspot/nest-common";
import { parsePaginationQuery } from "@beautyspot/shared-utils";
import { Role } from "@beautyspot/shared-types";

/** Endpoints de las notificaciones in-app del usuario autenticado. */
@Controller("notifications")
@Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL, Role.CLIENT)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  /** Crea una notificación. */
  @Post()
  create(@Body() dto: CreateNotificationDto) {
    return this.service.create(dto);
  }

  /** Lista las notificaciones del usuario, con opción de solo no leídas. */
  @Get()
  findByUser(
    @CurrentUser("userId") userId: string,
    @BusinessId() businessId: string,
    @Query() query: QueryNotificationsDto & Record<string, unknown>
  ) {
    const pagination = parsePaginationQuery(query, ["createdAt"]);
    return this.service.findByUser(
      userId,
      businessId,
      query.unreadOnly ?? false,
      pagination
    );
  }

  /** Devuelve el número de notificaciones no leídas del usuario. */
  @Get("unread-count")
  getUnreadCount(
    @CurrentUser("userId") userId: string,
    @BusinessId() businessId: string
  ) {
    return this.service.getUnreadCount(userId, businessId);
  }

  /** Marca una notificación como leída. */
  @Post(":id/read")
  markAsRead(@Param("id") id: string, @CurrentUser("userId") userId: string) {
    return this.service.markAsRead(id, userId);
  }

  /** Marca todas las notificaciones del usuario como leídas. */
  @Post("mark-all-read")
  markAllAsRead(
    @CurrentUser("userId") userId: string,
    @BusinessId() businessId: string
  ) {
    return this.service.markAllAsRead(userId, businessId);
  }
}
