import { Injectable, Logger } from "@nestjs/common";
import { RabbitSubscribe } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import { ProcessedEventsStore } from "@beautyspot/nest-common";
import { ocultarCorreo } from "@beautyspot/shared-utils";
import {
  BusinessCreatedEvent,
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
import { DataEnricherService } from "../data-enricher/data-enricher.service";
import { AvisosService } from "./avisos.service";

/**
 * Correos de la cuenta: bienvenidas, restablecer contrasena, confirmar el correo
 * y alta repetida.
 */
@Injectable()
export class CuentaListeners {
  private readonly logger = new Logger(CuentaListeners.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly processedEvents: ProcessedEventsStore,
    private readonly avisos: AvisosService,
    private readonly dataEnricher: DataEnricherService
  ) {}

  /**
   * Al crearse una cuenta, encola su bienvenida: la de quien viene a reservar,
   * o la de equipo si la dio de alta un negocio.
   */
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
          const { email, name, businessId } = event.payload;

          if (businessId) {
            const negocio =
              await this.dataEnricher.enrichBusinessData(businessId);
            const { jobId, subject } =
              await this.emailService.queueBienvenidaEquipo(email, {
                clientName: name,
                businessName: negocio.businessName,
              });
            await this.avisos.emitEmailQueuedEvent(
              jobId,
              email,
              "bienvenida-equipo",
              subject
            );
            return;
          }

          const { jobId, subject } = await this.emailService.queueWelcomeEmail(
            email,
            { clientName: name }
          );
          await this.avisos.emitEmailQueuedEvent(
            jobId,
            email,
            "welcome-email",
            subject
          );
        }
      );
    } catch (error) {
      this.avisos.logError("bienvenida", error);
    }
  }

  /**
   * Al dar de alta un negocio, da la bienvenida a su dueño con los pasos para
   * dejarlo listo. El evento solo trae su id: el correo se pide a auth.
   */
  @RabbitSubscribe({
    exchange: EVENTS_EXCHANGE,
    routingKey: EventNames.CORE_BUSINESS_CREATED,
    queue: nombreDeCola("notification", EventNames.CORE_BUSINESS_CREATED),
    queueOptions: { deadLetterExchange: DEAD_LETTER_EXCHANGE },
  })
  async handleBusinessCreated(event: BusinessCreatedEvent) {
    const { businessId, name, ownerId } = event.payload;
    this.logger.log(`Negocio dado de alta: ${businessId}`);

    try {
      await this.processedEvents.once(
        event,
        "notification:bienvenida del negocio",
        async () => {
          const dueno = await this.dataEnricher.enrichUserContact(ownerId);
          // Sin a quién escribir no hay correo; el negocio ya está creado.
          if (!dueno?.email) return;

          const { jobId, subject } =
            await this.emailService.queueBienvenidaNegocio(dueno.email, {
              clientName: dueno.name,
              businessName: name,
            });
          await this.avisos.emitEmailQueuedEvent(
            jobId,
            dueno.email,
            "bienvenida-negocio",
            subject
          );
        }
      );
    } catch (error) {
      this.avisos.logError("bienvenida del negocio", error);
    }
  }

  /**
   * Avisa al dueño de una cuenta de que alguien intentó registrarse con su
   * correo. El alta responde lo mismo exista o no, así que este correo es lo
   * único que distingue los dos casos, y lo recibe el dueño del buzón.
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
          const { jobId, subject } =
            await this.emailService.queueRegistroDuplicado(email, {
              clientName: name,
              recoveryLink: `${this.appUrl()}/forgot-password`,
            });

          await this.avisos.emitEmailQueuedEvent(
            jobId,
            email,
            "registro-duplicado",
            subject
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

          const { jobId, subject } = await this.emailService.queuePasswordReset(
            email,
            {
              clientName: name,
              resetLink,
              expiryHours: this.horasHasta(expiresAt),
            }
          );

          await this.avisos.emitEmailQueuedEvent(
            jobId,
            email,
            "password-reset",
            subject
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

          const { jobId, subject } =
            await this.emailService.queueEmailVerification(email, {
              clientName: name,
              verificationLink,
              expiryHours: this.horasHasta(expiresAt),
            });

          await this.avisos.emitEmailQueuedEvent(
            jobId,
            email,
            "email-verification",
            subject
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
