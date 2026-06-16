import { Module } from "@nestjs/common";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { PaymentEventListeners } from "./payment-event-listeners.service";

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
  providers: [PaymentEventListeners],
  exports: [PaymentEventListeners],
})
export class PaymentEventListenersModule {}