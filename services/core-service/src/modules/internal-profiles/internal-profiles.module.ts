import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Client } from "../../entities/client.entity";
import { Professional } from "../../entities/professional.entity";
import { Business } from "../../entities/business.entity";
import { InternalProfilesController } from "./internal-profiles.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Client, Professional, Business])],
  controllers: [InternalProfilesController],
})
/** Cablea el endpoint interno que resuelve ids a nombres de cliente/profesional/negocio. */
export class InternalProfilesModule {}
