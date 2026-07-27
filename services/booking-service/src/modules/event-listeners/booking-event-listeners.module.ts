import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { EVENTS_EXCHANGE, DEAD_LETTER_EXCHANGE } from "@beautyspot/event-types";
import { BookingEventListeners } from "./booking-event-listeners.service";
import { AvailabilityModule } from "../availability/availability.module";

@Module({
  imports: [
    AvailabilityModule,
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
  providers: [BookingEventListeners],
  exports: [BookingEventListeners],
})
/** Registra los listeners de eventos de RabbitMQ del booking-service. */
export class BookingEventListenersModule {}
