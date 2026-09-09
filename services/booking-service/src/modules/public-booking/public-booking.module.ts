import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Appointment } from "../../entities/appointment.entity";
import { AppointmentServiceEntity } from "../../entities/appointment-service.entity";
import { Availability } from "../../entities/availability.entity";
import { BlockedSlot } from "../../entities/blocked-slot.entity";
import {
  MiReservaController,
  PublicBookingController,
} from "./public-booking.controller";
import { PublicBookingService } from "./public-booking.service";
import { AppointmentsModule } from "../appointments/appointments.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      AppointmentServiceEntity,
      Availability,
      BlockedSlot,
    ]),
    AppointmentsModule,
  ],
  controllers: [PublicBookingController, MiReservaController],
  providers: [PublicBookingService],
})
/** Cablea las reservas del marketplace: la de invitado y la del cliente con sesión. */
export class PublicBookingModule {}
