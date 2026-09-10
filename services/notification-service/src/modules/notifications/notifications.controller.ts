import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
} from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import {
  CreateNotificationDto,
  QueryNotificationsDto,
} from "./dto/create-notification.dto";
import {
  Roles,
  CurrentUser,
  SkipBusinessScope,
  Internal,
} from "@beautyspot/nest-common";
import { parsePaginationQuery } from "@beautyspot/shared-utils";
import { Role } from "@beautyspot/shared-types";

/**
 * Endpoints de las notificaciones in-app del usuario autenticado. El
 * destinatario sale del token y el negocio sólo acota el listado: el cliente
 * final, que no pertenece a ninguno, las ve todas.
 */
@Controller("notifications")
@Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL, Role.CLIENT)
@SkipBusinessScope()
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  /** Lista las notificaciones del usuario, con opción de solo no leídas. */
  @Get()
  findByUser(
    @CurrentUser("userId") userId: string,
    @Headers("x-business-id") businessId: string | undefined,
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
    @Headers("x-business-id") businessId: string | undefined
  ) {
    return this.service.getUnreadCount(userId, businessId);
  }

  @Post(":id/read")
  markAsRead(@Param("id") id: string, @CurrentUser("userId") userId: string) {
    return this.service.markAsRead(id, userId);
  }

  @Post("mark-all-read")
  markAllAsRead(
    @CurrentUser("userId") userId: string,
    @Headers("x-business-id") businessId: string | undefined
  ) {
    return this.service.markAllAsRead(userId, businessId);
  }
}

/**
 * Alta de notificaciones para otros microservicios, tras el secreto interno que
 * el gateway nunca reenvía: el destinatario viaja en el cuerpo.
 */
@Internal()
@Controller("internal/notifications")
export class InternalNotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post()
  create(@Body() dto: CreateNotificationDto) {
    return this.service.create(dto);
  }
}
