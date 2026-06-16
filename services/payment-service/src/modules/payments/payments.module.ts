import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { PaymentEntity } from "./payment.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity]),
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
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
