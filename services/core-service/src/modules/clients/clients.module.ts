import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OutboxModule } from "@beautyspot/nest-common";
import { ClientsService } from "./clients.service";
import { ClientsController } from "./clients.controller";
import { Client } from "../../entities/client.entity";
import { CampoDeFicha } from "../../entities/campo-de-ficha.entity";
import { BusinessConfigModule } from "../business-config/business-config.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Client, CampoDeFicha]),
    OutboxModule,
    BusinessConfigModule,
  ],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
/** Cablea el CRUD de clientes del negocio. */
export class ClientsModule {}
