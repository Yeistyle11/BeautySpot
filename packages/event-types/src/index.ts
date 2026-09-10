import { MetodoDeCobro, PaymentMethod } from "@beautyspot/shared-types";

/** Contrato base de todos los eventos que viajan por el bus (RabbitMQ). */
export interface IBaseEvent<T = unknown> {
  /**
   * Identidad del evento, estable entre reentregas. Los consumidores la usan
   * para descartar lo que ya procesaron.
   */
  eventId: string;
  eventType: string;
  timestamp: Date;
  correlationId: string;
  payload: T;
}

// ─── Eventos de autenticación ──────────────────────────────────────────────

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

export interface PasswordResetRequestedPayload {
  userId: string;
  email: string;
  name: string;
  resetToken: string;
  expiresAt: string;
}

export type PasswordResetRequestedEvent =
  IBaseEvent<PasswordResetRequestedPayload>;

export interface EmailVerificationRequestedPayload {
  userId: string;
  email: string;
  name: string;
  verificationToken: string;
  expiresAt: string;
}

export type EmailVerificationRequestedEvent =
  IBaseEvent<EmailVerificationRequestedPayload>;

/**
 * Alguien intentó darse de alta con un correo que ya tiene cuenta. El alta
 * responde lo mismo exista o no, así que este aviso es lo que se lo dice a su
 * dueño y le ofrece la salida: recuperar la contraseña.
 */
export interface RegistroDuplicadoPayload {
  email: string;
  name: string;
}

export type RegistroDuplicadoEvent = IBaseEvent<RegistroDuplicadoPayload>;

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

export type MembershipRoleChangedEvent =
  IBaseEvent<MembershipRoleChangedPayload>;

// ─── Eventos del core ──────────────────────────────────────────────

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

/**
 * Dos fichas del mismo cliente que pasan a ser una. Quien guarde algo con el
 * `absorbidoId` lo reasigna al superviviente: la ficha absorbida se conserva
 * marcada, pero deja de recibir historial.
 */
export interface ClientMergedPayload {
  businessId: string;
  supervivienteId: string;
  absorbidoId: string;
}

export type ClientMergedEvent = IBaseEvent<ClientMergedPayload>;

/** Cliente que cumple años hoy en la zona horaria de su negocio. */
export interface ClientBirthdayPayload {
  clientId: string;
  businessId: string;
  name: string;
  email?: string;
  /** Año que se está felicitando, el mismo que queda marcado en la ficha. */
  year: number;
}

export type ClientBirthdayEvent = IBaseEvent<ClientBirthdayPayload>;

// ─── Eventos de agenda ───────────────────────────────────────────

/** Servicio de una cita, con lo que se congeló al reservarlo. */
export interface ServicioDeLaCita {
  serviceId: string;
  name: string;
  price: number;
  duration: number;
}

export interface AppointmentCreatedPayload {
  appointmentId: string;
  businessId: string;
  /**
   * Sede donde se atiende. Opcional: un evento ya encolado puede no llevarla.
   */
  branchId?: string;
  clientId: string;
  professionalId: string;
  date: string;
  startTime: string;
  endTime: string;
  /** Hasta cuándo sigue ocupado el profesional: `endTime` más la limpieza. */
  ocupadoHasta?: string;
  totalAmount: number;
  /**
   * Servicios de la cita, con el nombre congelado al reservarla. Opcional: un
   * evento que llegue sin el se consume igual.
   */
  services?: ServicioDeLaCita[];
}

export type AppointmentCreatedEvent = IBaseEvent<AppointmentCreatedPayload>;

export type AppointmentConfirmedEvent = IBaseEvent<AppointmentCreatedPayload>;
export type AppointmentCancelledEvent = IBaseEvent<
  AppointmentCreatedPayload & {
    /** Nota libre de quien cancela. */
    cancelReason?: string;
    /** Motivo tipificado, del enum `CancelReason`. Es el que se le enseña al cliente. */
    cancelReasonType?: string;
    cancelledBy?: string;
    /** Instante en que se canceló, que no es la fecha de la cita. */
    cancelledAt?: string;
  }
>;
export type AppointmentCompletedEvent = IBaseEvent<
  AppointmentCreatedPayload & {
    pointsEarned: number;
  }
