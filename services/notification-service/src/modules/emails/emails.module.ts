import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { EVENTS_EXCHANGE, DEAD_LETTER_EXCHANGE } from "@beautyspot/event-types";
import { EmailsController } from "./emails.controller";
import { EmailService } from "./email.service";
import { PlantillasService } from "./plantillas.service";
import { SmtpTransport } from "./smtp.transport";
import { SendEmailProcessor } from "./processors/send-email.processor";
import { NotificationPreferencesModule } from "../notification-preferences/notification-preferences.module";

@Module({
  imports: [
    NotificationPreferencesModule,
    BullModule.registerQueue({
      name: "emails",
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        // El trabajo se borra al terminar, y el fallido dura lo justo para
        // mirarlo: el cuerpo lleva el enlace con su token en claro.
        removeOnComplete: true,
        removeOnFail: {
          age: 600,
          count: 100,
        },
      },
    }),
    RabbitMQModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        exchanges: [
          { name: EVENTS_EXCHANGE, type: "topic" },
          { name: DEAD_LETTER_EXCHANGE, type: "topic" },
        ],
        uri: config.get<string>("RABBITMQ_URL") ?? "amqp://localhost:5672",
        connectionInitOptions: { wait: false },
      }),
    }),
  ],
  controllers: [EmailsController],
  providers: [
    EmailService,
    PlantillasService,
    SmtpTransport,
    SendEmailProcessor,
  ],
  exports: [EmailService],
})
/** Cablea el envío de correos, su cola BullMQ y el worker de envío. */
export class EmailsModule {}
