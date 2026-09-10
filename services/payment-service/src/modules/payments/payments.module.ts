import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PaymentsService } from "./payments.service";
import { PaymentsController } from "./payments.controller";
import { PaymentEntity } from "./payment.entity";
import { PaymentSplitEntity } from "./payment-split.entity";
import { ZonaDelNegocioModule } from "@beautyspot/nest-common";

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity, PaymentSplitEntity]),
    ZonaDelNegocioModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
/** Cablea el registro y reembolso de pagos. */
export class PaymentsModule {}
