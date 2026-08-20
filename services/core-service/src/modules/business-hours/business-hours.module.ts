import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BusinessHoursService } from "./business-hours.service";
import { BusinessHoursController } from "./business-hours.controller";
import { SpecialDaysService } from "./special-days.service";
import { SpecialDaysController } from "./special-days.controller";
import { BusinessHours } from "../../entities/business-hours.entity";
import { BusinessSpecialDay } from "../../entities/business-special-day.entity";

@Module({
  imports: [TypeOrmModule.forFeature([BusinessHours, BusinessSpecialDay])],
  controllers: [BusinessHoursController, SpecialDaysController],
  providers: [BusinessHoursService, SpecialDaysService],
  exports: [BusinessHoursService, SpecialDaysService],
})
/** Cablea la gestión del horario de apertura del negocio y sus días especiales. */
export class BusinessHoursModule {}
