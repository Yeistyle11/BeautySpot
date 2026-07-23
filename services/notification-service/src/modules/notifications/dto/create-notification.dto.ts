import {
  IsEnum,
  IsUUID,
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
} from "class-validator";
import {
  NotificationType,
  NotificationChannel,
} from "@beautyspot/shared-types";

export class CreateNotificationDto {
  @IsUUID()
  businessId!: string;

  @IsUUID()
  userId!: string;

  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsString()
  title!: string;

  @IsString()
  message!: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;
}

export class QueryNotificationsDto {
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;
}
