import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { APP_INTERCEPTOR } from "@nestjs/core";
import * as path from "path";
import { createTypeOrmModuleOptions } from "@beautyspot/database";
import { Appointment } from "./entities/appointment.entity";
import { AppointmentServiceEntity } from "./entities/appointment-service.entity";
import { Availability } from "./entities/availability.entity";
import { BlockedSlot } from "./entities/blocked-slot.entity";
import { AppointmentsModule } from "./modules/appointments/appointments.module";
import { AvailabilityModule } from "./modules/availability/availability.module";
import { BlockedSlotsModule } from "./modules/blocked-slots/blocked-slots.module";
import { PublicBookingModule } from "./modules/public-booking/public-booking.module";
import { BookingEventListenersModule } from "./modules/event-listeners/booking-event-listeners.module";
import { TenantQueryInterceptor } from "@beautyspot/nest-common";
 
const entities = [Appointment, AppointmentServiceEntity, Availability, BlockedSlot];
 
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: path.join(__dirname, "..", ".env") }),
    TypeOrmModule.forRootAsync({
      useFactory: () => createTypeOrmModuleOptions(entities),
    }),
    AppointmentsModule,
    AvailabilityModule,
    BlockedSlotsModule,
    PublicBookingModule,
    BookingEventListenersModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantQueryInterceptor,
    },
  ],
})
export class AppModule {}
