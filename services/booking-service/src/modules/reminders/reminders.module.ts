import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Appointment } from "../../entities/appointment.entity";
import { RemindersWorker } from "./reminders.worker";

@Module({
  imports: [TypeOrmModule.forFeature([Appointment])],
  providers: [RemindersWorker],
})
/** Cablea el sondeo que publica los recordatorios de cita. */
export class RemindersModule {}
