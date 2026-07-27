import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { BullModule } from "@nestjs/bullmq";
import * as path from "path";
import { createTypeOrmModuleOptions } from "@beautyspot/database";
import { HealthModule, IdempotencyModule } from "@beautyspot/nest-common";
import { entities } from "./orm-entities";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { EmailsModule } from "./modules/emails/emails.module";
import { NotificationPreferencesModule } from "./modules/notification-preferences/notification-preferences.module";
import { EventListenersModule } from "./modules/event-listeners/event-listeners.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.join(__dirname, "..", ".env"),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => createTypeOrmModuleOptions(entities),
    }),
    RabbitMQModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        exchanges: [
          {
            name: "beautyspot.events",
            type: "topic",
          },
        ],
        uri: config.get<string>("RABBITMQ_URL") ?? "amqp://localhost:5672",
        connectionInitOptions: { wait: false },
      }),
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    IdempotencyModule,
    HealthModule,
    EmailsModule,
    NotificationPreferencesModule,
    NotificationsModule,
    EventListenersModule,
  ],
})
/** Módulo raíz del notification-service: notificaciones in-app, correos y listeners de eventos. */
export class AppModule {}
