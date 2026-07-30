import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import * as path from "path";
import { createTypeOrmModuleOptions } from "@beautyspot/database";
import {
  OutboxModule,
  HealthModule,
  IdempotencyModule,
  InternalHttpModule,
} from "@beautyspot/nest-common";
import { entities } from "./orm-entities";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { AvailabilityModule } from "./modules/availability/availability.module";
import { BlockedSlotsModule } from "./modules/blocked-slots/blocked-slots.module";
import { PublicBookingModule } from "./modules/public-booking/public-booking.module";
import { BookingEventListenersModule } from "./modules/event-listeners/booking-event-listeners.module";
import { RemindersModule } from "./modules/reminders/reminders.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.join(__dirname, "..", ".env"),
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => createTypeOrmModuleOptions(entities, "write"),
    }),
    IdempotencyModule,
    InternalHttpModule,
    HealthModule,
    OutboxModule,
    AppointmentsModule,
    AvailabilityModule,
    BlockedSlotsModule,
    PublicBookingModule,
    BookingEventListenersModule,
    RemindersModule,
  ],
})
/** Módulo raíz del booking-service: citas, disponibilidad, bloqueos y reservas públicas. */
export class AppModule {}
