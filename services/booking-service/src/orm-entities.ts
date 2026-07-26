import {
  OutboxMessageEntity,
  ProcessedEventEntity,
} from "@beautyspot/nest-common";
import { Appointment } from "./entities/appointment.entity";
import { AppointmentServiceEntity } from "./entities/appointment-service.entity";
import { Availability } from "./entities/availability.entity";
import { BlockedSlot } from "./entities/blocked-slot.entity";

/** Entidades que gestiona este servicio, compartidas por app.module y data-source. */
export const entities = [
  ProcessedEventEntity,
  Appointment,
  AppointmentServiceEntity,
  Availability,
  BlockedSlot,
  OutboxMessageEntity,
];
