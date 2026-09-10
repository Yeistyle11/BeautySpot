import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Service } from "../../entities/service.entity";
import { PreciosModule } from "../precios/precios.module";
import { InternalServicesController } from "./internal-services.controller";

@Module({
  imports: [TypeOrmModule.forFeature([Service]), PreciosModule],
  controllers: [InternalServicesController],
})
/** Cablea el endpoint interno que resuelve precio y duración del catálogo. */
export class InternalServicesModule {}
