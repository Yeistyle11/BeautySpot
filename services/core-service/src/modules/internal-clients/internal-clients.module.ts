import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Client } from "../../entities/client.entity";
import { InternalClientsController } from "./internal-clients.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Client])],
  controllers: [InternalClientsController],
})
/** Cablea el endpoint interno para resolver/crear clientes de reservas. */
export class InternalClientsModule {}
