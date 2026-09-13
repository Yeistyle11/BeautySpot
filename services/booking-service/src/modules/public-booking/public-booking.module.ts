import { Module } from "@nestjs/common";
import {
  MiReservaController,
  PublicBookingController,
} from "./public-booking.controller";
import { PublicBookingService } from "./public-booking.service";
import { AppointmentsModule } from "../appointments/appointments.module";

@Module({
  imports: [AppointmentsModule],
  controllers: [PublicBookingController, MiReservaController],
  providers: [PublicBookingService],
})
/** Cablea las reservas del marketplace: la de invitado y la del cliente con sesión. */
export class PublicBookingModule {}
