import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BusinessHoursService } from "./business-hours.service";
import { BusinessHoursController } from "./business-hours.controller";
import { BusinessHours } from "../../entities/business-hours.entity";

@Module({
  imports: [TypeOrmModule.forFeature([BusinessHours])],
  controllers: [BusinessHoursController],
  providers: [BusinessHoursService],
  exports: [BusinessHoursService],
})
/** Cablea la gestión del horario de apertura del negocio. */
export class BusinessHoursModule {}
