import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { ProcessedEventsStore } from "@beautyspot/nest-common";
import { ocultarCorreo } from "@beautyspot/shared-utils";
import {
  UserRegisteredEvent,
  PasswordResetRequestedEvent,
  EmailVerificationRequestedEvent,
  RegistroDuplicadoEvent,
  EventNames,
  EVENTS_EXCHANGE,
  DEAD_LETTER_EXCHANGE,
  nombreDeCola,
} from "@beautyspot/event-types";
import { EmailService } from "../emails/email.service";
import { AvisosService } from "./avisos.service";

/**
 * Correos de la cuenta: bienvenida, restablecer contrasena, confirmar el correo
 * y avisar de un alta repetida. Los cuatro son solo correo.
 */
@Injectable()
export class CuentaListeners {
  private readonly logger = new Logger(CuentaListeners.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly processedEvents: ProcessedEventsStore,
    private readonly avisos: AvisosService
  ) {}

  /** Al registrarse un usuario, encola el correo de bienvenida. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.AUTH_USER_REGISTERED,
    queue: nombreDeCola("notification", EventNames.AUTH_USER_REGISTERED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleUserRegistered(event: UserRegisteredEvent) {
    this.logger.log(
      `Usuario registrado: ${ocultarCorreo(event.payload.email)}`
    );
    try {
      await this.processedEvents.once(
        event,
        "notification:bienvenida",
        async () => {
          const { jobId } = await this.emailService.queueWelcomeEmail(
            event.payload.email,
            { clientName: event.payload.name }
          );

          await this.avisos.emitEmailQueuedEvent(
            jobId,
            event.payload.email,
            "welcome-email",
            "Bienvenido a BeautySpot"
          );
        }
      );
    } catch (error) {
      this.avisos.logError("bienvenida", error);
    }
  }

  /**
   * Avisa al dueño de una cuenta de que alguien intentó registrarse con su
   * correo.
   *
   * El alta responde lo mismo exista o no la cuenta, así que este correo es lo
   * único que distingue los dos casos, y lo recibe quien tiene derecho a
   * saberlo: el dueño del buzón.
   */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.AUTH_REGISTRO_DUPLICADO,
    queue: nombreDeCola("notification", EventNames.AUTH_REGISTRO_DUPLICADO),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleRegistroDuplicado(event: RegistroDuplicadoEvent) {
    const { email, name } = event.payload;

    this.logger.log(
      `Alta repetida sobre una cuenta existente: ${ocultarCorreo(email)}`
    );

    try {
      await this.processedEvents.once(
        event,
        "notification:alta repetida",
        async () => {
          const { jobId } = await this.emailService.queueRegistroDuplicado(
            email,
            {
              clientName: name,
              recoveryLink: `${this.appUrl()}/forgot-password`,
            }
          );

          await this.avisos.emitEmailQueuedEvent(
            jobId,
            email,
            "registro-duplicado",
            "Ya tienes una cuenta en BeautySpot"
          );
        }
      );
    } catch (error) {
      this.avisos.logError("alta repetida", error);
    }
  }

  /** Ante una solicitud de reset, arma el enlace con vencimiento y encola el correo. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.AUTH_PASSWORD_RESET_REQUESTED,
    queue: nombreDeCola(
      "notification",
      EventNames.AUTH_PASSWORD_RESET_REQUESTED
    ),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handlePasswordResetRequested(event: PasswordResetRequestedEvent) {
    const { email, name, resetToken, expiresAt } = event.payload;

    this.logger.log(
      `Solicitud de reset de contraseña para: ${ocultarCorreo(email)}`
    );

    try {
      await this.processedEvents.once(
        event,
        "notification:reset de contraseña",
        async () => {
          const resetLink = `${this.appUrl()}/reset-password?token=${resetToken}`;

          const { jobId } = await this.emailService.queuePasswordReset(email, {
            clientName: name,
            resetLink,
            expiryHours: this.horasHasta(expiresAt),
          });

          await this.avisos.emitEmailQueuedEvent(
            jobId,
            email,
            "password-reset",
            "Restablecer contraseña - BeautySpot"
          );
        }
      );
    } catch (error) {
      this.avisos.logError("reset de contraseña", error);
    }
  }

  /** Ante un alta o un reenvío, arma el enlace de confirmación y encola el correo. */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.AUTH_EMAIL_VERIFICATION_REQUESTED,
    queue: nombreDeCola(
      "notification",
      EventNames.AUTH_EMAIL_VERIFICATION_REQUESTED
    ),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleEmailVerificationRequested(
    event: EmailVerificationRequestedEvent
  ) {
    const { email, name, verificationToken, expiresAt } = event.payload;

    this.logger.log(
      `Solicitud de confirmación de correo para: ${ocultarCorreo(email)}`
    );

    try {
      await this.processedEvents.once(
        event,
        "notification:confirmación de correo",
        async () => {
          const verificationLink = `${this.appUrl()}/verify-email?token=${verificationToken}`;

          const { jobId } = await this.emailService.queueEmailVerification(
            email,
            {
              clientName: name,
              verificationLink,
              expiryHours: this.horasHasta(expiresAt),
            }
          );

          await this.avisos.emitEmailQueuedEvent(
            jobId,
            email,
            "email-verification",
            "Confirma tu cuenta - BeautySpot"
          );
        }
      );
    } catch (error) {
      this.avisos.logError("confirmación de correo", error);
    }
  }

  /**
   * Origen publico de la aplicacion, del que cuelgan los enlaces del correo:
   * el del navegador, que es quien sirve `/verify-email` y `/reset-password`.
   */
  private appUrl(): string {
    return this.configService.get<string>("APP_URL", "http://localhost:8080");
  }

  /** Horas que le quedan al enlace, redondeadas hacia arriba para el correo. */
  private horasHasta(expiresAt: string | Date): number {
    return Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)
    );
  }
}
