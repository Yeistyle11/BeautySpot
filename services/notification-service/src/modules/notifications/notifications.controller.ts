import { Controller, Get, Post, Body, Param, Query, Req } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { CreateNotificationDto, QueryNotificationsDto } from "./dto/create-notification.dto";
import { Roles, CurrentUser } from "@beautyspot/nest-common";
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
    @Req() req: any,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.service.findByUser(userId, req.businessId, query.unreadOnly);
  }

  @Get("unread-count")
  getUnreadCount(@CurrentUser("userId") userId: string, @Req() req: any) {
    return this.service.getUnreadCount(userId, req.businessId);
  }

  @Post(":id/read")
  markAsRead(@Param("id") id: string, @CurrentUser("userId") userId: string) {
    return this.service.markAsRead(id, userId);
  }

  @Post("mark-all-read")
  markAllAsRead(@CurrentUser("userId") userId: string, @Req() req: any) {
    return this.service.markAllAsRead(userId, req.businessId);
  }
}
