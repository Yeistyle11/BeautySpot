import { ProcessedEventEntity } from "@beautyspot/nest-common";
import { NotificationEntity } from "./modules/notifications/notification.entity";
import { NotificationPreferenceEntity } from "./modules/notification-preferences/notification-preference.entity";

/** Entidades que gestiona este servicio, compartidas por app.module y data-source. */
export const entities = [
  ProcessedEventEntity,
  NotificationEntity,
  NotificationPreferenceEntity,
];
