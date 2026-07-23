import { Controller, Get, Post, Body, Param, Query } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import {
  CreateNotificationDto,
  QueryNotificationsDto,
} from "./dto/create-notification.dto";
import { Roles, CurrentUser, BusinessId } from "@beautyspot/nest-common";
import { parsePaginationQuery } from "@beautyspot/shared-utils";
import { Role } from "@beautyspot/shared-types";

@Controller("notifications")
@Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL, Role.CLIENT)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post()
  create(@Body() dto: CreateNotificationDto) {
    return this.service.create(dto);
  }

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

  @Get("unread-count")
  getUnreadCount(
    @CurrentUser("userId") userId: string,
    @BusinessId() businessId: string
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
    @BusinessId() businessId: string
  ) {
    return this.service.markAllAsRead(userId, businessId);
  }
}
