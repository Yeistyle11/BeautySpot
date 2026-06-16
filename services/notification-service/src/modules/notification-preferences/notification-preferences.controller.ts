import { Controller, Get, Post, Body, Headers } from "@nestjs/common";
import { NotificationPreferencesService } from "./notification-preferences.service";
import { IsBoolean, IsEnum, IsString } from "class-validator";
import { NotificationType, NotificationChannel } from "@beautyspot/shared-types";
import { Roles } from "@beautyspot/nest-common";
import { Role } from "@beautyspot/shared-types";

class UpsertPreferenceDto {
  @IsString()
  @IsEnum(NotificationType)
  type!: string;

  @IsString()
  @IsEnum(NotificationChannel)
  channel!: string;

  @IsBoolean()
  enabled!: boolean;
}

@Controller("notification-preferences")
@Roles(Role.OWNER, Role.ADMIN, Role.PROFESSIONAL)
export class NotificationPreferencesController {
  constructor(private readonly service: NotificationPreferencesService) {}

  @Get()
  findByUser(@Headers("x-user-id") userId: string, @Headers("x-business-id") businessId: string) {
    return this.service.findByUser(userId, businessId);
  }

  @Post()
  upsert(
    @Body() dto: UpsertPreferenceDto,
    @Headers("x-user-id") userId: string,
    @Headers("x-business-id") businessId: string,
  ) {
    return this.service.upsert({ ...dto, userId, businessId });
  }
}
