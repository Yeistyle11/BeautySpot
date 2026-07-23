import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { BullModule } from "@nestjs/bullmq";
import * as path from "path";
import { createTypeOrmModuleOptions } from "@beautyspot/database";
import { NotificationEntity } from "./modules/notifications/notification.entity";
import { NotificationPreferenceEntity } from "./modules/notification-preferences/notification-preference.entity";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { EmailsModule } from "./modules/emails/emails.module";
import { NotificationPreferencesModule } from "./modules/notification-preferences/notification-preferences.module";
import { EventListenersModule } from "./modules/event-listeners/event-listeners.module";

const entities = [NotificationEntity, NotificationPreferenceEntity];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.join(__dirname, "..", ".env"),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => createTypeOrmModuleOptions(entities),
    }),
    RabbitMQModule.forRoot({
      exchanges: [
        {
          name: "beautyspot.events",
          type: "topic",
        },
      ],
      uri: process.env.RABBITMQ_URL || "amqp://localhost:5672",
      connectionInitOptions: { wait: false },
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    EmailsModule,
    NotificationPreferencesModule,
    NotificationsModule,
    EventListenersModule,
  ],
})
export class AppModule {}
