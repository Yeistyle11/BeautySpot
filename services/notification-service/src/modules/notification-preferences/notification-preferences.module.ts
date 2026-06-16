import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationPreferenceEntity } from "./notification-preference.entity";
import { NotificationPreferencesService } from "./notification-preferences.service";
import { NotificationPreferencesController } from "./notification-preferences.controller";

@Module({
  imports: [TypeOrmModule.forFeature([NotificationPreferenceEntity])],
  controllers: [NotificationPreferencesController],
  providers: [NotificationPreferencesService],
  exports: [NotificationPreferencesService],
})
export class NotificationPreferencesModule {}
