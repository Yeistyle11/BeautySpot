import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ClientsService } from "./clients.service";
import { ClientsController } from "./clients.controller";
import { Client } from "../../entities/client.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Client])],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
/** Cablea el CRUD de clientes del negocio. */
export class ClientsModule {}
