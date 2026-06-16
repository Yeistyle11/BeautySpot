import { IAuditFields } from "./common.types";

export enum NotificationType {
  APPOINTMENT_CONFIRMED = "APPOINTMENT_CONFIRMED",
  APPOINTMENT_REMINDER = "APPOINTMENT_REMINDER",
  APPOINTMENT_CANCELLED = "APPOINTMENT_CANCELLED",
  APPOINTMENT_RESCHEDULED = "APPOINTMENT_RESCHEDULED",
  APPOINTMENT_COMPLETED = "APPOINTMENT_COMPLETED",
  REVIEW_RECEIVED = "REVIEW_RECEIVED",
  MEMBERSHIP_INVITATION = "MEMBERSHIP_INVITATION",
  PROMOTION = "PROMOTION",
}

export enum NotificationChannel {
  IN_APP = "IN_APP",
  EMAIL = "EMAIL",
  PUSH = "PUSH",
  WHATSAPP = "WHATSAPP",
  SMS = "SMS",
}

export interface INotification extends IAuditFields {
  id: string;
  businessId: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  sentAt?: Date;
}

export interface INotificationPreference {
  id: string;
  businessId: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}
