import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { EVENTS_EXCHANGE, DEAD_LETTER_EXCHANGE } from "@beautyspot/event-types";
import { NotificationEventListeners } from "./event-listeners.service";
import { EmailsModule } from "../emails/emails.module";
import { DataEnricherModule } from "../data-enricher/data-enricher.module";

@Module({
  imports: [
    EmailsModule,
    DataEnricherModule,
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
/** Registra los listeners de eventos que disparan el envío de correos. */
export class EventListenersModule {}
