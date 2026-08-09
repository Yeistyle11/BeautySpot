import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ZonaDelNegocioModule } from "@beautyspot/nest-common";
import { Appointment } from "../../entities/appointment.entity";
import { RemindersWorker } from "./reminders.worker";

@Module({
  imports: [TypeOrmModule.forFeature([Appointment]), ZonaDelNegocioModule],
  providers: [RemindersWorker],
})
/** Cablea el sondeo que publica los recordatorios de cita. */
export class RemindersModule {}
