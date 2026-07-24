import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import * as path from "path";
import { createTypeOrmModuleOptions } from "@beautyspot/database";
import { OutboxModule, OutboxMessageEntity } from "@beautyspot/nest-common";
import { Appointment } from "./entities/appointment.entity";
import { AppointmentServiceEntity } from "./entities/appointment-service.entity";
import { Availability } from "./entities/availability.entity";
import { BlockedSlot } from "./entities/blocked-slot.entity";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { AvailabilityModule } from "./modules/availability/availability.module";
import { BlockedSlotsModule } from "./modules/blocked-slots/blocked-slots.module";
import { PublicBookingModule } from "./modules/public-booking/public-booking.module";
import { BookingEventListenersModule } from "./modules/event-listeners/booking-event-listeners.module";

const entities = [
  Appointment,
  AppointmentServiceEntity,
  Availability,
  BlockedSlot,
  OutboxMessageEntity,
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.join(__dirname, "..", ".env"),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => createTypeOrmModuleOptions(entities),
    }),
    OutboxModule,
    AppointmentsModule,
    AvailabilityModule,
    BlockedSlotsModule,
    PublicBookingModule,
    BookingEventListenersModule,
  ],
})
/** Módulo raíz del booking-service: citas, disponibilidad, bloqueos y reservas públicas. */
export class AppModule {}
