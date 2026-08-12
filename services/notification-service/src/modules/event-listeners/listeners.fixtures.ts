import { Test, TestingModule } from "@nestjs/testing";
import { AmqpConnection } from "@golevelup/nestjs-rabbitmq";
import { ConfigService } from "@nestjs/config";
import {
  ProcessedEventsStore,
  InternalHttpClient,
} from "@beautyspot/nest-common";
import { EmailService } from "../emails/email.service";
import { DataEnricherService } from "../data-enricher/data-enricher.service";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationPreferencesService } from "../notification-preferences/notification-preferences.service";
import { AvisosService } from "./avisos.service";
import { CuentaListeners } from "./cuenta.listeners";
import { AgendaListeners } from "./agenda.listeners";
import { CobrosListeners } from "./cobros.listeners";
import { ClienteListeners } from "./cliente.listeners";

/** Lo que `enrichAppointmentParticipants` devuelve en los tests. */
export const DATOS_ENRIQUECIDOS = {
  clientName: "Juan Cliente",
  clientEmail: "juan@example.com",
  clientUserId: "user-cliente" as string | null,
  professionalName: "Ana Pro",
  businessName: "EliteBarbers",
  businessAddress: "Calle 123",
  businessPhone: "+57 300 123 4567",
};

/** Los dobles del entorno, más el módulo del que sacar cada listener. */
export interface EntornoDeListeners {
  modulo: TestingModule;
  emails: jest.Mocked<EmailService>;
  amqp: jest.Mocked<AmqpConnection>;
  enricher: jest.Mocked<DataEnricherService>;
  notificaciones: { create: jest.Mock };
  http: jest.Mocked<InternalHttpClient>;
  preferencias: { isNotificationEnabled: jest.Mock };
}

/**
 * Monta los cuatro listeners contra los mismos dobles.
 *
 * `AvisosService` se registra **real**: es el colaborador que decide si el aviso
 * sale y por dónde, así que mockearlo dejaría sin comprobar justo lo que cada
 * listener delega en él.
 */
export async function crearEntornoDeListeners(): Promise<EntornoDeListeners> {
  const emails = {
    queueWelcomeEmail: jest.fn().mockResolvedValue({ jobId: "job-123" }),
    queuePasswordReset: jest.fn().mockResolvedValue({ jobId: "job-129" }),
    queueEmailVerification: jest.fn().mockResolvedValue({ jobId: "job-130" }),
    queueReviewRequest: jest.fn().mockResolvedValue({ jobId: "job-131" }),
    queueAppointmentConfirmation: jest
      .fn()
      .mockResolvedValue({ jobId: "job-124" }),
    queueAppointmentCancelled: jest
      .fn()
      .mockResolvedValue({ jobId: "job-125" }),
    queueAppointmentReminder24h: jest
      .fn()
      .mockResolvedValue({ jobId: "job-126" }),
    queueAppointmentReminder1h: jest
      .fn()
      .mockResolvedValue({ jobId: "job-127" }),
    queueInvoice: jest.fn().mockResolvedValue({ jobId: "job-128" }),
    queueAppointmentCreated: jest.fn().mockResolvedValue({ jobId: "job-130" }),
    queueBirthdayGreeting: jest.fn().mockResolvedValue({ jobId: "job-132" }),
  } as unknown as jest.Mocked<EmailService>;

  const amqp = {
    publish: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AmqpConnection>;

  const config = {
    get: jest.fn((clave: string) =>
      clave === "APP_URL" ? "http://localhost:3000" : undefined
    ),
  } as unknown as ConfigService;

  const enricher = {
    enrichAppointmentParticipants: jest
      .fn()
      .mockResolvedValue(DATOS_ENRIQUECIDOS),
    enrichClientEmail: jest.fn().mockResolvedValue("juan@example.com"),
    enrichClientName: jest.fn().mockResolvedValue("Juan Cliente"),
    enrichClientUserId: jest.fn().mockResolvedValue("user-cliente"),
    enrichBusinessData: jest.fn().mockResolvedValue({
      businessName: "EliteBarbers",
      businessAddress: "Calle 123",
      businessPhone: "+57 300 123 4567",
    }),
  } as unknown as jest.Mocked<DataEnricherService>;

  const notificaciones = { create: jest.fn().mockResolvedValue(undefined) };

  // El equipo del negocio se resuelve contra auth-service; aquí basta con un
  // dueño para comprobar que el aviso también le llega a él.
  const http = {
    pedirONulo: jest
      .fn()
      .mockResolvedValue([{ userId: "user-dueno", role: "OWNER" }]),
  } as unknown as jest.Mocked<InternalHttpClient>;

  // Sin preferencia guardada se recibe todo; los tests que prueban el opt-out
  // lo dicen.
  const preferencias = {
    isNotificationEnabled: jest.fn().mockResolvedValue(true),
  };

  const modulo = await Test.createTestingModule({
    providers: [
      AvisosService,
      CuentaListeners,
      AgendaListeners,
      CobrosListeners,
      ClienteListeners,
      { provide: EmailService, useValue: emails },
      { provide: AmqpConnection, useValue: amqp },
      { provide: ConfigService, useValue: config },
      { provide: DataEnricherService, useValue: enricher },
      { provide: NotificationsService, useValue: notificaciones },
      { provide: InternalHttpClient, useValue: http },
      { provide: NotificationPreferencesService, useValue: preferencias },
      {
        // El store real se prueba aparte; aquí basta con que deje pasar el
        // trabajo, que es el comportamiento cuando el evento es nuevo.
        provide: ProcessedEventsStore,
        useValue: {
          once: jest.fn(
            async (_e: unknown, _h: string, trabajo: () => Promise<void>) => {
              await trabajo();
              return true;
            }
          ),
        },
      },
    ],
  }).compile();

  return { modulo, emails, amqp, enricher, notificaciones, http, preferencias };
}
