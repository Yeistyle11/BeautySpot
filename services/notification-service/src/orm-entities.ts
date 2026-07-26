import { ProcessedEventEntity } from "@beautyspot/nest-common";
import { NotificationEntity } from "./modules/notifications/notification.entity";
import { NotificationPreferenceEntity } from "./modules/notification-preferences/notification-preference.entity";

/**
 * Entidades que gestiona este servicio, en un módulo aparte para que el
 * app.module y el data-source de migraciones compartan la misma lista.
 *
 * Si divergieran, `migration:generate` compararía el esquema contra una lista
 * incompleta y propondría borrar las tablas que le faltasen.
 */
export const entities = [
  ProcessedEventEntity,
  NotificationEntity,
  NotificationPreferenceEntity,
];
