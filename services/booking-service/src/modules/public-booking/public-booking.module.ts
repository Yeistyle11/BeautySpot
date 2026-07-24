import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Appointment } from "../../entities/appointment.entity";
import { AppointmentServiceEntity } from "../../entities/appointment-service.entity";
import { Availability } from "../../entities/availability.entity";
import { BlockedSlot } from "../../entities/blocked-slot.entity";
import { PublicBookingController } from "./public-booking.controller";
import { PublicBookingService } from "./public-booking.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      AppointmentServiceEntity,
      Availability,
      BlockedSlot,
    ]),
  ],
  controllers: [PublicBookingController],
  providers: [PublicBookingService],
})
/** Cablea el endpoint público de reservas para invitados del marketplace. */
export class PublicBookingModule {}
