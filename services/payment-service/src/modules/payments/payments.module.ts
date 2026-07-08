import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EventBusModule } from "@beautyspot/nest-common";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { PaymentEntity } from "./payment.entity";

@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity]), EventBusModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
