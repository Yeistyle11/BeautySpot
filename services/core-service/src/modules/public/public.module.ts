import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Business } from "../../entities/business.entity";
import { Service } from "../../entities/service.entity";
import { Professional } from "../../entities/professional.entity";
import { Client } from "../../entities/client.entity";
import { PublicController } from "./public.controller";
import { InternalClientsController } from "./internal-clients.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, Service, Professional, Client]),
  ],
  controllers: [PublicController, InternalClientsController],
})
export class PublicModule {}
