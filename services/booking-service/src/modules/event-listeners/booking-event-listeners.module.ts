import { Module } from "@nestjs/common";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { BookingEventListeners } from "./booking-event-listeners.service";
import { AvailabilityModule } from "../availability/availability.module";

@Module({
  imports: [
    AvailabilityModule,
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
  ],
  providers: [BookingEventListeners],
  exports: [BookingEventListeners],
})
/** Registra los listeners de eventos de RabbitMQ del booking-service. */
export class BookingEventListenersModule {}
