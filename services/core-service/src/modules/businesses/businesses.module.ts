import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OutboxModule } from "@beautyspot/nest-common";
import { BusinessesService } from "./businesses.service";
import {
  BusinessesController,
  InternalBusinessesController,
} from "./businesses.controller";
import { Business } from "../../entities/business.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Business]), OutboxModule],
  controllers: [BusinessesController, InternalBusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
/** Cablea el CRUD de negocios (público e interno). */
export class BusinessesModule {}
