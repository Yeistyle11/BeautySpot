import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { PaymentEventListeners } from "./payment-event-listeners.service";

@Module({
  imports: [
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
  ],
  providers: [PaymentEventListeners],
  exports: [PaymentEventListeners],
})
/** Registra los listeners de eventos de RabbitMQ del payment-service. */
export class PaymentEventListenersModule {}
