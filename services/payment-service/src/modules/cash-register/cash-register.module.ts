import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CashSessionEntity } from "./cash-session.entity";
import { CashMovementEntity } from "./cash-movement.entity";
import { CashRegisterService } from "./cash-register.service";
import { CashRegisterController } from "./cash-register.controller";

@Module({
  imports: [TypeOrmModule.forFeature([CashSessionEntity, CashMovementEntity])],
  controllers: [CashRegisterController],
  providers: [CashRegisterService],
  exports: [CashRegisterService],
})
/** Cablea la gestión del arqueo de caja. */
export class CashRegisterModule {}
