import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ZonaDelNegocioModule } from "@beautyspot/nest-common";
import { AppointmentsService } from "./appointments.service";
import { AvailabilityQueryService } from "./availability-query.service";
import { HorarioDelNegocioService } from "./horario-del-negocio.service";
import { PoliticaDeReservaService } from "./politica-de-reserva.service";
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
    ZonaDelNegocioModule,
  ],
  controllers: [AppointmentsController, InternalAppointmentsController],
  providers: [
    AppointmentsService,
    AvailabilityQueryService,
    HorarioDelNegocioService,
    PoliticaDeReservaService,
  ],
  exports: [AppointmentsService, AvailabilityQueryService],
})
/** Cablea la gestión de citas (controlador público e interno y su servicio). */
export class AppointmentsModule {}
