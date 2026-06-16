import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import * as path from "path";
import { createTypeOrmModuleOptions } from "@beautyspot/database";
import { PaymentsModule } from "./modules/payments/payments.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { CashRegisterModule } from "./modules/cash-register/cash-register.module";
import { PaymentEventListenersModule } from "./modules/event-listeners/payment-event-listeners.module";
import { PaymentEntity } from "./modules/payments/payment.entity";
import { InvoiceEntity } from "./modules/invoices/invoice.entity";
import { InvoiceItemEntity } from "./modules/invoices/invoice-item.entity";
import { CashSessionEntity } from "./modules/cash-register/cash-session.entity";
import { CashMovementEntity } from "./modules/cash-register/cash-movement.entity";

const entities = [PaymentEntity, InvoiceEntity, InvoiceItemEntity, CashSessionEntity, CashMovementEntity];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: path.join(__dirname, "..", ".env") }),
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
    PaymentsModule,
    InvoicesModule,
    CashRegisterModule,
    PaymentEventListenersModule,
  ],
})
export class AppModule {}
