import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import * as path from "path";
import { createTypeOrmModuleOptions } from "@beautyspot/database";
import {
  OutboxModule,
  HealthModule,
  InternalHttpModule,
} from "@beautyspot/nest-common";
import { entities } from "./orm-entities";
import { PaymentsModule } from "./modules/payments/payments.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { CashRegisterModule } from "./modules/cash-register/cash-register.module";
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.join(__dirname, "..", ".env"),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => createTypeOrmModuleOptions(entities, "write"),
    }),
    HealthModule,
    OutboxModule,
    InternalHttpModule,
    PaymentsModule,
    InvoicesModule,
    CashRegisterModule,
  ],
})
/** Módulo raíz del payment-service: pagos, caja, facturas y sus eventos. */
export class AppModule {}
