import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bullmq";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
import { EVENTS_EXCHANGE, DEAD_LETTER_EXCHANGE } from "@beautyspot/event-types";
import { EmailsController } from "./emails.controller";
import { EmailService } from "./email.service";
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
        removeOnComplete: {
          age: 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 24 * 3600,
          count: 5000,
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
  providers: [EmailService, SendEmailProcessor],
  exports: [EmailService],
})
/** Cablea el envío de correos, su cola BullMQ y el worker de envío. */
export class EmailsModule {}
