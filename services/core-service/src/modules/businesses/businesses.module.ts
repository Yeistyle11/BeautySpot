import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OutboxModule } from "@beautyspot/nest-common";
import { BusinessesService } from "./businesses.service";
import {
  BusinessesController,
  InternalBusinessesController,
} from "./businesses.controller";
import { Business } from "../../entities/business.entity";
import { Branch } from "../../entities/branch.entity";
import { Service } from "../../entities/service.entity";
import { Professional } from "../../entities/professional.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Business, Branch, Service, Professional]),
    OutboxModule,
  ],
  controllers: [BusinessesController, InternalBusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
/** Cablea el CRUD de negocios (público e interno). */
export class BusinessesModule {}
