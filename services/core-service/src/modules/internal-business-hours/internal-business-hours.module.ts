import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BusinessHours } from "../../entities/business-hours.entity";
import { InternalBusinessHoursController } from "./internal-business-hours.controller";

@Module({
  imports: [TypeOrmModule.forFeature([BusinessHours])],
  controllers: [InternalBusinessHoursController],
})
/** Cablea el endpoint interno con el horario de apertura del negocio. */
export class InternalBusinessHoursModule {}
