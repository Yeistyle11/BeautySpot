import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { CashSessionEntity } from "./cash-session.entity";
import { CashMovementEntity } from "./cash-movement.entity";
import { CashRegisterService } from "./cash-register.service";
import { CashRegisterController } from "./cash-register.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([CashSessionEntity, CashMovementEntity]),
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
  controllers: [CashRegisterController],
  providers: [CashRegisterService],
  exports: [CashRegisterService],
})
export class CashRegisterModule {}
