import { OutboxMessageEntity } from "@beautyspot/nest-common";
import { Appointment } from "./entities/appointment.entity";
import { AppointmentServiceEntity } from "./entities/appointment-service.entity";
import { Availability } from "./entities/availability.entity";
import { BlockedSlot } from "./entities/blocked-slot.entity";

/**
 * Entidades que gestiona este servicio, en un módulo aparte para que el
 * app.module y el data-source de migraciones compartan la misma lista.
 *
 * Si divergieran, `migration:generate` compararía el esquema contra una lista
 * incompleta y propondría borrar las tablas que le faltasen.
 */
export const entities = [
  Appointment,
  AppointmentServiceEntity,
  Availability,
  BlockedSlot,
  OutboxMessageEntity,
];
