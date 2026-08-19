import { randomUUID } from "crypto";
import { Injectable, Logger } from "@nestjs/common";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { InternalHttpClient } from "@beautyspot/nest-common";
import {
  NotificationChannel,
  NotificationType,
  Role,
} from "@beautyspot/shared-types";
import { EVENTS_EXCHANGE } from "@beautyspot/event-types";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationPreferencesService } from "../notification-preferences/notification-preferences.service";

/** Quién, dentro del negocio, recibe los avisos de la agenda. */
const ROLES_DE_GESTION: string[] = [Role.OWNER, Role.ADMIN, Role.RECEPTIONIST];

/**
 * Como se avisa: consulta la preferencia, escribe la notificacion, encola el
 * correo y publica la traza. A quien avisar lo deciden los listeners.
 */
@Injectable()
export class AvisosService {
  private readonly logger = new Logger(AvisosService.name);

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly notifications: NotificationsService,
    private readonly http: InternalHttpClient,
    private readonly preferencias: NotificationPreferencesService
  ) {}

  /** Publica en RabbitMQ el evento de correo encolado, para trazabilidad. */
  async emitEmailQueuedEvent(
    jobId: string,
    to: string,
    template: string,
    subject: string
  ): Promise<void> {
    try {
      await this.amqpConnection.publish(
        EVENTS_EXCHANGE,
        "notification.email.queued",
        {
          // Se publica por AmqpConnection, sin pasar por EventBusService: el
          // eventId se pone aqui.
          eventId: randomUUID(),
          eventType: "notification.email.queued",
          timestamp: new Date(),
          correlationId: jobId,
          payload: { jobId, to, template, subject },
        }
      );
    } catch (error) {
      this.logError("publicación email.queued", error);
    }
  }

  /**
   * Deja al cliente una notificación dentro de la aplicación, junto al correo;
   * solo la reciben los clientes con cuenta, no quien reserva como invitado.
   */
  async avisarEnLaApp(
    userId: string | null,
    businessId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    if (!userId) return;
    if (
      !(await this.aceptaRecibir(
        userId,
        businessId,
        type,
        NotificationChannel.IN_APP
      ))
    ) {
      return;
    }

    await this.notifications.create({
      businessId,
      userId,
      type,
      title,
      message,
      data,
    });
  }

  /**
   * Indica si el usuario acepta ese tipo por ese canal; si la preferencia no
   * se puede leer, el aviso sale igual.
   */
  async aceptaRecibir(
    userId: string,
    businessId: string,
    type: NotificationType,
    channel: NotificationChannel
  ): Promise<boolean> {
    try {
      return await this.preferencias.isNotificationEnabled(
        userId,
        businessId,
        type,
        channel
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      this.logger.warn(
        `No se pudo leer la preferencia de ${userId}: se envia igualmente (${message})`
      );
      return true;
    }
  }

  /**
   * Deja el aviso a quien atiende el negocio: dueno, administracion y
   * recepcion. El profesional recibe los suyos por su propia membresia.
   */
  async avisarAlNegocio(
    businessId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    const miembros = await this.equipoDelNegocio(businessId);
    for (const userId of miembros) {
      await this.avisarEnLaApp(userId, businessId, type, title, message, data);
    }
  }

  /** Encola el correo dejando su fallo en el log. */
  async intentarCorreo(
    contexto: string,
    envio: () => Promise<void>,
    destinatario?: {
      userId: string | null;
      businessId: string;
      type: NotificationType;
    }
  ): Promise<void> {
    // Quien reserva como invitado no tiene cuenta y por tanto no tiene
    // preferencias: recibe el correo, que es su único canal.
    if (
      destinatario?.userId &&
      !(await this.aceptaRecibir(
        destinatario.userId,
        destinatario.businessId,
        destinatario.type,
        NotificationChannel.EMAIL
      ))
    ) {
      return;
    }

    try {
      await envio();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      this.logger.error(
        `No se pudo encolar el email de ${contexto}: ${message}`
      );
    }
  }

  /**
   * Registra el fallo del envío y lo vuelve a lanzar, para que el mensaje acabe
   * en la cola de fallidos en lugar de darse por consumido.
   */
  logError(context: string, error: unknown): never {
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error(`Error enviando email de ${context}: ${message}`, stack);
    throw error instanceof Error ? error : new Error(message);
  }

  /** Identificadores del equipo que gestiona la agenda del negocio. */
  private async equipoDelNegocio(businessId: string): Promise<string[]> {
    const miembros = await this.http.pedirONulo<
      { userId: string; role: string }[]
    >("auth", `/internal/memberships/business/${businessId}`);

    return (miembros ?? [])
      .filter((m) => ROLES_DE_GESTION.includes(m.role))
      .map((m) => m.userId);
  }
}
