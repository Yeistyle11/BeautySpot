import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Business } from "../../entities/business.entity";
import { Service } from "../../entities/service.entity";
import { Professional } from "../../entities/professional.entity";
import { BusinessHours } from "../../entities/business-hours.entity";
import { PreciosModule } from "../precios/precios.module";
import { PublicController } from "./public.controller";
import { PublicService } from "./public.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, Service, Professional, BusinessHours]),
    PreciosModule,
  ],
  controllers: [PublicController],
  providers: [PublicService],
  exports: [PublicService],
})
/** Cablea los endpoints públicos del escaparate de negocios. */
export class PublicModule {}
