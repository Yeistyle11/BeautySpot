import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { EVENTS_EXCHANGE, DEAD_LETTER_EXCHANGE } from "@beautyspot/event-types";
import { NotificationEventListeners } from "./event-listeners.service";
import { EmailsModule } from "../emails/emails.module";
import { DataEnricherModule } from "../data-enricher/data-enricher.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { NotificationPreferencesModule } from "../notification-preferences/notification-preferences.module";

@Module({
  imports: [
    EmailsModule,
    DataEnricherModule,
    NotificationsModule,
    NotificationPreferencesModule,
    RabbitMQModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        exchanges: [
          { name: EVENTS_EXCHANGE, type: "topic" },
          { name: DEAD_LETTER_EXCHANGE, type: "topic" },
        ],
        uri: config.get<string>("RABBITMQ_URL") ?? "amqp://localhost:5672",
        connectionInitOptions: { wait: false },
      }),
    }),
  ],
  providers: [NotificationEventListeners],
  exports: [NotificationEventListeners],
})
/** Registra los listeners que avisan al cliente por correo y en la aplicación. */
export class EventListenersModule {}
