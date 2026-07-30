import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationEntity } from "./notification.entity";
import { NotificationsService } from "./notifications.service";
import {
  NotificationsController,
  InternalNotificationsController,
} from "./notifications.controller";
import { NotificationPreferencesModule } from "../notification-preferences/notification-preferences.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationEntity]),
    NotificationPreferencesModule,
  ],
  controllers: [NotificationsController, InternalNotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
/** Cablea la gestión de notificaciones in-app. */
export class NotificationsModule {}