>;
export type AppointmentNoShowedEvent = IBaseEvent<AppointmentCreatedPayload>;
export type AppointmentRescheduledEvent = IBaseEvent<
  AppointmentCreatedPayload & {
    previousDate: string;
    previousStartTime: string;
  }
>;
/**
 * Cual de los dos recordatorios se esta pidiendo; lo decide quien lo emite, no
 * la hora a la que llega.
 */
export type TipoDeRecordatorio = "24h" | "1h";

export type AppointmentReminderDueEvent = IBaseEvent<
  AppointmentCreatedPayload & { reminderType: TipoDeRecordatorio }
>;

// ─── Eventos de cobros ───────────────────────────────────────────

export interface PaymentRegisteredPayload {
  paymentId: string;
  businessId: string;
  appointmentId?: string;
  clientId: string;
  /** Lo cobrado por los servicios, sin la propina. */
  amount: number;
  /**
   * Propina, que no es ingreso del negocio: entra con el cobro y sale para el
   * profesional, asi que quien agrega ventas no la suma.
   */
  propina?: number;
  /**
   * Dia del cobro en el huso del negocio (`YYYY-MM-DD`). Quien agrega por dia
   * lo necesita: un evento reprocesado -una redelivery, un consumidor que se
   * cayo y vuelve- se atribuiria si no al dia en que se proceso.
   */
  date?: string;
  /**
   * Tipado con el enum y no con `string`: quien lo compare contra un literal
   * que el enum no produce no compila. `MIXED` cuando el cobro se repartio,
   * y entonces el detalle esta en `metodos`.
   */
  method: MetodoDeCobro;
  /** Reparto del cobro por medio, cuando entro por mas de uno. */
  metodos?: { method: PaymentMethod; amount: number }[];
  /**
   * Lo que se cobró, resuelto contra la cita. Falta en los cobros sueltos, que
   * no llevan cita detrás: entonces el recibo solo puede dar el importe.
   */
  services?: ServicioDeLaCita[];
}

export type PaymentRegisteredEvent = IBaseEvent<PaymentRegisteredPayload>;

/**
 * Correccion de un cobro ya registrado. Lleva la diferencia además del importe
 * nuevo -quien agrega ingresos ajusta lo sumado, no lo vuelve a sumar- y el dia
 * del cobro original, para no atribuir la correccion al dia en que se hizo.
 */
export interface PaymentCorrectedPayload {
  paymentId: string;
  businessId: string;
  /** Dia del cobro corregido, en el huso del negocio (`YYYY-MM-DD`). */
  date: string;
  previousAmount: number;
  amount: number;
  /** `amount - previousAmount`: negativa cuando la correccion rebaja el cobro. */
  difference: number;
  method: PaymentMethod;
  reason: string;
  editedBy: string;
}

export type PaymentCorrectedEvent = IBaseEvent<PaymentCorrectedPayload>;

/** Puntos que un cobro gastó de la ficha del cliente. */
export interface PointsRedeemedPayload {
  paymentId: string;
  businessId: string;
  clientId: string;
  points: number;
  /** Lo que esos puntos rebajaron del importe. */
  discount: number;
}

export type PointsRedeemedEvent = IBaseEvent<PointsRedeemedPayload>;

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

/** Línea de una factura, tal y como se imprime en el correo. */
export interface LineaDeFactura {
  description: string;
  quantity: number;
  total: number;
}

export interface InvoiceGeneratedPayload {
  invoiceId: string;
  businessId: string;
  clientId: string;
  number: number;
  subtotal: number;
  tax: number;
  total: number;
  /** Vencimiento de la factura, `YYYY-MM-DD`. */
  dueDate?: string;
  /** Conceptos facturados; sin ellos el correo solo puede dar el total. */
  items?: LineaDeFactura[];
}

export type InvoiceGeneratedEvent = IBaseEvent<InvoiceGeneratedPayload>;

// ─── Eventos del marketplace ───────────────────────────────────────

export interface ReviewCreatedPayload {
  reviewId: string;
  businessId: string;
  clientId: string;
  professionalId: string;
  rating: number;
  comment?: string;
}

export type ReviewCreatedEvent = IBaseEvent<ReviewCreatedPayload>;

// ─── Eventos de notificaciones ───────────────────────────────────────

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

