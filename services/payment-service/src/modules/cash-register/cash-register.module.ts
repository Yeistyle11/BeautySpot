import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventBusModule } from "@beautyspot/nest-common";
import { CashSessionEntity } from "./cash-session.entity";
import { CashMovementEntity } from "./cash-movement.entity";
import { CashRegisterService } from "./cash-register.service";
import { CashRegisterController } from "./cash-register.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([CashSessionEntity, CashMovementEntity]),
    EventBusModule,
  ],
  controllers: [CashRegisterController],
  providers: [CashRegisterService],
  exports: [CashRegisterService],
})
export class CashRegisterModule {}
