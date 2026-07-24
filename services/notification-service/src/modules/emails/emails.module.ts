import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { RabbitMQModule } from "@golevelup/nestjs-rabbitmq";
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
    RabbitMQModule.forRoot({
      exchanges: [
        {
          name: "beautyspot.events",
          type: "topic",
        },
      ],
      uri: process.env.RABBITMQ_URL || "amqp://localhost:5672",
      connectionInitOptions: { wait: false },
    }),
  ],
  controllers: [EmailsController],
  providers: [EmailService, SendEmailProcessor],
  exports: [EmailService],
})
/** Cablea el envío de correos, su cola BullMQ y el worker de envío. */
export class EmailsModule {}