// ─── Nombres de los eventos ─────────────────────────────────────

/** Exchange de tipo topic por el que viajan todos los eventos de dominio. */
export const EVENTS_EXCHANGE = "beautyspot.events";

/** Exchange al que van los eventos que un consumidor no pudo procesar. */
export const DEAD_LETTER_EXCHANGE = "beautyspot.dlx";

/**
 * Cola terminal donde se acumulan los eventos fallidos. No se reencolan desde
 * aquí: se revisan y se reprocesan a mano.
 */
export const DEAD_LETTER_QUEUE = "beautyspot.dlx.dead";

/**
 * Nombre de la cola de un consumidor: una por servicio y evento, de modo que
 * el fallo de uno no afecta a los demas.
 */
export function nombreDeCola(servicio: string, evento: string): string {
  return `${servicio}.${evento}`;
}

/**
 * Nombres canónicos de los eventos (routing keys de RabbitMQ). Compartirlos aquí
 * garantiza que productores y consumidores usen exactamente la misma cadena.
 */
export const EventNames = {
  AUTH_USER_REGISTERED: "auth.user.registered",
  AUTH_REGISTRO_DUPLICADO: "auth.registro.duplicado",
  AUTH_USER_LOGGED_IN: "auth.user.logged-in",
  AUTH_PASSWORD_RESET_REQUESTED: "auth.password-reset.requested",
  AUTH_EMAIL_VERIFICATION_REQUESTED: "auth.email-verification.requested",
  AUTH_MEMBERSHIP_CREATED: "auth.membership.created",
  AUTH_MEMBERSHIP_ROLE_CHANGED: "auth.membership.role-changed",

  CORE_BUSINESS_CREATED: "core.business.created",
  CORE_BUSINESS_UPDATED: "core.business.updated",
  CORE_PROFESSIONAL_CREATED: "core.professional.created",
  CORE_SERVICE_CREATED: "core.service.created",
  CORE_SERVICE_UPDATED: "core.service.updated",
  CORE_CLIENT_CREATED: "core.client.created",
  CORE_CLIENT_BIRTHDAY: "core.client.birthday",
  CORE_CLIENT_MERGED: "core.client.merged",

  BOOKING_APPOINTMENT_CREATED: "booking.appointment.created",
  BOOKING_APPOINTMENT_CONFIRMED: "booking.appointment.confirmed",
  BOOKING_APPOINTMENT_CANCELLED: "booking.appointment.cancelled",
  BOOKING_APPOINTMENT_COMPLETED: "booking.appointment.completed",
  BOOKING_APPOINTMENT_NO_SHOWED: "booking.appointment.no-showed",
  BOOKING_APPOINTMENT_RESCHEDULED: "booking.appointment.rescheduled",
  BOOKING_APPOINTMENT_REMINDER_DUE: "booking.appointment.reminder-due",

  PAYMENT_PAYMENT_REGISTERED: "payment.payment.registered",
  PAYMENT_INVOICE_GENERATED: "payment.invoice.generated",
  PAYMENT_POINTS_REDEEMED: "payment.points.redeemed",
  PAYMENT_PAYMENT_CORRECTED: "payment.payment.corrected",
  PAYMENT_REFUND_PROCESSED: "payment.refund.processed",
  PAYMENT_CASH_SESSION_CLOSED: "payment.cash.session.closed",

  MARKETPLACE_REVIEW_CREATED: "marketplace.review.created",
  MARKETPLACE_REVIEW_UPDATED: "marketplace.review.updated",

  NOTIFICATION_EMAIL_QUEUED: "notification.email.queued",
  NOTIFICATION_EMAIL_SENT: "notification.email.sent",
  NOTIFICATION_EMAIL_FAILED: "notification.email.failed",
} as const;

/**
 * Eventos cuyo payload transporta un secreto de un solo uso: el enlace de
 * contraseña y el de confirmacion de correo. El relay borra su fila del outbox
 * al publicarlos, para que el secreto no siga legible en la base.
 */
export const EVENTOS_CON_SECRETO: readonly string[] = [
  EventNames.AUTH_PASSWORD_RESET_REQUESTED,
  EventNames.AUTH_EMAIL_VERIFICATION_REQUESTED,
];
