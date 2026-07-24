import { Module } from "@nestjs/common";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { CoreEventListeners } from "./core-event-listeners.service";

@Module({
  imports: [
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
  providers: [CoreEventListeners],
  exports: [CoreEventListeners],
})
/** Registra los listeners de eventos de RabbitMQ del core. */
export class CoreEventListenersModule {}
