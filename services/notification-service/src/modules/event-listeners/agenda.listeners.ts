import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { ProcessedEventsStore } from "@beautyspot/nest-common";
import { NotificationType } from "@beautyspot/shared-types";
import {
  AppointmentCreatedEvent,
  AppointmentConfirmedEvent,
  AppointmentCompletedEvent,
  AppointmentCancelledEvent,
  AppointmentRescheduledEvent,
  AppointmentReminderDueEvent,
  ServicioDeLaCita,
  EventNames,
  EVENTS_EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  nombreDeCola,
} from "@beautyspot/event-types";
import { EmailService } from "../emails/email.service";
import { DataEnricherService } from "../data-enricher/data-enricher.service";
import { AvisosService } from "./avisos.service";

/**
 * Como se nombra lo reservado en el correo: "Corte" o "Corte y Color", con un
 * generico de ultimo recurso.
 */
function nombreDelServicio(servicios?: ServicioDeLaCita[]): string {
  if (!servicios?.length) return "Servicio";
  const nombres = servicios.map((s) => s.name);
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/**
 * El ciclo de la cita: reserva, confirmacion, cambio de fecha, cancelacion,
 * recordatorio y cierre. Avisa antes dentro de la aplicacion y luego por correo.
 */
@Injectable()
export class AgendaListeners {
  private readonly logger = new Logger(AgendaListeners.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly processedEvents: ProcessedEventsStore,
    private readonly dataEnricher: DataEnricherService,
    private readonly avisos: AvisosService
  ) {}

  /**
   * Al reservarse una cita, avisa dentro de la aplicación al cliente y al equipo
   * del negocio, que es quien tiene que atenderla.
   */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_CREATED,
    queue: nombreDeCola("notification", EventNames.BOOKING_APPOINTMENT_CREATED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentCreated(event: AppointmentCreatedEvent) {
    const {
      appointmentId,
      clientId,
      professionalId,
      businessId,
      date,
      startTime,
    } = event.payload;

    this.logger.log(`Cita creada: ${appointmentId}`);

    try {
      await this.processedEvents.once(
        event,
        "notification:cita nueva",
        async () => {
          const data = await this.dataEnricher.enrichAppointmentParticipants(
            clientId,
            professionalId,
            businessId
          );

          await this.avisos.avisarEnLaApp(
            data.clientUserId,
            businessId,
            NotificationType.APPOINTMENT_CREATED,
            "Cita reservada",
            `Tu cita en ${data.businessName} el ${date} a las ${startTime} quedó reservada.`,
            { appointmentId }
          );

          await this.avisos.avisarAlNegocio(
            businessId,
            NotificationType.APPOINTMENT_CREATED,
            "Cita nueva",
            `${data.clientName} reservó el ${date} a las ${startTime} con ${data.professionalName}.`,
            { appointmentId }
          );

          // Quien reserva desde el marketplace no entra al panel: el acuse va
          // por correo.
          await this.avisos.intentarCorreo(
            "cita nueva",
            async () => {
              const { jobId } = await this.emailService.queueAppointmentCreated(
                data.clientEmail,
                {
                  clientName: data.clientName,
                  professionalName: data.professionalName,
                  appointmentDate: date,
                  appointmentTime: startTime,
                  businessName: data.businessName,
                  businessAddress: data.businessAddress,
                  businessPhone: data.businessPhone,
                }
              );

              await this.avisos.emitEmailQueuedEvent(
                jobId,
                data.clientEmail,
                "appointment-created",
                `Recibimos tu solicitud de cita en ${data.businessName}`
              );
            },
            {
              userId: data.clientUserId,
              businessId,
              type: NotificationType.APPOINTMENT_CREATED,
            }
          );
        }
      );
    } catch (error) {
      this.avisos.logError("cita nueva", error);
    }
  }

  /** Al mover una cita de fecha, avisa al cliente y al negocio del cambio. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_RESCHEDULED,
    queue: nombreDeCola(
      "notification",
      EventNames.BOOKING_APPOINTMENT_RESCHEDULED
    ),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentRescheduled(event: AppointmentRescheduledEvent) {
    const {
      appointmentId,
      clientId,
      professionalId,
      businessId,
      date,
      startTime,
      previousDate,
      previousStartTime,
    } = event.payload;

    this.logger.log(`Cita reagendada: ${appointmentId}`);

    try {
      await this.processedEvents.once(
        event,
        "notification:cita reagendada",
        async () => {
          const data = await this.dataEnricher.enrichAppointmentParticipants(
            clientId,
            professionalId,
            businessId
          );

          await this.avisos.avisarEnLaApp(
            data.clientUserId,
            businessId,
            NotificationType.APPOINTMENT_RESCHEDULED,
            "Cita reagendada",
            `Tu cita en ${data.businessName} pasó del ${previousDate} a las ${previousStartTime} al ${date} a las ${startTime}.`,
            { appointmentId }
          );

          await this.avisos.avisarAlNegocio(
            businessId,
            NotificationType.APPOINTMENT_RESCHEDULED,
            "Cita reagendada",
            `La cita de ${data.clientName} con ${data.professionalName} pasó al ${date} a las ${startTime}.`,
            { appointmentId }
          );
        }
      );
    } catch (error) {
      this.avisos.logError("cita reagendada", error);
    }
  }

  /** Al completarse una cita, avisa al cliente de que ya puede valorarla. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_COMPLETED,
    queue: nombreDeCola(
      "notification",
      EventNames.BOOKING_APPOINTMENT_COMPLETED
    ),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentCompleted(event: AppointmentCompletedEvent) {
    const { appointmentId, clientId, professionalId, businessId } =
      event.payload;

    this.logger.log(`Cita completada: ${appointmentId}`);

    try {
      await this.processedEvents.once(
        event,
        "notification:cita completada",
        async () => {
          const data = await this.dataEnricher.enrichAppointmentParticipants(
            clientId,
            professionalId,
            businessId
          );

          await this.avisos.avisarEnLaApp(
            data.clientUserId,
            businessId,
            NotificationType.APPOINTMENT_COMPLETED,
            "Cita atendida",
            `Gracias por tu visita a ${data.businessName}. Ya puedes dejar tu reseña.`,
            { appointmentId }
          );

          await this.avisos.intentarCorreo(
            "solicitud de reseña",
            async () => {
              const appUrl = this.configService.get<string>(
                "APP_URL",
                "http://localhost:8080"
              );
              const { jobId } = await this.emailService.queueReviewRequest(
                data.clientEmail,
                {
                  clientName: data.clientName,
                  businessName: data.businessName,
                  professionalName: data.professionalName,
                  reviewLink: `${appUrl}/dashboard/client/appointments/${appointmentId}/review`,
                }
              );

              await this.avisos.emitEmailQueuedEvent(
                jobId,
                data.clientEmail,
                "review-request",
                `¿Qué tal tu visita a ${data.businessName}?`
              );
            },
            {
              userId: data.clientUserId,
              businessId,
              type: NotificationType.APPOINTMENT_COMPLETED,
            }
          );
        }
      );
    } catch (error) {
      this.avisos.logError("cita completada", error);
    }
  }

  /** Al confirmarse una cita, encola el correo de confirmación con los datos enriquecidos. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_CONFIRMED,
    queue: nombreDeCola(
      "notification",
      EventNames.BOOKING_APPOINTMENT_CONFIRMED
    ),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentConfirmed(event: AppointmentConfirmedEvent) {
    const {
      appointmentId,
      clientId,
      professionalId,
      businessId,
      date,
      startTime,
      services,
    } = event.payload;

    this.logger.log(`Cita confirmada: ${appointmentId}`);

    try {
      await this.processedEvents.once(
        event,
        "notification:confirmación",
        async () => {
          const data = await this.dataEnricher.enrichAppointmentParticipants(
            clientId,
            professionalId,
            businessId
          );

          // Primero y aparte del correo: el aviso en la aplicación no depende
          // de la cola, y un fallo de esta no debe arrastrarlo.
          await this.avisos.avisarEnLaApp(
            data.clientUserId,
            businessId,
            NotificationType.APPOINTMENT_CONFIRMED,
            "Cita confirmada",
            `Tu cita en ${data.businessName} el ${date} a las ${startTime} está confirmada.`,
            { appointmentId }
          );

          await this.avisos.intentarCorreo(
            "confirmación",
            async () => {
              const { jobId } =
                await this.emailService.queueAppointmentConfirmation(
                  data.clientEmail,
                  {
                    clientName: data.clientName,
                    professionalName: data.professionalName,
                    serviceName: nombreDelServicio(services),
                    appointmentDate: date,
                    appointmentTime: startTime,
                    businessName: data.businessName,
                    businessAddress: data.businessAddress,
                    businessPhone: data.businessPhone,
                  }
                );

              await this.avisos.emitEmailQueuedEvent(
                jobId,
                data.clientEmail,
                "appointment-confirmed",
                `Confirmación de cita en ${data.businessName}`
              );
            },
            {
              userId: data.clientUserId,
              businessId,
              type: NotificationType.APPOINTMENT_CONFIRMED,
            }
          );
        }
      );
    } catch (error) {
      this.avisos.logError("confirmación", error);
    }
  }

  /** Al cancelarse una cita, avisa al cliente y al negocio, y encola el correo. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_CANCELLED,
    queue: nombreDeCola(
      "notification",
      EventNames.BOOKING_APPOINTMENT_CANCELLED
    ),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentCancelled(event: AppointmentCancelledEvent) {
    const {
      appointmentId,
      cancelReason,
      date,
      startTime,
      clientId,
      professionalId,
      businessId,
      services,
    } = event.payload;

    this.logger.log(
      `Cita cancelada: ${appointmentId}, motivo: ${cancelReason}`
    );

    try {
      await this.processedEvents.once(
        event,
        "notification:cancelación",
        async () => {
          const data = await this.dataEnricher.enrichAppointmentParticipants(
            clientId,
            professionalId,
            businessId
          );

          await this.avisos.avisarEnLaApp(
            data.clientUserId,
            businessId,
            NotificationType.APPOINTMENT_CANCELLED,
            "Cita cancelada",
            `Tu cita en ${data.businessName} del ${date} se ha cancelado.`,
            { appointmentId, cancelReason }
          );

          await this.avisos.avisarAlNegocio(
            businessId,
            NotificationType.APPOINTMENT_CANCELLED,
            "Cita cancelada",
            `${data.clientName} canceló su cita del ${date} a las ${startTime}.`,
            { appointmentId, cancelReason }
          );

          await this.avisos.intentarCorreo(
            "cancelación",
            async () => {
              const { jobId } =
                await this.emailService.queueAppointmentCancelled(
                  data.clientEmail,
                  {
                    clientName: data.clientName,
                    professionalName: data.professionalName,
                    serviceName: nombreDelServicio(services),
                    cancelledDate: date,
                    reason: cancelReason || "Sin motivo",
                    businessName: data.businessName,
                  }
                );

              await this.avisos.emitEmailQueuedEvent(
                jobId,
                data.clientEmail,
                "appointment-cancelled",
                `Cita cancelada - ${data.businessName}`
              );
            },
            {
              userId: data.clientUserId,
              businessId,
              type: NotificationType.APPOINTMENT_CANCELLED,
            }
          );
        }
      );
    } catch (error) {
      this.avisos.logError("cancelación", error);
    }
  }

  /** Ante un recordatorio pendiente, decide si es de 24h o 1h y encola el correo adecuado. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.BOOKING_APPOINTMENT_REMINDER_DUE,
    queue: nombreDeCola(
      "notification",
      EventNames.BOOKING_APPOINTMENT_REMINDER_DUE
    ),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleAppointmentReminder(event: AppointmentReminderDueEvent) {
    const {
      appointmentId,
      date,
      startTime,
      clientId,
      professionalId,
      businessId,
      reminderType,
      services,
    } = event.payload;

    this.logger.log(`Recordatorio de cita pendiente: ${appointmentId}`);

    try {
      await this.processedEvents.once(
        event,
        "notification:recordatorio de cita",
        async () => {
          const data = await this.dataEnricher.enrichAppointmentParticipants(
            clientId,
            professionalId,
            businessId
          );

          if (reminderType === "24h") {
            const { jobId } =
              await this.emailService.queueAppointmentReminder24h(
                data.clientEmail,
                {
                  clientName: data.clientName,
                  professionalName: data.professionalName,
                  serviceName: nombreDelServicio(services),
                  appointmentDate: date,
                  appointmentTime: startTime,
                  businessName: data.businessName,
                  businessAddress: data.businessAddress,
                }
              );

            await this.avisos.emitEmailQueuedEvent(
              jobId,
              data.clientEmail,
              "appointment-reminder-24h",
              `Recordatorio - Cita mañana en ${data.businessName}`
            );
          } else {
            const { jobId } =
              await this.emailService.queueAppointmentReminder1h(
                data.clientEmail,
                {
                  clientName: data.clientName,
                  professionalName: data.professionalName,
                  serviceName: nombreDelServicio(services),
                  appointmentTime: startTime,
                  businessName: data.businessName,
                }
              );

            await this.avisos.emitEmailQueuedEvent(
              jobId,
              data.clientEmail,
              "appointment-reminder-1h",
              `Recordatorio - Cita en 1 hora en ${data.businessName}`
            );
          }

          await this.avisos.avisarEnLaApp(
            data.clientUserId,
            businessId,
            NotificationType.APPOINTMENT_REMINDER,
            "Recordatorio de cita",
            reminderType === "24h"
              ? `Mañana tienes cita en ${data.businessName} a las ${startTime}.`
              : `Tu cita en ${data.businessName} empieza en una hora.`,
            { appointmentId }
          );
        }
      );
    } catch (error) {
      this.avisos.logError("recordatorio de cita", error);
    }
  }
}
