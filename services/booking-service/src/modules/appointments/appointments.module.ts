import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppointmentsService } from "./appointments.service";
import { AvailabilityQueryService } from "./availability-query.service";
import {
  AppointmentsController,
  InternalAppointmentsController,
} from "./appointments.controller";
import { Appointment } from "../../entities/appointment.entity";
import { AppointmentServiceEntity } from "../../entities/appointment-service.entity";
import { Availability } from "../../entities/availability.entity";
import { BlockedSlot } from "../../entities/blocked-slot.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      AppointmentServiceEntity,
      Availability,
      BlockedSlot,
    ]),
  ],
  controllers: [AppointmentsController, InternalAppointmentsController],
  providers: [AppointmentsService, AvailabilityQueryService],
  exports: [AppointmentsService, AvailabilityQueryService],
})
/** Cablea la gestión de citas (controlador público e interno y su servicio). */
export class AppointmentsModule {}
