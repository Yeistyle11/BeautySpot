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

/** Datos para crear una notificación: usuario, tipo, título, mensaje y canal. */
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

/** Filtros del listado de notificaciones (p. ej. solo no leídas). */
export class QueryNotificationsDto {
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;
}
