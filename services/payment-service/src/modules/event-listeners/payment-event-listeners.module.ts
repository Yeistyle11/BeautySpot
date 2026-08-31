import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { EVENTS_EXCHANGE, DEAD_LETTER_EXCHANGE } from "@beautyspot/event-types";
import { PaymentEntity } from "../payments/payment.entity";
import { InvoiceEntity } from "../invoices/invoice.entity";
import { PaymentEventListeners } from "./payment-event-listeners.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity, InvoiceEntity]),
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
  providers: [PaymentEventListeners],
  exports: [PaymentEventListeners],
})
/**
 * Registra los listeners de RabbitMQ del payment-service. Hasta la fusion de
 * clientes este servicio solo publicaba eventos; ahora tambien consume.
 */
export class PaymentEventListenersModule {}
