/** Base event contract for the event bus. */
export interface IBaseEvent<T = unknown> {
  eventType: string;
  timestamp: Date;
  correlationId: string;
  payload: T;
}

// ─── Auth Events ──────────────────────────────────────────────

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  name: string;
}

export type UserRegisteredEvent = IBaseEvent<UserRegisteredPayload>;

export interface UserLoggedInPayload {
  userId: string;
  email: string;
  ip?: string;
  userAgent?: string;
}

export type UserLoggedInEvent = IBaseEvent<UserLoggedInPayload>;

export interface MembershipCreatedPayload {
  membershipId: string;
  userId: string;
  businessId: string;
  role: string;
  invitedBy?: string;
}

export type MembershipCreatedEvent = IBaseEvent<MembershipCreatedPayload>;

export interface MembershipRoleChangedPayload {
  membershipId: string;
  userId: string;
  businessId: string;
  previousRole: string;
  newRole: string;
}

export type MembershipRoleChangedEvent = IBaseEvent<MembershipRoleChangedPayload>;

// ─── Core Events ──────────────────────────────────────────────

export interface BusinessCreatedPayload {
  businessId: string;
  slug: string;
  name: string;
  businessType: string;
  ownerId: string;
}

export type BusinessCreatedEvent = IBaseEvent<BusinessCreatedPayload>;

export interface BusinessUpdatedPayload {
  businessId: string;
  slug: string;
  changes: Record<string, unknown>;
}

export type BusinessUpdatedEvent = IBaseEvent<BusinessUpdatedPayload>;

export interface ProfessionalCreatedPayload {
  professionalId: string;
  businessId: string;
  name: string;
  specialties: string[];
}

export type ProfessionalCreatedEvent = IBaseEvent<ProfessionalCreatedPayload>;

export interface ServiceCreatedPayload {
  serviceId: string;
  businessId: string;
  name: string;
  price: number;
  duration: number;
  category: string;
}

export type ServiceCreatedEvent = IBaseEvent<ServiceCreatedPayload>;

export interface ClientCreatedPayload {
  clientId: string;
  businessId: string;
  name: string;
  email?: string;
  phone?: string;
}

export type ClientCreatedEvent = IBaseEvent<ClientCreatedPayload>;

// ─── Booking Events ───────────────────────────────────────────

export interface AppointmentCreatedPayload {
  appointmentId: string;
  businessId: string;
  clientId: string;
  professionalId: string;
  date: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
}

export type AppointmentCreatedEvent = IBaseEvent<AppointmentCreatedPayload>;

export type AppointmentConfirmedEvent = IBaseEvent<AppointmentCreatedPayload>;
export type AppointmentCancelledEvent = IBaseEvent<AppointmentCreatedPayload & { cancelReason?: string }>;
export type AppointmentCompletedEvent = IBaseEvent<AppointmentCreatedPayload & { pointsEarned: number }>;
export type AppointmentNoShowedEvent = IBaseEvent<AppointmentCreatedPayload>;
export type AppointmentRescheduledEvent = IBaseEvent<AppointmentCreatedPayload & { previousDate: string; previousStartTime: string }>;
export type AppointmentReminderDueEvent = IBaseEvent<AppointmentCreatedPayload>;

// ─── Payment Events ───────────────────────────────────────────

export interface PaymentRegisteredPayload {
  paymentId: string;
  businessId: string;
  appointmentId?: string;
  clientId: string;
  amount: number;
  method: string;
}

export type PaymentRegisteredEvent = IBaseEvent<PaymentRegisteredPayload>;

export interface CashSessionClosedPayload {
  sessionId: string;
  businessId: string;
  branchId: string;
  openedBy: string;
  closedBy: string;
  openingAmount: number;
  closingAmount: number;
  totalIn: number;
  totalOut: number;
  movementCount: number;
  expectedTotal: number;
  openedAt: Date;
  closedAt: Date;
  notes?: string;
}

export type CashSessionClosedEvent = IBaseEvent<CashSessionClosedPayload>;

export interface InvoiceGeneratedPayload {
  invoiceId: string;
  businessId: string;
  clientId: string;
  number: number;
  total: number;
}

export type InvoiceGeneratedEvent = IBaseEvent<InvoiceGeneratedPayload>;

// ─── Marketplace Events ───────────────────────────────────────

export interface ReviewCreatedPayload {
  reviewId: string;
  businessId: string;
  clientId: string;
  professionalId: string;
  rating: number;
  comment?: string;
}

export type ReviewCreatedEvent = IBaseEvent<ReviewCreatedPayload>;

// ─── Notification Events ───────────────────────────────────────

export interface EmailQueuedPayload {
  jobId: string;
  to: string;
  template: string;
  subject: string;
}

export type EmailQueuedEvent = IBaseEvent<EmailQueuedPayload>;

export interface EmailSentPayload {
  messageId: string;
  to: string;
  template: string;
  subject: string;
}

export type EmailSentEvent = IBaseEvent<EmailSentPayload>;

export interface EmailFailedPayload {
  jobId: string;
  to: string;
  template: string;
  error: string;
}

export type EmailFailedEvent = IBaseEvent<EmailFailedPayload>;

// ─── Event Name Constants ─────────────────────────────────────

export const EventNames = {
  AUTH_USER_REGISTERED: "auth.user.registered",
  AUTH_USER_LOGGED_IN: "auth.user.logged-in",
  AUTH_MEMBERSHIP_CREATED: "auth.membership.created",
  AUTH_MEMBERSHIP_ROLE_CHANGED: "auth.membership.role-changed",

  CORE_BUSINESS_CREATED: "core.business.created",
  CORE_BUSINESS_UPDATED: "core.business.updated",
  CORE_PROFESSIONAL_CREATED: "core.professional.created",
  CORE_SERVICE_CREATED: "core.service.created",
  CORE_SERVICE_UPDATED: "core.service.updated",
  CORE_CLIENT_CREATED: "core.client.created",

  BOOKING_APPOINTMENT_CREATED: "booking.appointment.created",
  BOOKING_APPOINTMENT_CONFIRMED: "booking.appointment.confirmed",
  BOOKING_APPOINTMENT_CANCELLED: "booking.appointment.cancelled",
  BOOKING_APPOINTMENT_COMPLETED: "booking.appointment.completed",
  BOOKING_APPOINTMENT_NO_SHOWED: "booking.appointment.no-showed",
  BOOKING_APPOINTMENT_RESCHEDULED: "booking.appointment.rescheduled",
  BOOKING_APPOINTMENT_REMINDER_DUE: "booking.appointment.reminder-due",

  PAYMENT_PAYMENT_REGISTERED: "payment.payment.registered",
  PAYMENT_INVOICE_GENERATED: "payment.invoice.generated",
  PAYMENT_REFUND_PROCESSED: "payment.refund.processed",
  PAYMENT_CASH_SESSION_CLOSED: "payment.cash.session.closed",

  MARKETPLACE_REVIEW_CREATED: "marketplace.review.created",
  MARKETPLACE_REVIEW_UPDATED: "marketplace.review.updated",

  NOTIFICATION_EMAIL_QUEUED: "notification.email.queued",
  NOTIFICATION_EMAIL_SENT: "notification.email.sent",
  NOTIFICATION_EMAIL_FAILED: "notification.email.failed",
} as const;
